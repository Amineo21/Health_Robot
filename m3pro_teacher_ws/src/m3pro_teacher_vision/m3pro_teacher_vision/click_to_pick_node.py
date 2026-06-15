#!/usr/bin/env python3
"""
Click-to-pick node using Yahboom's KDL-based IK service (/get_kinemarics).

Flow:
  1. Web UI sends pixel click on /teacher/pick_click (geometry_msgs/Point).
  2. Read depth at the pixel, transform to base_link → (bx, by, bz).
  3. Call FK service with current arm joints → get current end-effector RPY.
  4. Call IK service with target XYZ and CURRENT orientation (preserve pitch).
  5. Publish status (reachable + joint values) so the web UI shows feedback.
  6. /teacher/pick_command "grasp" triggers HOVER → DESCEND → GRASP → LIFT.

Arm-only, no base motion. Uses Yahboom's joint1 = 180 - ik_joint1 convention.
"""
import json
import math
import time
from enum import Enum, auto

import numpy as np

import rclpy
import rclpy.time
import rclpy.duration
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from geometry_msgs.msg import Point
from sensor_msgs.msg import Image, CameraInfo
from std_msgs.msg import String

try:
    from cv_bridge import CvBridge
    HAS_CVBRIDGE = True
except ImportError:
    HAS_CVBRIDGE = False

try:
    from arm_msgs.msg import ArmJoints
    HAS_ARM = True
except ImportError:
    HAS_ARM = False

try:
    from arm_interface.srv import ArmKinemarics
    HAS_KIN = True
except ImportError:
    HAS_KIN = False

from tf2_ros import Buffer, TransformListener, TransformException


class S(Enum):
    IDLE = auto()
    HOVER = auto()
    DESCEND = auto()
    GRASP = auto()
    LIFT = auto()
    HOLDING = auto()
    RELEASING = auto()
    RETURN = auto()


HOME_JOINTS = [90, 120, 10, 20, 90, 30]  # j1..j6 in SERVO space (already inverted where needed)


