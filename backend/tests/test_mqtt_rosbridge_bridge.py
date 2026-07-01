from __future__ import annotations

import json
import math
import time
from types import SimpleNamespace

import pytest

from app.domain.entities.mqtt_topics import (
    ROBOT_BATTERY_TOPIC,
    ROBOT_MISSION_RECOVERY_DONE_TOPIC,
    ROBOT_MISSION_RECOVERY_REQUEST_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
    ROBOT_STATUS_TOPIC,
)
from app.infrastructure.rosbridge.mqtt_rosbridge_bridge import (
    ROS_RECOVERY_DONE_TOPIC,
    ROS_RECOVERY_REQUEST_TOPIC,
    MqttRosbridgeBridge,
    build_goal_pose_message,
    build_initial_pose_message,
    build_twist_message,
    parse_mqtt_command_payload,
    telemetry_payload_from_ros_message,
    voltage_to_percent,
)


class MinimalSettings:
    robot_rosbridge_client_id = "test-rosbridge"
    mqtt_username = None
    mqtt_password = None


def test_parse_mqtt_command_payload_uses_nested_backend_payload() -> None:
    command_type, payload = parse_mqtt_command_payload(
        "robot/command/navigation",
        {"type": "navigate", "payload": {"x": 1.0, "y": 2.0, "yaw": 0.5}},
    )

    assert command_type == "navigate"
    assert payload == {"x": 1.0, "y": 2.0, "yaw": 0.5}


def test_parse_mqtt_command_payload_keeps_legacy_return_base() -> None:
    command_type, payload = parse_mqtt_command_payload("robot/command", {"action": "return_to_base"})

    assert command_type == "return_base"
    assert payload == {"action": "return_to_base"}


def test_build_goal_pose_message_matches_rosbridge_dashboard_shape() -> None:
    message = build_goal_pose_message(1.5, -2.0, math.pi)

    assert message["header"]["frame_id"] == "map"
    assert message["pose"]["position"] == {"x": 1.5, "y": -2.0, "z": 0}
    assert message["pose"]["orientation"]["z"] == pytest.approx(1.0)
    assert message["pose"]["orientation"]["w"] == pytest.approx(0.0)


def test_build_initial_pose_message_matches_rosbridge_dashboard_shape() -> None:
    message = build_initial_pose_message(0.0, 0.0, 0.0)

    assert message["header"]["frame_id"] == "map"
    assert message["pose"]["pose"]["position"] == {"x": 0.0, "y": 0.0, "z": 0}
    assert message["pose"]["pose"]["orientation"] == {"x": 0, "y": 0, "z": 0.0, "w": 1.0}
    assert len(message["pose"]["covariance"]) == 36
    assert message["pose"]["covariance"][0] == 0.25
    assert message["pose"]["covariance"][35] == pytest.approx(math.pi * math.pi / 9)


def test_build_twist_message_matches_cmd_vel_shape() -> None:
    assert build_twist_message(linear_x=0.2, angular_z=-0.5) == {
        "linear": {"x": 0.2, "y": 0, "z": 0},
        "angular": {"x": 0, "y": 0, "z": -0.5},
    }


def test_repeated_teleop_commands_keep_only_latest_stop_timer(monkeypatch: pytest.MonkeyPatch) -> None:
    bridge = MqttRosbridgeBridge(settings=MinimalSettings())  # type: ignore[arg-type]
    zero_burst_count = 0

    def fake_zero_burst() -> None:
        nonlocal zero_burst_count
        zero_burst_count += 1

    monkeypatch.setattr(bridge, "_publish_zero_twist_burst", fake_zero_burst)

    bridge._schedule_zero_twist(0.05)
    bridge._schedule_zero_twist(0.08)
    time.sleep(0.13)

    assert zero_burst_count == 1
    bridge.stop()


