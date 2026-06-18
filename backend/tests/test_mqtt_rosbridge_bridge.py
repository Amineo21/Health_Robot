from __future__ import annotations

import math
import time

import pytest

from app.domain.entities.mqtt_topics import ROBOT_BATTERY_TOPIC, ROBOT_NAV2_PATH_TOPIC, ROBOT_STATUS_TOPIC
from app.infrastructure.rosbridge.mqtt_rosbridge_bridge import (
    MqttRosbridgeBridge,
    build_goal_pose_message,
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