class ClickToPickNode(Node):
    def __init__(self):
        super().__init__("click_to_pick_node")

        # Camera intrinsics (defaults = D435, overridden by /camera/color/camera_info)
        self.fx = float(self.declare_parameter("camera_fx", 615.0).value)
        self.fy = float(self.declare_parameter("camera_fy", 615.0).value)
        self.cx_i = float(self.declare_parameter("camera_cx", 320.0).value)
        self.cy_i = float(self.declare_parameter("camera_cy", 240.0).value)
        self.depth_scale = float(self.declare_parameter("depth_scale", 0.001).value)

        # Arm command
        self.arm_topic = self.declare_parameter("arm_command_topic", "/arm6_joints").value
        self.gripper_open = int(self.declare_parameter("gripper_open_value", 30).value)
        self.gripper_close = int(self.declare_parameter("gripper_close_value", 110).value)
        self.servo_time_ms = int(self.declare_parameter("servo_time_ms", 1800).value)
        self.hover_height = float(self.declare_parameter("hover_height_m", 0.10).value)
        self.lift_height = float(self.declare_parameter("lift_height_m", 0.10).value)
        # Calibration bias applied to every IK target to compensate for URDF/physical mismatch.
        # Positive offset_x → commands further forward; positive offset_z → commands higher.
        self.offset_x = float(self.declare_parameter("target_offset_x", 0.04).value)
        self.offset_y = float(self.declare_parameter("target_offset_y", 0.00).value)
        self.offset_z = float(self.declare_parameter("target_offset_z", 0.03).value)

        # State
        self.state = S.IDLE
        self.state_enter = time.time()
        self.target_base = None         # target XYZ in base_link
        self.latest_depth = None
        self.cur_joints = list(HOME_JOINTS)  # tracks what we commanded last (servo space)
        self.last_ik_joints = None      # last IK output (URDF space, before inversion)
        self.last_ik_target = None      # last XYZ we commanded IK for
        self.locked_rpy = None          # (roll, pitch, yaw) to preserve during a pick

        # Callbacks (ReentrantCallbackGroup lets us call services from callbacks)
        self.cb_group = ReentrantCallbackGroup()

        # TF
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.bridge = CvBridge() if HAS_CVBRIDGE else None

        # Subscribers
        self.create_subscription(Point, "/teacher/pick_click", self.on_click, 1,
                                 callback_group=self.cb_group)
        self.create_subscription(String, "/teacher/pick_command", self.on_command, 1,
                                 callback_group=self.cb_group)
        # Live calibration offset from the web UI (Point carries x,y,z as meters)
        self.create_subscription(Point, "/teacher/pick_offset", self.on_offset, 1,
                                 callback_group=self.cb_group)
        self.create_subscription(Image, "/camera/depth/image_raw", self.on_depth,
                                 qos_profile_sensor_data, callback_group=self.cb_group)
        self.create_subscription(CameraInfo, "/camera/color/camera_info", self.on_cam_info,
                                 qos_profile_sensor_data, callback_group=self.cb_group)

        # Publishers
        self.status_pub = self.create_publisher(String, "/teacher/pick_status", 10)
        self.arm_pub = self.create_publisher(ArmJoints, self.arm_topic, 10) if HAS_ARM else None

        # Kinematics client
        self.kin_client = self.create_client(
            ArmKinemarics, "/get_kinemarics", callback_group=self.cb_group,
        ) if HAS_KIN else None
        if self.kin_client is None:
            self.get_logger().error("arm_interface not available — IK won't work")

        # State machine tick
        self.create_timer(0.3, self.tick, callback_group=self.cb_group)

        self.get_logger().info(
            f"click_to_pick ready. cv_bridge={HAS_CVBRIDGE} arm_msgs={HAS_ARM} "
            f"kin={HAS_KIN} arm_topic={self.arm_topic}"
        )
        self.publish_status(extra={"msg": "ready"})

    # ======================= Callbacks =======================
    def on_cam_info(self, msg: CameraInfo):
        k = list(msg.k)
        if k[0] > 0 and k[4] > 0 and abs(k[0] - self.fx) > 1.0:
            self.fx, self.fy = float(k[0]), float(k[4])
            self.cx_i, self.cy_i = float(k[2]), float(k[5])
            self.get_logger().info(
                f"camera intrinsics: fx={self.fx:.1f} cx={self.cx_i:.1f} cy={self.cy_i:.1f}"
            )

    def on_depth(self, msg: Image):
        if not HAS_CVBRIDGE:
            return
        try:
            self.latest_depth = self.bridge.imgmsg_to_cv2(msg, desired_encoding="passthrough")
        except Exception as e:
            self.get_logger().warning(f"depth bridge error: {e}")

    def on_click(self, msg: Point):
        u, v = int(msg.x), int(msg.y)
        if self.latest_depth is None:
            self.publish_status(extra={"msg": "no depth image yet", "pixel": [u, v]})
            return
        d = self._read_depth(u, v)
        if d is None:
            self.publish_status(extra={"msg": "no valid depth at pixel", "pixel": [u, v]})
            return

        # Camera optical frame → base_link
        cx3 = (u - self.cx_i) / self.fx * d
        cy3 = (v - self.cy_i) / self.fy * d
        cz3 = d
        try:
            tf = self.tf_buffer.lookup_transform(
                "base_link", "camera_color_optical_frame",
                rclpy.time.Time(),
                timeout=rclpy.duration.Duration(seconds=0.5),
            )
        except TransformException as e:
            self.publish_status(extra={"msg": f"tf fail: {e}", "pixel": [u, v]})
            return
        t, q = tf.transform.translation, tf.transform.rotation
        rx, ry, rz = self._quat_rotate(q.x, q.y, q.z, q.w, cx3, cy3, cz3)
        bx, by, bz = rx + t.x, ry + t.y, rz + t.z
        self.target_base = (bx, by, bz)

        # Find a reachable pitch for this target. KDL returns joints even for
        # unreachable targets, but some come back outside [0,180]. Search.
        joints, pitch = self._find_reachable_ik(bx, by, bz)
        reachable = joints is not None

        fk_verified = None
        err_mm = None
        if reachable:
            self.locked_rpy = (0.0, pitch, 0.0)
            self.last_ik_joints = joints[:]
            self.last_ik_target = (bx, by, bz)
            fk = self._fk(joints)
            if fk:
                fk_verified = [round(fk[0], 3), round(fk[1], 3), round(fk[2], 3)]
                err_mm = int(math.sqrt((fk[0]-bx)**2 + (fk[1]-by)**2 + (fk[2]-bz)**2) * 1000)

        extra = {
            "msg": "target acquired" if reachable else "target not reachable",
            "pixel": [u, v],
            "target": [round(bx, 3), round(by, 3), round(bz, 3)],
            "depth": round(d, 3),
            "reachable": reachable,
        }
        if reachable:
            extra["pitch_deg"] = round(math.degrees(pitch), 1)
            extra["joints"] = [int(j) for j in joints[:5]]
            extra["fk_verified"] = fk_verified
            extra["err_mm"] = err_mm
        self.publish_status(extra=extra)
        self.get_logger().info(
            f"click ({u},{v}) d={d:.3f} → base({bx:.3f},{by:.3f},{bz:.3f}) "
            f"reach={reachable}"
            + (f" pitch={math.degrees(pitch):.0f}° fk=({fk_verified[0]},{fk_verified[1]},{fk_verified[2]}) err={err_mm}mm"
               if reachable and fk_verified else "")
        )

    def on_offset(self, msg: Point):
        """Live calibration offset (meters) in base_link frame."""
        self.offset_x = float(msg.x)
        self.offset_y = float(msg.y)
        self.offset_z = float(msg.z)
        self.get_logger().info(
            f"calibration offset updated: x={self.offset_x:+.3f} y={self.offset_y:+.3f} z={self.offset_z:+.3f}"
        )
        self.publish_status(extra={"offset": [self.offset_x, self.offset_y, self.offset_z]})

    def on_command(self, msg: String):
        cmd = msg.data.strip().lower()
        self.get_logger().info(f"cmd: {cmd} (state={self.state.name})")
        if cmd == "grasp":
            if self.target_base is None or self.locked_rpy is None:
                self.publish_status(extra={"msg": "click a reachable target first"})
                return
            if self.state not in (S.IDLE, S.HOLDING):
                self.publish_status(extra={"msg": f"busy in {self.state.name}"})
                return
            self.transition(S.HOVER)
        elif cmd == "release":
            if self.state == S.HOLDING:
                self.transition(S.RELEASING)
        elif cmd == "home":
            self.transition(S.RETURN)
        elif cmd == "stop":
            self._send_servos(HOME_JOINTS)
            self.state = S.IDLE
            self.target_base = None
            self.locked_rpy = None
            self.publish_status(extra={"msg": "stopped"})

    # ======================= State machine =======================
    STATE_DURATIONS = {
        S.HOVER:     2.5,
        S.DESCEND:   2.2,
        S.GRASP:     1.8,
        S.LIFT:      2.2,
        S.RELEASING: 1.5,
        S.RETURN:    2.5,
    }

    def tick(self):
        if self.state == S.IDLE or self.state == S.HOLDING:
            return
        if time.time() - self.state_enter > self.STATE_DURATIONS.get(self.state, 2.0):
            self._advance_state()

    def _advance_state(self):
        nxt = {
            S.HOVER: S.DESCEND, S.DESCEND: S.GRASP, S.GRASP: S.LIFT,
            S.LIFT: S.HOLDING, S.RELEASING: S.RETURN, S.RETURN: S.IDLE,
        }.get(self.state, S.IDLE)
        self.transition(nxt)

    def transition(self, new_state):
        self.get_logger().info(f"state {self.state.name} -> {new_state.name}")
        self.state = new_state
        self.state_enter = time.time()
        self._enter_state()
        self.publish_status()

    def _enter_state(self):
        tb = self.target_base
        s = self.state
        if s == S.HOVER and tb is not None:
            self._go_to(tb[0], tb[1], tb[2] + self.hover_height, self.gripper_open, "HOVER")
        elif s == S.DESCEND and tb is not None:
            self._go_to(tb[0], tb[1], tb[2], self.gripper_open, "DESCEND")
        elif s == S.GRASP and tb is not None:
            self._go_to(tb[0], tb[1], tb[2], self.gripper_close, "GRASP")
        elif s == S.LIFT and tb is not None:
            self._go_to(tb[0], tb[1], tb[2] + self.lift_height, self.gripper_close, "LIFT")
        elif s == S.HOLDING:
            self.publish_status(extra={"msg": "holding — press RELEASE or HOME"})
        elif s == S.RELEASING and tb is not None:
            self._go_to(tb[0], tb[1], tb[2] + self.lift_height, self.gripper_open, "RELEASE")
        elif s == S.RETURN:
            self._send_servos(HOME_JOINTS)
            self.publish_status(extra={"msg": "returning home"})
        elif s == S.IDLE:
            self.target_base = None
            self.locked_rpy = None
            self.publish_status(extra={"msg": "idle — click a new target"})

    def _go_to(self, x, y, z, gripper, label):
        if self.locked_rpy is None:
            self.get_logger().warning(f"{label}: no locked RPY")
            return

        # Apply calibration bias (URDF ≠ physical arm)
        x_cmd = x + self.offset_x
        y_cmd = y + self.offset_y
        z_cmd = z + self.offset_z

        # 1. Where do we THINK we are right now? (FK on last-commanded IK joints)
        fk_now = self._fk(self.last_ik_joints) if self.last_ik_joints else None
        now_str = (f"({fk_now[0]:.3f},{fk_now[1]:.3f},{fk_now[2]:.3f})" if fk_now else "unknown")

        # 2. Solve IK for the bias-adjusted target (with fallback pitches)
        roll, pitch, yaw = self.locked_rpy
        joints = None
        used_pitch = pitch
        for dp in (0.0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45):
            cand = self._ik(x_cmd, y_cmd, z_cmd, roll, pitch + dp, yaw)
            if cand is not None and all(0 <= v <= 180 for v in cand[:5]):
                joints = cand
                used_pitch = pitch + dp
                break
        if joints is None:
            self.get_logger().warning(
                f"{label}: no valid IK at cmd=({x_cmd:.3f},{y_cmd:.3f},{z_cmd:.3f}) "
                f"pitch∈{math.degrees(pitch):.0f}±25° — abort"
            )
            self.publish_status(extra={"msg": f"{label} unreachable — aborting"})
            self._send_servos(HOME_JOINTS)
            self.state = S.IDLE
            return

        # 3. Verify: FK on the IK joints should reproduce (x_cmd, y_cmd, z_cmd)
        fk_target = self._fk(joints)
        err = (
            math.sqrt(sum((a - b) ** 2 for a, b in zip(fk_target[:3], (x_cmd, y_cmd, z_cmd))))
            if fk_target else None
        )

        # 4. Convert URDF-space IK to Yahboom servo space (joint1 is INVERTED)
        servos = [
            180 - int(joints[0]),
            int(joints[1]),
            int(joints[2]),
            int(joints[3]),
            90,              # wrist roll locked
            int(gripper),
        ]
        servos = [max(0, min(180, s)) for s in servos]

        self.get_logger().info(
            f"{label}: now={now_str} target=({x:.3f},{y:.3f},{z:.3f}) "
            f"pitch={math.degrees(used_pitch):.0f}° ik={[int(j) for j in joints[:5]]} "
            + (f"fk_ok=({fk_target[0]:.3f},{fk_target[1]:.3f},{fk_target[2]:.3f}) err={err*1000:.0f}mm "
               if fk_target else "")
            + f"sent={servos[:5]} grip={servos[5]}"
        )

        # 5. Sanity: if IK→FK error is huge, something is wrong — abort
        if err is not None and err > 0.03:
            self.get_logger().warning(
                f"{label}: IK/FK inconsistent (err={err*1000:.0f}mm) — aborting"
            )
            self.publish_status(extra={"msg": f"{label} IK/FK mismatch {err*1000:.0f}mm"})
            self._send_servos(HOME_JOINTS)
            self.state = S.IDLE
            return

        self.last_ik_joints = joints[:]
        self.last_ik_target = (x, y, z)
        self.publish_status(extra={
            "msg": label,
            "waypoint": [round(x, 3), round(y, 3), round(z, 3)],
            "fk_verified": [round(fk_target[0], 3), round(fk_target[1], 3), round(fk_target[2], 3)] if fk_target else None,
            "err_mm": int(err * 1000) if err is not None else None,
            "servos": servos[:5],
        })
        self._send_servos(servos)

    # ======================= IK helpers =======================
    def _ik(self, x, y, z, roll, pitch, yaw):
        """Synchronous IK call. Returns [j1..j5] in SERVO degrees from KDL (not inverted), or None."""
        if self.kin_client is None or not self.kin_client.wait_for_service(timeout_sec=0.3):
            return None
        req = ArmKinemarics.Request()
        req.kin_name = "ik"
        req.tar_x = float(x); req.tar_y = float(y); req.tar_z = float(z)
        req.roll = float(roll); req.pitch = float(pitch); req.yaw = float(yaw)
        fut = self.kin_client.call_async(req)
        t0 = time.time()
        while not fut.done() and time.time() - t0 < 1.0:
            time.sleep(0.01)
        if not fut.done():
            return None
        r = fut.result()
        return [r.joint1, r.joint2, r.joint3, r.joint4, r.joint5]

    def _fk(self, joints_urdf):
        """Synchronous FK call. joints_urdf is [j1..j5] in URDF-space servo degrees.
        Returns (x, y, z, roll, pitch, yaw) or None."""
        if self.kin_client is None or joints_urdf is None:
            return None
        if not self.kin_client.wait_for_service(timeout_sec=0.3):
            return None
        req = ArmKinemarics.Request()
        req.kin_name = "fk"
        req.cur_joint1 = float(joints_urdf[0])
        req.cur_joint2 = float(joints_urdf[1])
        req.cur_joint3 = float(joints_urdf[2])
        req.cur_joint4 = float(joints_urdf[3])
        req.cur_joint5 = float(joints_urdf[4]) if len(joints_urdf) > 4 else 90.0
        req.cur_joint6 = 30.0
        fut = self.kin_client.call_async(req)
        t0 = time.time()
        while not fut.done() and time.time() - t0 < 1.0:
            time.sleep(0.01)
        if not fut.done():
            return None
        r = fut.result()
        return (r.x, r.y, r.z, r.roll, r.pitch, r.yaw)

    def _find_reachable_ik(self, x, y, z):
        """Search pitch from 0 (horizontal) to ~100° (past vertical) for a valid solution.
        Returns (joints_list, pitch_rad) or (None, None)."""
        # Sweep pitch: 0° (forward) → 30° → 60° → 90° (down).
        # The arm home orientation is pitch≈30°, so start there for grasps that
        # don't need to go deep. For low targets, larger pitch is needed.
        for deg in (30, 45, 60, 15, 75, 0, 90):
            rad = math.radians(deg)
            j = self._ik(x, y, z, 0.0, rad, 0.0)
            if j is None:
                continue
            if all(0 <= v <= 180 for v in j[:5]):
                return j, rad
        return None, None

    # ======================= Low-level =======================
    def _send_servos(self, servos6):
        """servos6 = [j1..j6] in servo degrees (already Yahboom-inverted where needed)."""
        if self.arm_pub is None:
            self.get_logger().info(f"[dry] arm {servos6}")
            return
        m = ArmJoints()
        m.joint1, m.joint2, m.joint3, m.joint4, m.joint5, m.joint6 = [int(s) for s in servos6]
        m.time = self.servo_time_ms
        self.arm_pub.publish(m)
        self.cur_joints = list(servos6)

    def _read_depth(self, u, v):
        d = self.latest_depth
        if d is None:
            return None
        H, W = d.shape[:2]
        if u < 0 or u >= W or v < 0 or v >= H:
            return None
        u0, u1 = max(0, u - 2), min(W, u + 3)
        v0, v1 = max(0, v - 2), min(H, v + 3)
        patch = d[v0:v1, u0:u1].astype(np.float32)
        patch = patch[patch > 0]
        if patch.size == 0:
            return None
        return float(np.median(patch)) * self.depth_scale

    @staticmethod
    def _quat_rotate(qx, qy, qz, qw, px, py, pz):
        rx = px + 2.0 * (-(qy*qy + qz*qz)*px + (qx*qy - qw*qz)*py + (qx*qz + qw*qy)*pz)
        ry = py + 2.0 * ((qx*qy + qw*qz)*px - (qx*qx + qz*qz)*py + (qy*qz - qw*qx)*pz)
        rz = pz + 2.0 * ((qx*qz - qw*qy)*px + (qy*qz + qw*qx)*py - (qx*qx + qy*qy)*pz)
        return rx, ry, rz

    def publish_status(self, extra=None):
        payload = {"state": self.state.name}
        if self.target_base is not None:
            payload["target_base"] = [round(v, 3) for v in self.target_base]
        if extra:
            payload.update(extra)
        msg = String()
        msg.data = json.dumps(payload)
        self.status_pub.publish(msg)


def main():
    rclpy.init()
    node = ClickToPickNode()
    # MultiThreadedExecutor allows service calls to resolve while other callbacks run.
    executor = MultiThreadedExecutor(num_threads=4)
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            node.destroy_node()
        except Exception:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
