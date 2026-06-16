from __future__ import annotations

import json
import threading
from typing import Any

import paho.mqtt.client as mqtt
import rclpy
from action_msgs.msg import GoalStatus
from action_msgs.srv import CancelGoal
from geometry_msgs.msg import PoseStamped, PoseWithCovarianceStamped, Twist
from nav2_msgs.action import NavigateToPose
from nav2_msgs.srv import ClearEntireCostmap
from nav_msgs.msg import OccupancyGrid, Odometry, Path
from rclpy.action import ActionClient
from rclpy.node import Node
from sensor_msgs.msg import BatteryState, LaserScan
from std_msgs.msg import Float32

from health_robot_bridge.payloads import (
    ParsedCommand,
    duration_to_seconds,
    finite_float,
    optional_finite_float,
    parse_mqtt_command,
    voltage_to_percent,
    yaw_to_quaternion,
)


class MqttRosBridgeNode(Node):
    def __init__(self) -> None:
        super().__init__('health_robot_mqtt_ros_bridge')

        self._declare_parameters()
        self._lock = threading.Lock()
        self._current_goal_handle = None
        self._last_battery_level: int | None = None
        self._last_battery_voltage: float | None = None
        self._last_pose: dict[str, float] | None = None
        self._last_scan_min_distance: float | None = None
        self._last_speed_mps: float | None = None
        self._emergency_active = False

        self._cmd_vel_pub = self.create_publisher(Twist, self._param('cmd_vel_topic'), 10)
        self._goal_pose_pub = self.create_publisher(PoseStamped, self._param('goal_pose_topic'), 10)

        self._nav_client = ActionClient(self, NavigateToPose, self._param('navigate_action_name'))
        self._nav_cancel_client = self.create_client(CancelGoal, self._param('navigate_cancel_service'))
        self._global_costmap_client = self.create_client(ClearEntireCostmap, self._param('global_costmap_clear_service'))
        self._local_costmap_client = self.create_client(ClearEntireCostmap, self._param('local_costmap_clear_service'))

        self.create_subscription(Float32, self._param('battery_voltage_topic'), self._on_battery_voltage, 10)
        battery_state_topic = str(self._param('battery_state_topic'))
        if battery_state_topic:
            self.create_subscription(BatteryState, battery_state_topic, self._on_battery_state, 10)
        self.create_subscription(Odometry, self._param('odom_topic'), self._on_odom, 10)
        self.create_subscription(PoseWithCovarianceStamped, self._param('amcl_pose_topic'), self._on_amcl_pose, 10)
        self.create_subscription(PoseWithCovarianceStamped, self._param('pose_topic'), self._on_pose, 10)
        self.create_subscription(OccupancyGrid, self._param('map_topic'), self._on_map, 1)
        self.create_subscription(LaserScan, self._param('scan_topic'), self._on_scan, 10)
        self.create_subscription(Path, self._param('plan_topic'), self._on_plan, 10)

        self._mqtt_client = self._create_mqtt_client()
        self._connect_mqtt()

        self.create_timer(float(self._param('status_publish_period_s')), self._publish_status)
        self.get_logger().info('Health Robot MQTT/ROS2 bridge started')

    def destroy_node(self) -> bool:
        self._mqtt_client.loop_stop()
        try:
            self._mqtt_client.disconnect()
        except OSError:
            pass
        return super().destroy_node()

    def _declare_parameters(self) -> None:
        self.declare_parameter('mqtt_host', 'localhost')
        self.declare_parameter('mqtt_port', 1883)
        self.declare_parameter('mqtt_keepalive', 60)
        self.declare_parameter('mqtt_username', '')
        self.declare_parameter('mqtt_password', '')
        self.declare_parameter('mqtt_client_id', 'health-robot-bridge')
        self.declare_parameter('mqtt_command_topic', 'robot/command/#')
        self.declare_parameter('mqtt_admin_topic', 'robot/admin/restart')
        self.declare_parameter('mqtt_status_topic', 'robot/status')
        self.declare_parameter('mqtt_battery_topic', 'robot/battery')
        self.declare_parameter('mqtt_nav_path_topic', 'robot/nav2/path')
        self.declare_parameter('mqtt_nav_feedback_topic', 'robot/nav2/feedback')
        self.declare_parameter('mqtt_emergency_topic', 'robot/emergency')
        self.declare_parameter('mqtt_qos', 1)
        self.declare_parameter('map_frame', 'map')
        self.declare_parameter('cmd_vel_topic', '/cmd_vel')
        self.declare_parameter('goal_pose_topic', '/goal_pose')
        self.declare_parameter('navigate_action_name', '/navigate_to_pose')
        self.declare_parameter('navigate_cancel_service', '/navigate_to_pose/_action/cancel_goal')
        self.declare_parameter('battery_voltage_topic', '/battery')
        self.declare_parameter('battery_state_topic', '')
        self.declare_parameter('odom_topic', '/odom')
        self.declare_parameter('amcl_pose_topic', '/amcl_pose')
        self.declare_parameter('pose_topic', '/pose')
        self.declare_parameter('map_topic', '/map')
        self.declare_parameter('scan_topic', '/scan_multi')
        self.declare_parameter('plan_topic', '/plan')
        self.declare_parameter('global_costmap_clear_service', '/global_costmap/clear_entirely_global_costmap')
        self.declare_parameter('local_costmap_clear_service', '/local_costmap/clear_entirely_local_costmap')
        self.declare_parameter('base_x', 0.0)
        self.declare_parameter('base_y', 0.0)
        self.declare_parameter('base_yaw', 0.0)
        self.declare_parameter('status_publish_period_s', 2.0)
        self.declare_parameter('emergency_zero_publish_count', 5)

    def _param(self, name: str) -> Any:
        return self.get_parameter(name).value

    def _create_mqtt_client(self) -> mqtt.Client:
        client = mqtt.Client(client_id=str(self._param('mqtt_client_id')), protocol=mqtt.MQTTv311)
        username = str(self._param('mqtt_username'))
        password = str(self._param('mqtt_password'))
        if username:
            client.username_pw_set(username, password or None)
        client.on_connect = self._on_mqtt_connect
        client.on_disconnect = self._on_mqtt_disconnect
        client.on_message = self._on_mqtt_message
        return client

    def _connect_mqtt(self) -> None:
        try:
            self._mqtt_client.connect(
                str(self._param('mqtt_host')),
                int(self._param('mqtt_port')),
                int(self._param('mqtt_keepalive')),
            )
            self._mqtt_client.loop_start()
        except OSError as exc:
            self.get_logger().error(f'MQTT connection failed: {exc}')

    def _on_mqtt_connect(self, client: mqtt.Client, userdata: Any, flags: dict[str, Any], rc: int) -> None:
        if rc != 0:
            self.get_logger().error(f'MQTT connect returned rc={rc}')
            return
        command_topic = str(self._param('mqtt_command_topic'))
        admin_topic = str(self._param('mqtt_admin_topic'))
        client.subscribe(command_topic, qos=int(self._param('mqtt_qos')))
        client.subscribe(admin_topic, qos=int(self._param('mqtt_qos')))
        self.get_logger().info(f'Subscribed to MQTT commands: {command_topic}')
        self.get_logger().info(f'Subscribed to MQTT admin: {admin_topic}')

    def _on_mqtt_disconnect(self, client: mqtt.Client, userdata: Any, rc: int) -> None:
        if rc != 0:
            self.get_logger().warning(f'MQTT disconnected unexpectedly rc={rc}')

    def _on_mqtt_message(self, client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
        try:
            if message.topic == str(self._param('mqtt_admin_topic')):
                payload = json.loads(message.payload.decode('utf-8'))
                self._handle_admin_message(payload)
                return

            legacy_command = self._parse_legacy_command(message.payload)
            if legacy_command is not None:
                self._handle_command(legacy_command)
                return

            command = parse_mqtt_command(message.payload)
            self._handle_command(command)
        except (json.JSONDecodeError, ValueError) as exc:
            self.get_logger().warning(f'Invalid MQTT command on {message.topic}: {exc}')
        except Exception as exc:  # noqa: BLE001 - ROS node must not crash on remote command payloads.
            self.get_logger().error(f'Command handling failed on {message.topic}: {exc}')

    def _handle_command(self, command: ParsedCommand) -> None:
        if command.command_type == 'navigate':
            self._handle_navigate(command)
        elif command.command_type == 'teleop':
            self._handle_teleop(command)
        elif command.command_type == 'emergency_stop':
            self._handle_emergency_stop(command)
        elif command.command_type == 'return_base':
            self._handle_return_base(command)
        elif command.command_type == 'clear_costmaps':
            self._handle_clear_costmaps(command)
        else:
            raise ValueError(f'Unsupported command type: {command.command_type}')

    def _parse_legacy_command(self, raw_payload: bytes) -> ParsedCommand | None:
        payload = json.loads(raw_payload.decode('utf-8'))
        if not isinstance(payload, dict) or 'type' in payload:
            return None

        action = payload.get('action')
        command_type_by_action = {
            'emergency_stop': 'emergency_stop',
            'return_to_base': 'return_base',
            'clear_costmaps': 'clear_costmaps',
        }
        command_type = command_type_by_action.get(action)
        if command_type is None:
            return None

        return ParsedCommand(
            command_id=str(payload.get('command_id') or f'legacy-{action}'),
            command_type=command_type,
            requested_by=None,
            requested_by_role=None,
            payload=payload,
        )

    def _handle_admin_message(self, payload: dict[str, Any]) -> None:
        if payload.get('action') != 'admin_restart_procedure' or payload.get('step') != 'reset_emergency_latch':
            return

        with self._lock:
            self._emergency_active = False

        self._publish_json(
            str(self._param('mqtt_emergency_topic')),
            {
                'active': False,
                'source': 'bridge',
                'cleared_by': payload.get('actor', 'admin'),
                'restart_procedure': 'ADMIN_ONLY',
            },
        )
        self.get_logger().info('Emergency latch reset from MQTT admin command')

    def _handle_navigate(self, command: ParsedCommand) -> None:
        x = finite_float(command.payload.get('x'), 'x')
        y = finite_float(command.payload.get('y'), 'y')
        yaw = optional_finite_float(command.payload.get('yaw'), 'yaw', 0.0)
        self._send_nav_goal(command, x=x, y=y, yaw=yaw)

    def _handle_return_base(self, command: ParsedCommand) -> None:
        self._send_nav_goal(
            command,
            x=float(self._param('base_x')),
            y=float(self._param('base_y')),
            yaw=float(self._param('base_yaw')),
        )

    def _send_nav_goal(self, command: ParsedCommand, x: float, y: float, yaw: float) -> None:
        pose = self._make_pose(x=x, y=y, yaw=yaw)
        self._goal_pose_pub.publish(pose)

        if not self._nav_client.wait_for_server(timeout_sec=1.0):
            self.get_logger().warning('NavigateToPose action unavailable; published /goal_pose only')
            self._publish_json(
                str(self._param('mqtt_nav_feedback_topic')),
                {'command_id': command.command_id, 'status': 'goal_pose_published', 'x': x, 'y': y, 'yaw': yaw},
            )
            return

        goal = NavigateToPose.Goal()
        goal.pose = pose
        future = self._nav_client.send_goal_async(goal, feedback_callback=lambda feedback: self._on_nav_feedback(command, feedback))
        future.add_done_callback(lambda result: self._on_nav_goal_response(command, result))
        self._publish_json(
            str(self._param('mqtt_nav_feedback_topic')),
            {'command_id': command.command_id, 'status': 'sent', 'x': x, 'y': y, 'yaw': yaw},
        )

    def _on_nav_goal_response(self, command: ParsedCommand, future: Any) -> None:
        goal_handle = future.result()
        if not goal_handle.accepted:
            self._publish_json(str(self._param('mqtt_nav_feedback_topic')), {'command_id': command.command_id, 'status': 'rejected'})
            return

        with self._lock:
            self._current_goal_handle = goal_handle
        self._publish_json(str(self._param('mqtt_nav_feedback_topic')), {'command_id': command.command_id, 'status': 'accepted'})
        goal_handle.get_result_async().add_done_callback(lambda result: self._on_nav_result(command, result))

    def _on_nav_feedback(self, command: ParsedCommand, feedback_msg: Any) -> None:
        feedback = feedback_msg.feedback
        self._publish_json(
            str(self._param('mqtt_nav_feedback_topic')),
            {
                'command_id': command.command_id,
                'status': 'navigating',
                'distance_remaining_m': getattr(feedback, 'distance_remaining', None),
                'navigation_time_s': duration_to_seconds(getattr(feedback, 'navigation_time', None)),
                'estimated_time_remaining_s': duration_to_seconds(getattr(feedback, 'estimated_time_remaining', None)),
                'number_of_recoveries': getattr(feedback, 'number_of_recoveries', None),
            },
        )

    def _on_nav_result(self, command: ParsedCommand, future: Any) -> None:
        result = future.result()
        status = getattr(result, 'status', None)
        status_name = 'succeeded' if status == GoalStatus.STATUS_SUCCEEDED else 'failed'
        with self._lock:
            self._current_goal_handle = None
        self._publish_json(str(self._param('mqtt_nav_feedback_topic')), {'command_id': command.command_id, 'status': status_name})

    def _handle_teleop(self, command: ParsedCommand) -> None:
        linear_x = finite_float(command.payload.get('linear_x'), 'linear_x')
        angular_z = finite_float(command.payload.get('angular_z'), 'angular_z')
        duration_ms = int(command.payload.get('duration_ms', 300))
        if duration_ms <= 0 or duration_ms > 1000:
            raise ValueError('duration_ms must be between 1 and 1000')

        twist = Twist()
        twist.linear.x = linear_x
        twist.angular.z = angular_z
        self._cmd_vel_pub.publish(twist)
        stop_timer = None

        def stop_once() -> None:
            self._publish_zero_twist()
            if stop_timer is not None:
                stop_timer.cancel()

        stop_timer = self.create_timer(duration_ms / 1000.0, stop_once)

    def _handle_emergency_stop(self, command: ParsedCommand) -> None:
        with self._lock:
            self._emergency_active = True
            goal_handle = self._current_goal_handle

        if goal_handle is not None:
            goal_handle.cancel_goal_async()
        if self._nav_cancel_client.wait_for_service(timeout_sec=0.2):
            self._nav_cancel_client.call_async(CancelGoal.Request())

        count = int(self._param('emergency_zero_publish_count'))
        for _ in range(max(1, count)):
            self._publish_zero_twist()

        self._publish_json(
            str(self._param('mqtt_emergency_topic')),
            {
                'command_id': command.command_id,
                'active': True,
                'source': 'bridge',
                'reason': command.payload.get('reason', 'manual_ui_stop'),
            },
        )

    def _handle_clear_costmaps(self, command: ParsedCommand) -> None:
        calls = []
        for client in (self._global_costmap_client, self._local_costmap_client):
            if client.wait_for_service(timeout_sec=1.0):
                calls.append(client.call_async(ClearEntireCostmap.Request()))
        self._publish_json(
            str(self._param('mqtt_nav_feedback_topic')),
            {'command_id': command.command_id, 'status': 'clear_costmaps_requested', 'service_calls': len(calls)},
        )

    def _make_pose(self, x: float, y: float, yaw: float) -> PoseStamped:
        pose = PoseStamped()
        pose.header.frame_id = str(self._param('map_frame'))
        pose.header.stamp = self.get_clock().now().to_msg()
        pose.pose.position.x = x
        pose.pose.position.y = y
        qx, qy, qz, qw = yaw_to_quaternion(yaw)
        pose.pose.orientation.x = qx
        pose.pose.orientation.y = qy
        pose.pose.orientation.z = qz
        pose.pose.orientation.w = qw
        return pose

    def _publish_zero_twist(self) -> None:
        self._cmd_vel_pub.publish(Twist())

    def _on_battery_voltage(self, msg: Float32) -> None:
        voltage = float(msg.data)
        level = voltage_to_percent(voltage)
        with self._lock:
            self._last_battery_level = level
            self._last_battery_voltage = voltage
        self._publish_json(
            str(self._param('mqtt_battery_topic')),
            {
                'level': level,
                'voltage': voltage,
                'is_charging': False,
            },
        )

    def _on_battery_state(self, msg: BatteryState) -> None:
        level = self._battery_level_from_msg(msg)
        with self._lock:
            self._last_battery_level = level
            self._last_battery_voltage = msg.voltage if msg.voltage == msg.voltage else None
        self._publish_json(
            str(self._param('mqtt_battery_topic')),
            {
                'level': level,
                'voltage': msg.voltage if msg.voltage == msg.voltage else None,
                'is_charging': msg.power_supply_status == BatteryState.POWER_SUPPLY_STATUS_CHARGING,
            },
        )

    def _on_odom(self, msg: Odometry) -> None:
        speed_mps = (msg.twist.twist.linear.x**2 + msg.twist.twist.linear.y**2) ** 0.5
        with self._lock:
            self._last_speed_mps = speed_mps
        self._set_last_pose(msg.pose.pose.position.x, msg.pose.pose.position.y)

    def _on_amcl_pose(self, msg: PoseWithCovarianceStamped) -> None:
        self._set_last_pose(msg.pose.pose.position.x, msg.pose.pose.position.y)

    def _on_pose(self, msg: PoseWithCovarianceStamped) -> None:
        self._set_last_pose(msg.pose.pose.position.x, msg.pose.pose.position.y)

    def _on_map(self, msg: OccupancyGrid) -> None:
        self._publish_json(
            str(self._param('mqtt_status_topic')),
            {
                'type': 'map',
                'width': msg.info.width,
                'height': msg.info.height,
                'resolution': msg.info.resolution,
                'origin_x': msg.info.origin.position.x,
                'origin_y': msg.info.origin.position.y,
            },
        )

    def _on_scan(self, msg: LaserScan) -> None:
        valid_ranges = [value for value in msg.ranges if msg.range_min < value < msg.range_max]
        with self._lock:
            self._last_scan_min_distance = min(valid_ranges) if valid_ranges else None

    def _on_plan(self, msg: Path) -> None:
        path_distance = self._path_distance(msg)
        if path_distance is None:
            return
        with self._lock:
            current_speed_mps = self._last_speed_mps
        self._publish_json(
            str(self._param('mqtt_nav_path_topic')),
            {
                'path_distance_m': path_distance,
                'distance_remaining_m': path_distance,
                'current_speed_mps': current_speed_mps,
                'target_name': 'nav2_goal',
            },
        )

    def _set_last_pose(self, x: float, y: float) -> None:
        with self._lock:
            self._last_pose = {'x': x, 'y': y}

    def _publish_status(self) -> None:
        with self._lock:
            payload = {
                'mode': 'EMERGENCY_STOP' if self._emergency_active else 'IDLE',
                'battery_level': self._last_battery_level,
                'battery_voltage': self._last_battery_voltage,
                'emergency_active': self._emergency_active,
                'pose': self._last_pose,
                'min_obstacle_distance_m': self._last_scan_min_distance,
                'current_speed_mps': self._last_speed_mps,
            }
        self._publish_json(str(self._param('mqtt_status_topic')), payload)

    def _publish_json(self, topic: str, payload: dict[str, Any]) -> None:
        result = self._mqtt_client.publish(topic, json.dumps(payload), qos=int(self._param('mqtt_qos')))
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            self.get_logger().warning(f'MQTT publish failed on {topic}: rc={result.rc}')

    @staticmethod
    def _battery_level_from_msg(msg: BatteryState) -> int:
        if msg.percentage == msg.percentage and msg.percentage >= 0:
            percentage = msg.percentage * 100 if msg.percentage <= 1.0 else msg.percentage
            return max(0, min(100, round(percentage)))
        if msg.voltage == msg.voltage and msg.voltage >= 0:
            return voltage_to_percent(msg.voltage)
        return 0

    @staticmethod
    def _path_distance(msg: Path) -> float | None:
        if len(msg.poses) < 2:
            return None
        distance = 0.0
        previous = msg.poses[0].pose.position
        for stamped_pose in msg.poses[1:]:
            current = stamped_pose.pose.position
            distance += ((current.x - previous.x) ** 2 + (current.y - previous.y) ** 2) ** 0.5
            previous = current
        return distance


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = MqttRosBridgeNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
