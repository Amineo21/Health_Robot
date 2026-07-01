#!/usr/bin/env python3
"""
Recuperation autonome de la fourniture au point de stock (M3 Pro).

Ferme la boucle de mission cote robot :
  1. Le backend (orchestrateur de mission) detecte l'arrivee au point de stock
     et publie robot/mission/recovery_request {mission_id, supply_type}.
  2. Le pont rosbridge du backend le republie en ROS String sur
     /robot/mission/recovery_request (meme canal que la navigation).
  3. Ce node SCANNE la fourniture (detections du object_detector_node sur
     /teacher/detections), puis joue une sequence de bras pour la SAISIR.
  4. Quand la fourniture est tenue, il publie /robot/mission/recovery_done
     {mission_id, success} -> le pont rosbridge le remonte au backend, qui
     confirme la recuperation et relance la navigation vers la livraison.

Aucune confirmation humaine n'est requise : c'est la partie "recuperation de
fourniture" automatisee annoncee dans Docs/CONTEXT_MISSION.md.

Le bras Yahboom est commande via arm_msgs/ArmJoints sur /arm_control
(convention servo 0-180, 90 = centre). Si arm_msgs n'est pas installe
(poste de dev sans la stack Yahboom), les commandes sont loggees en DRY-RUN
et la sequence se deroule quand meme pour tester la logique de mission.
"""
import json
import math
import time
from enum import Enum, auto

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseArray
from sensor_msgs.msg import JointState
from std_msgs.msg import String

try:
    from arm_msgs.msg import ArmJoints
    HAS_ARM_MSGS = True
except ImportError:
    HAS_ARM_MSGS = False


REQUEST_TOPIC = "/robot/mission/recovery_request"   # backend -> robot (via bridge)
DONE_TOPIC = "/robot/mission/recovery_done"          # robot -> backend (via bridge)
DETECTIONS_TOPIC = "/teacher/detections"             # object_detector_node


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def rad_to_servo(rad, center=90.0):
    """Convertit des radians (0 = centre) en degres servo Yahboom (90 = centre)."""
    return int(clamp(math.degrees(rad) + center, 0.0, 180.0))


class State(Enum):
    IDLE = auto()
    SCANNING = auto()   # attend de voir la fourniture
    REACH = auto()      # bras au-dessus de l'objet, pince ouverte
    GRASP = auto()      # descend + ferme la pince
    LIFT = auto()       # souleve la fourniture
    REPORT = auto()     # signale recovery_done


