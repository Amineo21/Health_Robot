import json
import threading

import paho.mqtt.client as mqtt
import rclpy
from geometry_msgs.msg import PoseStamped, PoseWithCovarianceStamped, Twist
from nav_msgs.msg import Path
from rclpy.node import Node
from std_msgs.msg import String


MQTT_HOST = "10.10.220.121"  # IP de la machine qui fait tourner docker-compose
MQTT_PORT = 1883

MQTT_GOAL_TOPIC = "robot/nav/goal"          # backend → robot
MQTT_CMD_VEL_TOPIC = "robot/cmd_vel"        # backend → robot
MQTT_CANCEL_TOPIC = "robot/nav/cancel"      # backend → robot
MQTT_STATUS_TOPIC = "robot/status"          # robot → backend
MQTT_BATTERY_TOPIC = "robot/battery"        # robot → backend
MQTT_POSE_TOPIC = "robot/pose"              # robot → backend
MQTT_PATH_DISPLAY_TOPIC = "robot/nav/path_display"  # robot → backend

ROS_CMD_VEL_TOPIC = "/cmd_vel"
ROS_STATUS_TOPIC = "/robot/nav/status"
ROS_BATTERY_TOPIC = "/battery"
ROS_AMCL_POSE_TOPIC = "/amcl_pose"
ROS_PLAN_TOPIC = "/plan"


class MqttBridgeNode(Node):
    def __init__(self):
        super().__init__("mqtt_bridge_node")

        self._goal_pub = self.create_publisher(PoseStamped, '/goal_pose', 10)
        self._cmd_vel_pub = self.create_publisher(Twist, ROS_CMD_VEL_TOPIC, 10)

        self.create_subscription(String, ROS_STATUS_TOPIC, self._on_nav_status, 10)
        self.create_subscription(String, ROS_BATTERY_TOPIC, self._on_battery, 10)
        self.create_subscription(PoseWithCovarianceStamped, ROS_AMCL_POSE_TOPIC, self._on_amcl_pose, 10)
        self.create_subscription(Path, ROS_PLAN_TOPIC, self._on_plan, 10)

        self._current_pose = {"x": 0.0, "y": 0.0}

        self._mqtt = mqtt.Client(client_id="ros2_bridge", protocol=mqtt.MQTTv311)
        self._mqtt.on_connect = self._on_mqtt_connect
        self._mqtt.on_message = self._on_mqtt_message
        self._mqtt.on_disconnect = self._on_mqtt_disconnect

        self._mqtt_thread = threading.Thread(target=self._run_mqtt, daemon=True)
        self._mqtt_thread.start()

        self.get_logger().info("MQTT Bridge node démarré")

    def _run_mqtt(self):
        try:
            self._mqtt.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            self._mqtt.loop_forever()
        except Exception as e:
            self.get_logger().error(f"MQTT connexion échouée : {e}")

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.get_logger().info(f"MQTT connecté sur {MQTT_HOST}:{MQTT_PORT}")
            client.subscribe(MQTT_GOAL_TOPIC, qos=1)
            client.subscribe(MQTT_CMD_VEL_TOPIC, qos=0)
            client.subscribe(MQTT_CANCEL_TOPIC, qos=1)
        else:
            self.get_logger().warning(f"MQTT connexion refusée rc={rc}")

    def _on_mqtt_disconnect(self, client, userdata, rc):
        if rc != 0:
            self.get_logger().warning(f"MQTT déconnecté rc={rc}, reconnexion...")

    def _on_mqtt_message(self, client, userdata, message):
        topic = message.topic
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except json.JSONDecodeError as e:
            self.get_logger().error(f"Payload MQTT invalide : {e}")
            return

        if topic == MQTT_GOAL_TOPIC:
            self._handle_goal(payload)
        elif topic == MQTT_CMD_VEL_TOPIC:
            self._handle_cmd_vel(payload)
        elif topic == MQTT_CANCEL_TOPIC:
            self._handle_cancel()

    def _handle_goal(self, payload: dict):
        """robot/nav/goal → /goal_pose vers Nav2."""
        try:
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            pose.header.stamp = self.get_clock().now().to_msg()
            pose.pose.position.x = float(payload['x'])
            pose.pose.position.y = float(payload['y'])
            pose.pose.position.z = 0.0
            pose.pose.orientation.w = 1.0
            self._goal_pub.publish(pose)
            self.get_logger().info(f"Goal Nav2 envoyé : ({payload['x']}, {payload['y']})")
        except KeyError as e:
            self.get_logger().error(f"Goal invalide : {e}")

    def _handle_cmd_vel(self, payload: dict):
        """robot/cmd_vel → /cmd_vel vers les moteurs."""
        twist = Twist()
        twist.linear.x = float(payload.get("linear_x", 0.0))
        twist.angular.z = float(payload.get("angular_z", 0.0))
        self._cmd_vel_pub.publish(twist)

    def _handle_cancel(self):
        """Annule la navigation en envoyant un goal à la position actuelle."""
        self.get_logger().info("Annulation navigation — goal envoyé à la position actuelle")
        stop = Twist()
        self._cmd_vel_pub.publish(stop)
        pose = PoseStamped()
        pose.header.frame_id = 'map'
        pose.header.stamp = self.get_clock().now().to_msg()
        pose.pose.position.x = self._current_pose["x"]
        pose.pose.position.y = self._current_pose["y"]
        pose.pose.orientation.w = 1.0
        self._goal_pub.publish(pose)

    def _on_nav_status(self, msg: String):
        """Reçoit /robot/nav/status → publie sur robot/status via MQTT."""
        self._mqtt.publish(MQTT_STATUS_TOPIC, msg.data, qos=1)

    def _on_battery(self, msg: String):
        """Reçoit /battery → publie sur robot/battery via MQTT."""
        try:
            payload = json.loads(msg.data)
            self._mqtt.publish(MQTT_BATTERY_TOPIC, json.dumps(payload), qos=1)
        except json.JSONDecodeError:
            pass

    def _on_amcl_pose(self, msg: PoseWithCovarianceStamped):
        """Reçoit /amcl_pose → publie robot/pose via MQTT."""
        self._current_pose["x"] = msg.pose.pose.position.x
        self._current_pose["y"] = msg.pose.pose.position.y
        payload = {
            "x": msg.pose.pose.position.x,
            "y": msg.pose.pose.position.y,
            "z": msg.pose.pose.orientation.z,
            "w": msg.pose.pose.orientation.w,
        }
        self._mqtt.publish(MQTT_POSE_TOPIC, json.dumps(payload), qos=0)

    def _on_plan(self, msg: Path):
        """Reçoit /plan depuis Nav2 → publie le trajet simplifié via MQTT."""
        # 1 point sur 5 pour réduire la taille du payload
        poses = [
            {"x": p.pose.position.x, "y": p.pose.position.y}
            for p in msg.poses[::5]
        ]
        self._mqtt.publish(MQTT_PATH_DISPLAY_TOPIC, json.dumps({"poses": poses}), qos=0)


def main(args=None):
    rclpy.init(args=args)
    node = MqttBridgeNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
