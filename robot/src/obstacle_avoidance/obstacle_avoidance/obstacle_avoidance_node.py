import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from std_msgs.msg import String, Bool
import json


# Distances seuils (en mètres) — selon CDC-technique.md
STOP_DISTANCE = 0.5       # arrêt immédiat si obstacle à moins de 0.5m
WARNING_DISTANCE = 1.0    # alerte si obstacle à moins de 1m


class ObstacleAvoidanceNode(Node):
    """
    Lit le Lidar en continu et détecte les obstacles.
    - Si obstacle < 0.5m → arrêt immédiat + alerte
    - Si obstacle < 1.0m → avertissement au navigation_node
    - Publie l'état sur /robot/obstacle/status
    - Publie un signal d'arrêt sur /robot/emergency_stop
    """

    def __init__(self):
        super().__init__('obstacle_avoidance_node')

        # Écoute le Lidar (10 Hz selon CDC)
        self.scan_sub = self.create_subscription(
            LaserScan,
            '/scan',
            self._on_scan,
            10
        )

        # Publie l'état des obstacles vers le backend
        self.status_pub = self.create_publisher(String, '/robot/obstacle/status', 10)

        # Signal d'arrêt d'urgence (lu par navigation_node et safety_node)
        self.emergency_pub = self.create_publisher(Bool, '/robot/emergency_stop', 10)

        # Écoute les classifications vision (personne vs objet)
        self.vision_sub = self.create_subscription(
            String,
            '/robot/vision/classification',
            self._on_vision_classification,
            10
        )

        self._last_classification = 'UNKNOWN'
        self._emergency_active = False

        self.get_logger().info('Obstacle avoidance node démarré')

    def _on_scan(self, msg: LaserScan):
        """Analyse le scan Lidar et réagit selon la distance minimale."""
        valid_ranges = [r for r in msg.ranges if msg.range_min < r < msg.range_max]

        if not valid_ranges:
            return

        min_distance = min(valid_ranges)

        if min_distance < STOP_DISTANCE:
            self._trigger_stop(min_distance)
        elif min_distance < WARNING_DISTANCE:
            self._trigger_warning(min_distance)
        else:
            if self._emergency_active:
                self._clear_emergency()

    def _trigger_stop(self, distance: float):
        """Arrêt immédiat — obstacle trop proche."""
        is_person = self._last_classification == 'PERSON'

        self.get_logger().warn(
            f'ARRÊT — obstacle à {distance:.2f}m '
            f'({"PERSONNE" if is_person else "OBJET"})'
        )

        # Publie l'arrêt d'urgence
        stop_msg = Bool()
        stop_msg.data = True
        self.emergency_pub.publish(stop_msg)
        self._emergency_active = True

        # Publie le statut détaillé
        payload = json.dumps({
            'status': 'STOP',
            'distance': round(distance, 2),
            'obstacle_type': self._last_classification,
        })
        status_msg = String()
        status_msg.data = payload
        self.status_pub.publish(status_msg)

    def _trigger_warning(self, distance: float):
        """Avertissement — obstacle détecté dans la zone de vigilance."""
        self.get_logger().info(f'Obstacle à {distance:.2f}m — ralentissement')

        payload = json.dumps({
            'status': 'WARNING',
            'distance': round(distance, 2),
            'obstacle_type': self._last_classification,
        })
        status_msg = String()
        status_msg.data = payload
        self.status_pub.publish(status_msg)

    def _clear_emergency(self):
        """Lève l'arrêt d'urgence — voie libre."""
        self.get_logger().info('Voie libre — reprise possible')

        stop_msg = Bool()
        stop_msg.data = False
        self.emergency_pub.publish(stop_msg)
        self._emergency_active = False

        payload = json.dumps({'status': 'CLEAR', 'distance': None, 'obstacle_type': None})
        status_msg = String()
        status_msg.data = payload
        self.status_pub.publish(status_msg)

    def _on_vision_classification(self, msg: String):
        """Reçoit la classification depuis vision_node (PERSON / OBJECT / UNKNOWN)."""
        try:
            data = json.loads(msg.data)
            self._last_classification = data.get('type', 'UNKNOWN')
        except json.JSONDecodeError:
            pass


def main(args=None):
    rclpy.init(args=args)
    node = ObstacleAvoidanceNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
