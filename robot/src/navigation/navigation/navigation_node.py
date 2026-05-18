import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from nav2_msgs.action import NavigateToPose
from geometry_msgs.msg import PoseStamped
from nav_msgs.msg import Odometry
from std_msgs.msg import String
import json


class NavigationNode(Node):
    """
    Reçoit une destination via le topic /robot/tasks (JSON),
    envoie le goal à Nav2, et publie l'état sur /robot/nav/status.
    """

    def __init__(self):
        super().__init__('navigation_node')

        # Client Nav2 — envoie les goals de navigation
        self._nav_client = ActionClient(self, NavigateToPose, 'navigate_to_pose')

        # Reçoit les commandes de livraison depuis le backend (via MQTT bridge)
        self.task_sub = self.create_subscription(
            String,
            '/robot/tasks',
            self._on_task_received,
            10
        )

        # Publie l'état de navigation vers le backend
        self.status_pub = self.create_publisher(String, '/robot/nav/status', 10)

        # Reçoit la position actuelle du robot
        self.odom_sub = self.create_subscription(
            Odometry,
            '/odom',
            self._on_odom,
            10
        )

        self._current_pose = None
        self.get_logger().info('Navigation node démarré')

    def _on_odom(self, msg: Odometry):
        self._current_pose = msg.pose.pose

    def _on_task_received(self, msg):
        """
        Format attendu du message JSON :
        {
            "room": "302",
            "type": "material",
            "destination": {"x": 3.5, "y": 1.2}
        }
        """
        try:
            task = json.loads(msg.data)
            x = task['destination']['x']
            y = task['destination']['y']
            room = task.get('room', '?')
            self.get_logger().info(f'Tâche reçue : chambre {room} → ({x}, {y})')
            self._send_goal(x, y, room)
        except (KeyError, json.JSONDecodeError) as e:
            self.get_logger().error(f'Tâche invalide : {e}')

    def _send_goal(self, x: float, y: float, room: str):
        """Envoie un goal de navigation à Nav2."""
        if not self._nav_client.wait_for_server(timeout_sec=5.0):
            self.get_logger().error('Nav2 non disponible')
            self._publish_status('ERROR', room)
            return

        goal = NavigateToPose.Goal()
        goal.pose = PoseStamped()
        goal.pose.header.frame_id = 'map'
        goal.pose.header.stamp = self.get_clock().now().to_msg()
        goal.pose.pose.position.x = x
        goal.pose.pose.position.y = y
        goal.pose.pose.orientation.w = 1.0  # orientation neutre

        self._publish_status('IN_PROGRESS', room)

        send_goal_future = self._nav_client.send_goal_async(
            goal,
            feedback_callback=lambda fb: self._on_feedback(fb, room)
        )
        send_goal_future.add_done_callback(
            lambda future: self._on_goal_response(future, room)
        )

    def _on_feedback(self, feedback_msg, room: str):
        distance = feedback_msg.feedback.distance_remaining
        self.get_logger().info(f'Chambre {room} — distance restante : {distance:.2f}m')

    def _on_goal_response(self, future, room: str):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('Goal refusé par Nav2')
            self._publish_status('ERROR', room)
            return

        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(
            lambda future: self._on_result(future, room)
        )

    def _on_result(self, future, room: str):
        result = future.result()
        if result.status == 4:  # SUCCEEDED
            self.get_logger().info(f'Livraison chambre {room} : SUCCÈS')
            self._publish_status('DELIVERED', room)
        else:
            self.get_logger().warn(f'Livraison chambre {room} : ÉCHEC (status={result.status})')
            self._publish_status('FAILED', room)

    def _publish_status(self, status: str, room: str):
        payload = json.dumps({'status': status, 'room': room})
        msg = String()
        msg.data = payload
        self.status_pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = NavigationNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
