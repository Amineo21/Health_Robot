from __future__ import annotations

import json
import logging
import math
import threading
import time
from typing import Any

import paho.mqtt.client as mqtt

from app.core.config import Settings
from app.domain.entities.mqtt_topics import (
    ROBOT_ADMIN_TOPIC,
    ROBOT_BATTERY_TOPIC,
    ROBOT_COMMAND_NAVIGATION_TOPIC,
    ROBOT_COMMAND_SAFETY_TOPIC,
    ROBOT_COMMAND_TELEOP_TOPIC,
    ROBOT_COMMAND_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
    ROBOT_STATUS_TOPIC,
)

logger = logging.getLogger(__name__)

COMMAND_SUBSCRIPTIONS: tuple[tuple[str, int], ...] = (
    (f"{ROBOT_COMMAND_TOPIC}/#", 1),
    (ROBOT_COMMAND_TOPIC, 1),
    (ROBOT_ADMIN_TOPIC, 1),
)

ROSBRIDGE_ADVERTISE_TOPICS: tuple[tuple[str, str], ...] = (
    ("/goal_pose", "geometry_msgs/msg/PoseStamped"),
    ("/cmd_vel", "geometry_msgs/msg/Twist"),
)

ROSBRIDGE_SUBSCRIBE_TOPICS: tuple[tuple[str, str, int], ...] = (
    ("/battery", "std_msgs/msg/Float32", 1000),
    ("/map", "nav_msgs/msg/OccupancyGrid", 1000),
    ("/scan_multi", "sensor_msgs/msg/LaserScan", 500),
    ("/pose", "geometry_msgs/msg/PoseWithCovarianceStamped", 200),
    ("/amcl_pose", "geometry_msgs/msg/PoseWithCovarianceStamped", 200),
    ("/odom", "nav_msgs/msg/Odometry", 500),
    ("/plan", "nav_msgs/msg/Path", 1000),
)