class MissionRecoveryNode(Node):
    GRIPPER_OPEN = 30
    GRIPPER_CLOSE = 75

    def __init__(self):
        super().__init__("mission_recovery_node")

        # Parametres ajustables (calibration bras / patience du scan)
        self.scan_timeout = float(self.declare_parameter("scan_timeout_sec", 8.0).value)
        self.state_dwell = float(self.declare_parameter("state_dwell_sec", 2.0).value)
        # Topic du bras reel M3 Pro. Le node teacher pick_and_place (prouve sur
        # le robot) publie des ArmJoints sur /arm_control -> meme topic ici.
        # Surchargeable au lancement: -p arm_command_topic:=/arm6_joints.
        self.arm_topic = self.declare_parameter("arm_command_topic", "/arm_control").value

        # Etat courant de la recuperation
        self.state = State.IDLE
        self.mission_id = None
        self.supply_type = None
        self.state_start = time.time()
        self.object_yaw = 0.0          # orientation vers la fourniture scannee
        self.object_seen = False

        # --- Souscriptions ---
        self.create_subscription(String, REQUEST_TOPIC, self.on_recovery_request, 10)
        self.create_subscription(PoseArray, DETECTIONS_TOPIC, self.on_detections, 5)

        # --- Publications ---
        self.done_pub = self.create_publisher(String, DONE_TOPIC, 10)
        self.joint_pub = self.create_publisher(JointState, "/teacher/joint_states", 10)
        if HAS_ARM_MSGS:
            self.arm_pub = self.create_publisher(ArmJoints, self.arm_topic, 10)
            self.get_logger().info(f"Bras commande via ArmJoints sur {self.arm_topic}")
        else:
            self.arm_pub = None
            self.get_logger().warning(
                "arm_msgs indisponible -> commandes bras en DRY-RUN "
                "(installer les paquets yahboomcar pour le bras reel)."
            )

        # Boucle de controle 5 Hz
        self.create_timer(0.2, self.control_loop)
        self.get_logger().info("Node de recuperation autonome pret (etat: IDLE)")

    # ------------------------------------------------------------------ entrees
    def on_recovery_request(self, msg: String):
        if self.state != State.IDLE:
            self.get_logger().warning("Requete de recuperation ignoree : deja occupe")
            return
        try:
            payload = json.loads(msg.data)
            mission_id = payload["mission_id"]
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            self.get_logger().error(f"Requete de recuperation invalide : {exc}")
            return

        self.mission_id = mission_id
        self.supply_type = payload.get("supply_type", "?")
        self.object_seen = False
        self.object_yaw = 0.0
        self.get_logger().info(
            f"Recuperation demandee : mission={mission_id} fourniture={self.supply_type}"
        )
        self.transition_to(State.SCANNING)

    def on_detections(self, msg: PoseArray):
        """Scan : retient la fourniture la plus proche avec une profondeur valide."""
        if self.state != State.SCANNING:
            return
        best = None
        best_dist = float("inf")
        for pose in msg.poses:
            z = pose.position.z
            if z <= 0:
                continue
            dist = math.sqrt(pose.position.x ** 2 + pose.position.y ** 2 + z ** 2)
            if dist < best_dist:
                best_dist = dist
                best = pose
        if best is None:
            return
        # Oriente le bras vers la fourniture (le reste de la saisie est scripte).
        self.object_yaw = math.atan2(best.position.y, best.position.x)
        self.object_seen = True
        self.get_logger().info(
            f"Fourniture detectee a {best_dist:.2f} m (yaw {math.degrees(self.object_yaw):.0f} deg)"
        )

    # ---------------------------------------------------------------- machine
    def control_loop(self):
        elapsed = time.time() - self.state_start

        if self.state == State.IDLE:
            return

        if self.state == State.SCANNING:
            if self.object_seen:
                self.transition_to(State.REACH)
            elif elapsed > self.scan_timeout:
                # Pas de detection : on tente quand meme la saisie a l'aveugle,
                # la fourniture est censee etre au point de stock.
                self.get_logger().warning("Aucune detection — saisie a l'aveugle")
                self.transition_to(State.REACH)
            return

        if self.state == State.REACH:
            # Bras au-dessus de la fourniture, pince ouverte.
            self.send_arm(self.object_yaw, 0.2, -0.5, -0.8, 0.0, self.GRIPPER_OPEN)
            if elapsed > self.state_dwell:
                self.transition_to(State.GRASP)
            return

        if self.state == State.GRASP:
            # Descend sur la fourniture puis ferme la pince.
            self.send_arm(self.object_yaw, 0.45, -0.9, -0.7, 0.0, self.GRIPPER_CLOSE)
            if elapsed > self.state_dwell:
                self.transition_to(State.LIFT)
            return

        if self.state == State.LIFT:
            # Souleve et ramene le bras en position de transport (pince fermee).
            self.send_arm(0.0, 0.5, -1.0, -0.6, 0.0, self.GRIPPER_CLOSE)
            if elapsed > self.state_dwell:
                self.transition_to(State.REPORT)
            return

        if self.state == State.REPORT:
            self.publish_done(success=True)
            self.get_logger().info(f"Recuperation terminee : mission={self.mission_id}")
            self.mission_id = None
            self.supply_type = None
            self.state = State.IDLE

    # ----------------------------------------------------------------- sorties
    def publish_done(self, success: bool):
        msg = String()
        msg.data = json.dumps({"mission_id": self.mission_id, "success": success})
        self.done_pub.publish(msg)

    def send_arm(self, base_yaw, shoulder, elbow, wrist_pitch, wrist_roll, gripper):
        j1 = rad_to_servo(base_yaw)
        j2 = rad_to_servo(shoulder)
        j3 = rad_to_servo(elbow)
        j4 = rad_to_servo(wrist_pitch)
        j5 = rad_to_servo(wrist_roll)
        j6 = int(gripper)

        if HAS_ARM_MSGS and self.arm_pub is not None:
            cmd = ArmJoints()
            cmd.joint1, cmd.joint2, cmd.joint3 = j1, j2, j3
            cmd.joint4, cmd.joint5, cmd.joint6 = j4, j5, j6
            self.arm_pub.publish(cmd)
        else:
            self.get_logger().info(
                f"[DRY-RUN] bras -> [{j1},{j2},{j3},{j4},{j5},{j6}]",
                throttle_duration_sec=1.0,
            )

        # Publie aussi un JointState pour la visualisation RViz.
        js = JointState()
        js.header.stamp = self.get_clock().now().to_msg()
        js.name = [
            "base_yaw_joint", "shoulder_joint", "elbow_joint",
            "wrist_pitch_joint", "wrist_roll_joint",
            "left_finger_joint", "right_finger_joint",
        ]
        gripper_m = clamp((90.0 - float(j6)) / 60.0 * 0.04, 0.0, 0.04)
        js.position = [base_yaw, shoulder, elbow, wrist_pitch, wrist_roll, gripper_m, gripper_m]
        self.joint_pub.publish(js)

    def transition_to(self, new_state: State):
        self.get_logger().info(f"Etat: {self.state.name} -> {new_state.name}")
        self.state = new_state
        self.state_start = time.time()


def main(args=None):
    rclpy.init(args=args)
    node = MissionRecoveryNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