def test_recovery_request_mqtt_forwarded_to_rosbridge(monkeypatch: pytest.MonkeyPatch) -> None:
    bridge = MqttRosbridgeBridge(settings=MinimalSettings())  # type: ignore[arg-type]
    sent: list[dict] = []
    monkeypatch.setattr(bridge, "_send_rosbridge", lambda payload: sent.append(payload) or True)

    request = {"mission_id": "m-1", "supply_type": "linge", "stock_point": "Stock A"}
    message = SimpleNamespace(
        topic=ROBOT_MISSION_RECOVERY_REQUEST_TOPIC,
        payload=json.dumps(request).encode("utf-8"),
    )
    bridge._handle_mqtt_message(bridge._mqtt_client, None, message)  # type: ignore[arg-type]

    assert len(sent) == 1
    assert sent[0]["op"] == "publish"
    assert sent[0]["topic"] == ROS_RECOVERY_REQUEST_TOPIC
    assert json.loads(sent[0]["msg"]["data"]) == request
    bridge.stop()


def test_recovery_done_rosbridge_republished_to_mqtt(monkeypatch: pytest.MonkeyPatch) -> None:
    bridge = MqttRosbridgeBridge(settings=MinimalSettings())  # type: ignore[arg-type]
    published: list[tuple] = []
    monkeypatch.setattr(
        bridge._mqtt_client, "publish", lambda topic, payload, qos=0: published.append((topic, payload, qos))
    )

    done_data = json.dumps({"mission_id": "m-1", "success": True})
    raw = json.dumps({"op": "publish", "topic": ROS_RECOVERY_DONE_TOPIC, "msg": {"data": done_data}})
    bridge._handle_rosbridge_message(None, raw)

    assert len(published) == 1
    topic, payload, _ = published[0]
    assert topic == ROBOT_MISSION_RECOVERY_DONE_TOPIC
    assert json.loads(payload) == {"mission_id": "m-1", "success": True}
    bridge.stop()


def test_voltage_to_percent_matches_m3pro_dashboard_formula() -> None:
    assert voltage_to_percent(12.6) == 100
    assert voltage_to_percent(9.9) == 0
    assert voltage_to_percent(11.25) == 50


def test_rosbridge_battery_message_becomes_mqtt_battery_payload() -> None:
    topic, payload = telemetry_payload_from_ros_message("/battery", {"data": 11.25})

    assert topic == ROBOT_BATTERY_TOPIC
    assert payload == {"level": 50, "voltage": 11.25}


def test_rosbridge_map_message_becomes_runtime_status_payload() -> None:
    topic, payload = telemetry_payload_from_ros_message(
        "/map",
        {
            "info": {
                "width": 100,
                "height": 50,
                "resolution": 0.05,
                "origin": {"position": {"x": -2.5, "y": -1.25}},
            }
        },
    )

    assert topic == ROBOT_STATUS_TOPIC
    assert payload == {
        "map": {
            "width": 100,
            "height": 50,
            "resolution": 0.05,
            "origin_x": -2.5,
            "origin_y": -1.25,
        }
    }


def test_rosbridge_pose_message_becomes_runtime_status_payload() -> None:
    topic, payload = telemetry_payload_from_ros_message(
        "/pose",
        {
            "pose": {
                "pose": {
                    "position": {"x": 1.0, "y": 2.0, "z": 0.0},
                    "orientation": {"x": 0.0, "y": 0.0, "z": 1.0, "w": 0.0},
                }
            }
        },
    )

    assert topic == ROBOT_STATUS_TOPIC
    assert payload["pose"]["x"] == 1.0
    assert payload["pose"]["y"] == 2.0
    assert payload["pose"]["yaw"] == pytest.approx(math.pi)


def test_rosbridge_plan_message_becomes_path_distance_payload() -> None:
    topic, payload = telemetry_payload_from_ros_message(
        "/plan",
        {
            "poses": [
                {"pose": {"position": {"x": 0.0, "y": 0.0}}},
                {"pose": {"position": {"x": 3.0, "y": 4.0}}},
            ]
        },
    )

    assert topic == ROBOT_NAV2_PATH_TOPIC
    assert payload == {"path_distance_m": 5.0, "eta_source": "NAV2_PATH"}