class MqttRosbridgeBridge:
    """Bridge internal MQTT commands to the robot rosbridge WebSocket port."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._mqtt_client = mqtt.Client(client_id=settings.robot_rosbridge_client_id, protocol=mqtt.MQTTv311)
        if settings.mqtt_username:
            self._mqtt_client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

        self._mqtt_client.on_connect = self._handle_mqtt_connect
        self._mqtt_client.on_disconnect = self._handle_mqtt_disconnect
        self._mqtt_client.on_message = self._handle_mqtt_message
        self._mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)

        self._stop_event = threading.Event()
        self._websocket_thread: threading.Thread | None = None
        self._websocket: Any | None = None
        self._websocket_connected = False
        self._websocket_lock = threading.Lock()
        self._zero_twist_timers: list[threading.Timer] = []
        self._emergency_active = False

    def start(self) -> None:
        if not self._settings.robot_rosbridge_enabled:
            logger.info("Pont MQTT -> rosbridge desactive par configuration")
            return

        if not self._settings.mqtt_enabled:
            logger.info("Pont MQTT -> rosbridge desactive car MQTT_ENABLED=false")
            return

        self._start_rosbridge_loop()
        self._mqtt_client.connect_async(
            self._settings.mqtt_host,
            self._settings.mqtt_port,
            self._settings.mqtt_keepalive,
        )
        self._mqtt_client.loop_start()
        logger.info(
            "Pont MQTT -> rosbridge demarre: MQTT %s:%s -> %s",
            self._settings.mqtt_host,
            self._settings.mqtt_port,
            self._settings.robot_rosbridge_url,
        )

    def stop(self) -> None:
        self._stop_event.set()
        for timer in self._zero_twist_timers:
            timer.cancel()
        self._zero_twist_timers.clear()
        self._mqtt_client.loop_stop()
        try:
            self._mqtt_client.disconnect()
        except OSError:
            pass

        with self._websocket_lock:
            websocket = self._websocket
        if websocket is not None:
            try:
                websocket.close()
            except OSError:
                pass

        if self._websocket_thread is not None:
            self._websocket_thread.join(timeout=2)

    def _start_rosbridge_loop(self) -> None:
        self._websocket_thread = threading.Thread(target=self._run_rosbridge_loop, daemon=True)
        self._websocket_thread.start()

    def _run_rosbridge_loop(self) -> None:
        try:
            from websocket import WebSocketApp
        except ImportError:
            logger.error("Dependance manquante: installer websocket-client pour le pont rosbridge")
            return

        while not self._stop_event.is_set():
            websocket = WebSocketApp(
                self._settings.robot_rosbridge_url,
                on_open=self._handle_rosbridge_open,
                on_message=self._handle_rosbridge_message,
                on_error=self._handle_rosbridge_error,
                on_close=self._handle_rosbridge_close,
            )
            with self._websocket_lock:
                self._websocket = websocket
            websocket.run_forever(ping_interval=30, ping_timeout=10)
            self._websocket_connected = False
            if not self._stop_event.is_set():
                logger.warning("Connexion rosbridge perdue, nouvelle tentative dans 3s")
                time.sleep(3)

    def _handle_mqtt_connect(self, client: mqtt.Client, userdata: Any, flags: dict[str, Any], rc: int) -> None:
        if rc != 0:
            logger.warning("Connexion MQTT du pont rosbridge refusee rc=%s", rc)
            return
        for topic, qos in COMMAND_SUBSCRIPTIONS:
            client.subscribe(topic, qos=qos)
        logger.info("Pont rosbridge abonne aux commandes MQTT")

    def _handle_mqtt_disconnect(self, client: mqtt.Client, userdata: Any, rc: int) -> None:
        if rc != 0:
            logger.warning("Pont rosbridge deconnecte de MQTT rc=%s", rc)

    def _handle_mqtt_message(self, client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("Commande MQTT invalide sur %s", message.topic)
            return

        if not isinstance(payload, dict):
            logger.warning("Commande MQTT ignoree sur %s: payload non objet", message.topic)
            return

        if message.topic == ROBOT_ADMIN_TOPIC:
            self._handle_admin_command(payload)
            return

        command_type, command_payload = parse_mqtt_command_payload(message.topic, payload)
        if command_type is None:
            return

        try:
            self._handle_robot_command(command_type, command_payload)
        except (TypeError, ValueError) as exc:
            logger.warning("Commande robot invalide sur %s: %s", message.topic, exc)

    def _handle_rosbridge_open(self, websocket: Any) -> None:
        self._websocket_connected = True
        for topic, message_type in ROSBRIDGE_ADVERTISE_TOPICS:
            self._send_rosbridge({"op": "advertise", "topic": topic, "type": message_type})
        for topic, message_type, throttle_rate in ROSBRIDGE_SUBSCRIBE_TOPICS:
            self._send_rosbridge(
                {
                    "op": "subscribe",
                    "topic": topic,
                    "type": message_type,
                    "throttle_rate": throttle_rate,
                }
            )
        logger.info("Connecte au rosbridge robot %s", self._settings.robot_rosbridge_url)

    def _handle_rosbridge_close(self, websocket: Any, close_status_code: int, close_msg: str) -> None:
        self._websocket_connected = False
        if close_status_code or close_msg:
            logger.warning("rosbridge ferme code=%s message=%s", close_status_code, close_msg)

    def _handle_rosbridge_error(self, websocket: Any, error: Any) -> None:
        if not self._stop_event.is_set():
            logger.warning("Erreur rosbridge: %s", error)

    def _handle_rosbridge_message(self, websocket: Any, raw_message: str) -> None:
        try:
            message = json.loads(raw_message)
        except json.JSONDecodeError:
            return

        if message.get("op") != "publish":
            return

        topic = message.get("topic")
        ros_message = message.get("msg")
        if not isinstance(topic, str) or not isinstance(ros_message, dict):
            return

        try:
            telemetry = telemetry_payload_from_ros_message(topic, ros_message)
        except (KeyError, TypeError, ValueError):
            return
        if telemetry is None:
            return
        mqtt_topic, payload = telemetry
        self._mqtt_client.publish(mqtt_topic, json.dumps(payload), qos=1)

    def _handle_robot_command(self, command_type: str, payload: dict[str, Any]) -> None:
        if command_type != "emergency_stop" and self._emergency_active:
            logger.warning("Commande %s ignoree: arret d'urgence actif", command_type)
            return

        if command_type == "navigate":
            self._publish_goal_pose(
                finite_float(payload.get("x"), "x"),
                finite_float(payload.get("y"), "y"),
                optional_finite_float(payload.get("yaw"), "yaw", 0.0),
            )
            return

        if command_type == "teleop":
            self._publish_twist(
                finite_float(payload.get("linear_x"), "linear_x"),
                finite_float(payload.get("angular_z"), "angular_z"),
            )
            duration_ms = payload.get("duration_ms")
            if isinstance(duration_ms, int) and duration_ms > 0:
                self._schedule_zero_twist(duration_ms / 1000.0)
            return

        if command_type == "emergency_stop":
            self._emergency_active = True
            self._cancel_navigation_goals()
            self._publish_zero_twist_burst()
            self._mqtt_client.publish(
                ROBOT_EMERGENCY_TOPIC,
                json.dumps(
                    {
                        "active": True,
                        "source": "ros2",
                        "reason": payload.get("reason", "Arret d'urgence demande depuis Health Robot."),
                        "requires_admin_restart": True,
                    }
                ),
                qos=1,
                retain=True,
            )
            return

        if command_type == "return_base":
            self._publish_goal_pose(
                self._settings.robot_base_x,
                self._settings.robot_base_y,
                self._settings.robot_base_yaw,
            )
            return

        if command_type == "clear_costmaps":
            self._clear_costmaps()
            return

        raise ValueError(f"type de commande non supporte: {command_type}")

    def _handle_admin_command(self, payload: dict[str, Any]) -> None:
        if payload.get("action") != "admin_restart_procedure" or payload.get("step") != "reset_emergency_latch":
            return
        self._emergency_active = False
        self._mqtt_client.publish(
            ROBOT_EMERGENCY_TOPIC,
            json.dumps(
                {
                    "active": False,
                    "source": "ros2",
                    "cleared_by": payload.get("actor", "admin"),
                    "restart_procedure": "ADMIN_ONLY",
                }
            ),
            qos=1,
            retain=True,
        )

    def _publish_goal_pose(self, x: float, y: float, yaw: float) -> None:
        self._send_rosbridge(
            {
                "op": "publish",
                "topic": "/goal_pose",
                "msg": build_goal_pose_message(x, y, yaw),
            }
        )

    def _publish_twist(self, linear_x: float, angular_z: float) -> None:
        self._send_rosbridge(
            {
                "op": "publish",
                "topic": "/cmd_vel",
                "msg": build_twist_message(linear_x=linear_x, angular_z=angular_z),
            }
        )

    def _schedule_zero_twist(self, delay_seconds: float) -> None:
        timer = threading.Timer(delay_seconds, self._publish_zero_twist_burst)
        timer.daemon = True
        self._zero_twist_timers.append(timer)
        timer.start()

    def _publish_zero_twist_burst(self) -> None:
        for index in range(5):
            timer = threading.Timer(index * 0.1, self._publish_twist, kwargs={"linear_x": 0.0, "angular_z": 0.0})
            timer.daemon = True
            self._zero_twist_timers.append(timer)
            timer.start()

    def _cancel_navigation_goals(self) -> None:
        self._send_rosbridge(
            {
                "op": "call_service",
                "service": "/navigate_to_pose/_action/cancel_goal",
                "type": "action_msgs/srv/CancelGoal",
                "args": {
                    "goal_info": {
                        "goal_id": {"uuid": [0] * 16},
                        "stamp": {"sec": 0, "nanosec": 0},
                    }
                },
            }
        )

    def _clear_costmaps(self) -> None:
        for service in (
            "/global_costmap/clear_entirely_global_costmap",
            "/local_costmap/clear_entirely_local_costmap",
        ):
            self._send_rosbridge(
                {
                    "op": "call_service",
                    "service": service,
                    "type": "nav2_msgs/srv/ClearEntireCostmap",
                    "args": {},
                }
            )

    def _send_rosbridge(self, payload: dict[str, Any]) -> None:
        with self._websocket_lock:
            websocket = self._websocket
            connected = self._websocket_connected

        if websocket is None or not connected:
            logger.warning("Message rosbridge ignore car la WebSocket robot n'est pas connectee")
            return

        try:
            websocket.send(json.dumps(payload))
        except OSError as exc:
            logger.warning("Envoi rosbridge echoue: %s", exc)


def parse_mqtt_command_payload(topic: str, message: dict[str, Any]) -> tuple[str | None, dict[str, Any]]:
    if isinstance(message.get("type"), str):
        payload = message.get("payload") or {}
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        return str(message["type"]), payload

    action = message.get("action")
    if action == "return_to_base":
        return "return_base", message
    if action in {"emergency_stop", "clear_costmaps"}:
        return str(action), message

    command_by_topic = {
        ROBOT_COMMAND_NAVIGATION_TOPIC: "navigate",
        ROBOT_COMMAND_TELEOP_TOPIC: "teleop",
        ROBOT_COMMAND_SAFETY_TOPIC: "emergency_stop",
    }
    return command_by_topic.get(topic), message


def build_goal_pose_message(x: float, y: float, yaw: float) -> dict[str, Any]:
    qz = math.sin(yaw / 2.0)
    qw = math.cos(yaw / 2.0)
    now = int(time.time())
    return {
        "header": {"frame_id": "map", "stamp": {"sec": now, "nanosec": 0}},
        "pose": {
            "position": {"x": x, "y": y, "z": 0},
            "orientation": {"x": 0, "y": 0, "z": qz, "w": qw},
        },
    }


def build_twist_message(linear_x: float, angular_z: float) -> dict[str, Any]:
    return {
        "linear": {"x": linear_x, "y": 0, "z": 0},
        "angular": {"x": 0, "y": 0, "z": angular_z},
    }


def telemetry_payload_from_ros_message(topic: str, message: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    if topic == "/battery":
        voltage = finite_float(message.get("data"), "data")
        return ROBOT_BATTERY_TOPIC, {"level": voltage_to_percent(voltage), "voltage": voltage}

    if topic == "/map":
        info = message.get("info")
        if not isinstance(info, dict):
            return None
        origin = info.get("origin") if isinstance(info.get("origin"), dict) else {}
        position = origin.get("position") if isinstance(origin.get("position"), dict) else {}
        return ROBOT_STATUS_TOPIC, {
            "map": {
                "width": int(info["width"]),
                "height": int(info["height"]),
                "resolution": finite_float(info.get("resolution"), "resolution"),
                "origin_x": float(position.get("x", 0.0)),
                "origin_y": float(position.get("y", 0.0)),
            }
        }

    if topic in {"/pose", "/amcl_pose"}:
        pose = _extract_pose_with_covariance(message)
        return (ROBOT_STATUS_TOPIC, {"pose": pose}) if pose is not None else None

    if topic == "/odom":
        payload: dict[str, Any] = {}
        pose = _extract_odometry_pose(message)
        if pose is not None:
            payload["pose"] = pose
        speed = _extract_odometry_speed(message)
        if speed is not None:
            payload["current_speed_mps"] = speed
        return (ROBOT_STATUS_TOPIC, payload) if payload else None

    if topic == "/scan_multi":
        ranges = message.get("ranges")
        if not isinstance(ranges, list):
            return None
        distances = [float(value) for value in ranges if isinstance(value, int | float) and math.isfinite(value) and value > 0]
        if not distances:
            return None
        return ROBOT_STATUS_TOPIC, {"min_obstacle_distance_m": min(distances)}

    if topic == "/plan":
        poses = message.get("poses")
        if not isinstance(poses, list):
            return None
        distance = path_distance_from_poses(poses)
        return ROBOT_NAV2_PATH_TOPIC, {"path_distance_m": distance, "eta_source": "NAV2_PATH"}

    return None


def path_distance_from_poses(poses: list[Any]) -> float:
    distance = 0.0
    previous: tuple[float, float] | None = None
    for pose_stamped in poses:
        if not isinstance(pose_stamped, dict):
            continue
        pose = pose_stamped.get("pose")
        position = pose.get("position") if isinstance(pose, dict) else None
        if not isinstance(position, dict):
            continue
        current = (finite_float(position.get("x"), "x"), finite_float(position.get("y"), "y"))
        if previous is not None:
            distance += math.hypot(current[0] - previous[0], current[1] - previous[1])
        previous = current
    return distance


def voltage_to_percent(voltage: float, empty_voltage: float = 9.9, full_voltage: float = 12.6) -> int:
    if full_voltage <= empty_voltage:
        raise ValueError("full_voltage must be greater than empty_voltage")
    percentage = ((voltage - empty_voltage) / (full_voltage - empty_voltage)) * 100.0
    return max(0, min(100, round(percentage)))


def finite_float(value: Any, field_name: str) -> float:
    if not isinstance(value, int | float):
        raise ValueError(f"{field_name} must be a number")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{field_name} must be finite")
    return result


def optional_finite_float(value: Any, field_name: str, default: float) -> float:
    if value is None:
        return default
    return finite_float(value, field_name)


def _extract_pose_with_covariance(message: dict[str, Any]) -> dict[str, float] | None:
    pose_wrapper = message.get("pose")
    pose = pose_wrapper.get("pose") if isinstance(pose_wrapper, dict) else None
    return _pose_to_payload(pose) if isinstance(pose, dict) else None


def _extract_odometry_pose(message: dict[str, Any]) -> dict[str, float] | None:
    pose_wrapper = message.get("pose")
    pose = pose_wrapper.get("pose") if isinstance(pose_wrapper, dict) else None
    return _pose_to_payload(pose) if isinstance(pose, dict) else None


def _extract_odometry_speed(message: dict[str, Any]) -> float | None:
    twist_wrapper = message.get("twist")
    twist = twist_wrapper.get("twist") if isinstance(twist_wrapper, dict) else None
    linear = twist.get("linear") if isinstance(twist, dict) else None
    if not isinstance(linear, dict):
        return None
    x = float(linear.get("x", 0.0))
    y = float(linear.get("y", 0.0))
    return math.hypot(x, y)


def _pose_to_payload(pose: dict[str, Any]) -> dict[str, float] | None:
    position = pose.get("position")
    orientation = pose.get("orientation")
    if not isinstance(position, dict) or not isinstance(orientation, dict):
        return None
    return {
        "x": finite_float(position.get("x"), "x"),
        "y": finite_float(position.get("y"), "y"),
        "yaw": yaw_from_quaternion(orientation),
    }


def yaw_from_quaternion(orientation: dict[str, Any]) -> float:
    x = float(orientation.get("x", 0.0))
    y = float(orientation.get("y", 0.0))
    z = float(orientation.get("z", 0.0))
    w = float(orientation.get("w", 1.0))
    siny_cosp = 2.0 * ((w * z) + (x * y))
    cosy_cosp = 1.0 - (2.0 * ((y * y) + (z * z)))
    return math.atan2(siny_cosp, cosy_cosp)
