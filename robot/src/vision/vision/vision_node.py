import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import String
from cv_bridge import CvBridge
import cv2
import json


# Modèle HOG pré-entraîné d'OpenCV pour détecter les personnes
# Pas besoin de GPU, tourne sur Jetson Nano sans IA lourde
HOG = cv2.HOGDescriptor()
HOG.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

# Confidence minimale pour considérer une détection valide
MIN_CONFIDENCE = 0.4


class VisionNode(Node):
    """
    Reçoit les images de la caméra, détecte les personnes avec HOG (OpenCV).
    Publie la classification sur /robot/vision/classification :
      - PERSON  → obstacle_avoidance déclenche arrêt immédiat
      - OBJECT  → obstacle_avoidance tente le contournement
      - UNKNOWN → pas d'image exploitable
    """

    def __init__(self):
        super().__init__('vision_node')

        self._bridge = CvBridge()

        # Reçoit les images de la caméra
        self.image_sub = self.create_subscription(
            Image,
            '/camera/image_raw',
            self._on_image,
            10
        )

        # Publie la classification vers obstacle_avoidance_node
        self.classification_pub = self.create_publisher(
            String,
            '/robot/vision/classification',
            10
        )

        # Publie l'image annotée pour debug (visible dans RViz)
        self.debug_pub = self.create_publisher(Image, '/robot/vision/debug', 10)

        self.get_logger().info('Vision node démarré (détecteur HOG OpenCV)')

    def _on_image(self, msg: Image):
        try:
            frame = self._bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')
        except Exception as e:
            self.get_logger().error(f'Erreur conversion image : {e}')
            self._publish_classification('UNKNOWN', [])
            return

        persons, classification = self._detect(frame)
        self._publish_classification(classification, persons)
        self._publish_debug(frame, persons)

    def _detect(self, frame):
        """
        Détecte les personnes dans l'image avec HOG.
        Retourne (liste des boîtes détectées, classification).
        """
        # Redimensionner pour accélérer la détection sur Jetson
        small = cv2.resize(frame, (320, 240))

        boxes, weights = HOG.detectMultiScale(
            small,
            winStride=(8, 8),
            padding=(4, 4),
            scale=1.05
        )

        # Filtrer par confidence
        persons = [
            box for box, w in zip(boxes, weights)
            if w > MIN_CONFIDENCE
        ] if len(boxes) > 0 else []

        classification = 'PERSON' if persons else 'OBJECT'
        return persons, classification

    def _publish_classification(self, classification: str, persons: list):
        payload = json.dumps({
            'type': classification,
            'count': len(persons),
        })
        msg = String()
        msg.data = payload
        self.classification_pub.publish(msg)

        if classification == 'PERSON':
            self.get_logger().warn(f'{len(persons)} personne(s) détectée(s) — arrêt requis')

    def _publish_debug(self, frame, persons: list):
        """Dessine les boîtes de détection sur l'image pour debug RViz."""
        debug_frame = frame.copy()
        for (x, y, w, h) in persons:
            # Les coords viennent du resize 320x240, on les remet à l'échelle
            sx = frame.shape[1] / 320
            sy = frame.shape[0] / 240
            cv2.rectangle(
                debug_frame,
                (int(x * sx), int(y * sy)),
                (int((x + w) * sx), int((y + h) * sy)),
                (0, 0, 255),  # rouge
                2
            )

        try:
            debug_msg = self._bridge.cv2_to_imgmsg(debug_frame, encoding='bgr8')
            self.debug_pub.publish(debug_msg)
        except Exception:
            pass


def main(args=None):
    rclpy.init(args=args)
    node = VisionNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
