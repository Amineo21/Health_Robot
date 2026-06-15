#!/usr/bin/env python3
import math
from typing import Dict, Iterable, List, Optional, Tuple

import rclpy
from rclpy.duration import Duration
from rclpy.node import Node
from rclpy.time import Time
from sensor_msgs.msg import Image, LaserScan
from std_msgs.msg import ColorRGBA, String, UInt16
from tf2_ros import Buffer, TransformException, TransformListener


def finite_ranges(scan: LaserScan) -> Iterable[Tuple[float, float]]:
    angle = float(scan.angle_min)
    step = float(scan.angle_increment)
    for value in scan.ranges:
        if math.isfinite(value) and scan.range_min <= value <= scan.range_max:
            yield angle, float(value)
        angle += step


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def yaw_from_quaternion(x: float, y: float, z: float, w: float) -> float:
    siny_cosp = 2.0 * (w * z + x * y)
    cosy_cosp = 1.0 - 2.0 * (y * y + z * z)
    return math.atan2(siny_cosp, cosy_cosp)


class SensorFusionRgbDemo(Node):
    """Merge lidar scans (TF-aware) and react through RGB based on proximity + camera color."""

    def __init__(self) -> None:
        super().__init__("sensor_fusion_rgb_demo")
        self.simulate = bool(self.declare_parameter("simulate", False).value)
        # base_footprint matches slam_toolbox's configured base_frame.
        self.base_frame = self.declare_parameter("base_frame", "base_footprint").value

        default_front = "/teacher/sim/scan0" if self.simulate else "/scan0"
        default_rear = "/teacher/sim/scan1" if self.simulate else "/scan1"
        default_camera = "/teacher/sim/camera" if self.simulate else "/camera/color/image_raw"

        self.front_scan_topic = self.declare_parameter("front_scan_topic", default_front).value
        self.rear_scan_topic = self.declare_parameter("rear_scan_topic", default_rear).value
        self.camera_topic = self.declare_parameter("camera_topic", default_camera).value
        self.danger_distance_m = float(self.declare_parameter("danger_distance_m", 0.35).value)
        self.caution_distance_m = float(self.declare_parameter("caution_distance_m", 0.80).value)
        self.enable_beep = bool(self.declare_parameter("enable_beep", False).value)

        self.latest_scans: Dict[str, LaserScan] = {}
        self.latest_camera: Optional[Image] = None
        self.last_beep_time = self.get_clock().now()
        self.beep_is_on = False
        self.sim_phase = 0.0

        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        # frame_id -> (tx, ty, yaw) in base_frame. Static transforms, cached after first lookup.
        self.sensor_pose_cache: Dict[str, Tuple[float, float, float]] = {}

        self.merged_scan_pub = self.create_publisher(LaserScan, "/teacher/scan_merged", 10)
        self.state_pub = self.create_publisher(String, "/teacher/fusion_state", 10)
        self.rgb_pub = self.create_publisher(ColorRGBA, "/rgb", 10)
        self.beep_pub = self.create_publisher(UInt16, "/beep", 10)

        self.create_subscription(LaserScan, self.front_scan_topic, lambda msg: self.store_scan("front", msg), 10)
        self.create_subscription(LaserScan, self.rear_scan_topic, lambda msg: self.store_scan("rear", msg), 10)
        self.create_subscription(Image, self.camera_topic, self.store_camera, 10)

        if self.simulate:
            self.sim_front_pub = self.create_publisher(LaserScan, self.front_scan_topic, 10)
            self.sim_rear_pub = self.create_publisher(LaserScan, self.rear_scan_topic, 10)
            self.sim_camera_pub = self.create_publisher(Image, self.camera_topic, 10)
            self.create_timer(0.12, self.publish_simulated_sensors)

        self.create_timer(0.20, self.fuse_and_react)
        self.get_logger().info("Sensor fusion demo started")
        self.get_logger().info(
            f"front={self.front_scan_topic} rear={self.rear_scan_topic} "
            f"camera={self.camera_topic} simulate={self.simulate}"
        )

    def store_scan(self, name: str, msg: LaserScan) -> None:
        self.latest_scans[name] = msg

    def store_camera(self, msg: Image) -> None:
        self.latest_camera = msg

    def publish_simulated_sensors(self) -> None:
        self.sim_phase += 0.12
        front_obstacle = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(self.sim_phase * 0.7))
        rear_obstacle = 0.40 + 0.95 * (0.5 + 0.5 * math.cos(self.sim_phase * 0.5))
        self.sim_front_pub.publish(self.make_fake_scan("scan0_frame", front_obstacle, math.sin(self.sim_phase) * 0.45))
        self.sim_rear_pub.publish(self.make_fake_scan("scan1_frame", rear_obstacle, math.cos(self.sim_phase) * 0.45))
        self.sim_camera_pub.publish(self.make_fake_image())

    def make_fake_scan(self, frame_id: str, obstacle_distance: float, obstacle_angle: float) -> LaserScan:
        msg = LaserScan()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = frame_id
        msg.angle_min = -math.pi / 2.0
        msg.angle_max = math.pi / 2.0
        msg.angle_increment = math.radians(1.0)
        msg.time_increment = 0.0
        msg.scan_time = 0.12
        msg.range_min = 0.08
        msg.range_max = 3.5
        count = int(round((msg.angle_max - msg.angle_min) / msg.angle_increment)) + 1
        ranges: List[float] = [2.8 for _ in range(count)]
        center = int(round((obstacle_angle - msg.angle_min) / msg.angle_increment))
        for offset in range(-4, 5):
            index = center + offset
            if 0 <= index < count:
                ranges[index] = obstacle_distance + abs(offset) * 0.025
        msg.ranges = ranges
        return msg

    def make_fake_image(self) -> Image:
        width = 40
        height = 30
        red = int(60 + 120 * (0.5 + 0.5 * math.sin(self.sim_phase * 0.8)))
        green = int(80 + 130 * (0.5 + 0.5 * math.sin(self.sim_phase * 0.6 + 1.0)))
        blue = int(50 + 150 * (0.5 + 0.5 * math.cos(self.sim_phase * 0.5)))

        msg = Image()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "camera_color_optical_frame"
        msg.height = height
        msg.width = width
        msg.encoding = "rgb8"
        msg.is_bigendian = 0
        msg.step = width * 3
        msg.data = bytes([red, green, blue]) * (width * height)
        return msg

    def fuse_and_react(self) -> None:
        self.stop_beep_if_needed()

        scan_sources: List[Tuple[str, LaserScan]] = []
        if "front" in self.latest_scans:
            scan_sources.append(("front", self.latest_scans["front"]))
        if "rear" in self.latest_scans:
            scan_sources.append(("rear", self.latest_scans["rear"]))

        if not scan_sources:
            self.publish_state("waiting for lidar scans")
            self.publish_rgb(0.0, 120.0, 255.0, 100.0)
            return

        merged, nearest = self.merge_scans(scan_sources)
        if merged is None:
            self.publish_state("waiting for sensor TF")
            self.publish_rgb(0.0, 120.0, 255.0, 100.0)
            return
        self.merged_scan_pub.publish(merged)

        camera_summary = self.analyze_camera(self.latest_camera)
        color, reason = self.choose_reaction(nearest, camera_summary)
        self.publish_rgb(*color)

        if self.enable_beep and nearest is not None and nearest < self.danger_distance_m:
            self.pulse_beep()

        nearest_text = "none" if nearest is None else f"{nearest:.2f}m"
        self.publish_state(f"nearest={nearest_text}; camera={camera_summary}; rgb={reason}")

    def get_sensor_pose(self, frame_id: str) -> Optional[Tuple[float, float, float]]:
        """Look up (tx, ty, yaw) of `frame_id` in base_frame. Cached (static transforms)."""
        if frame_id in self.sensor_pose_cache:
            return self.sensor_pose_cache[frame_id]
        try:
            # Time() asks for the latest available — safe because sensor-to-base is static
            # and the microcontroller clock can lag the system clock.
            tf = self.tf_buffer.lookup_transform(
                self.base_frame, frame_id, Time(), timeout=Duration(seconds=0.1)
            )
        except TransformException as err:
            self.get_logger().warn(
                f"TF {self.base_frame} <- {frame_id} not yet available: {err}",
                throttle_duration_sec=2.0,
            )
            return None
        t = tf.transform.translation
        q = tf.transform.rotation
        pose = (float(t.x), float(t.y), yaw_from_quaternion(q.x, q.y, q.z, q.w))
        self.sensor_pose_cache[frame_id] = pose
        self.get_logger().info(
            f"Cached sensor pose in {self.base_frame}: {frame_id} "
            f"tx={pose[0]:.3f} ty={pose[1]:.3f} yaw={pose[2]:.3f}"
        )
        return pose

    def merge_scans(
        self, scan_sources: List[Tuple[str, LaserScan]]
    ) -> Tuple[Optional[LaserScan], Optional[float]]:
        """Merge raw scans into a 360-degree LaserScan centered on base_frame.

        Each input ray (angle, distance) is converted to a Cartesian endpoint in
        base_frame using the sensor's full pose (translation + rotation) from TF,
        then re-expressed in polar relative to base_frame. Ignoring the translation
        corrupts the merged scan when the lidars are offset from the robot origin
        (here: +/-0.17 m along X) and causes SLAM scan-matching to fail in featureless
        corridors (symptom: straight hallways map as a V/hinge).
        """
        angle_min = -math.pi
        angle_max = math.pi
        angle_increment = math.radians(1.0)
        count = int(round((angle_max - angle_min) / angle_increment)) + 1
        merged_ranges: List[float] = [float("inf") for _ in range(count)]
        nearest: Optional[float] = None

        # Use the latest input scan timestamp so it matches the odometry TF
        # (the microcontroller clock may differ from the system clock).
        latest_stamp = scan_sources[0][1].header.stamp
        contributed = 0
        for _name, scan in scan_sources:
            if (scan.header.stamp.sec, scan.header.stamp.nanosec) > (latest_stamp.sec, latest_stamp.nanosec):
                latest_stamp = scan.header.stamp

            pose = self.get_sensor_pose(scan.header.frame_id)
            if pose is None:
                continue
            tx, ty, psi = pose
            contributed += 1

            for angle, distance in finite_ranges(scan):
                x = tx + distance * math.cos(angle + psi)
                y = ty + distance * math.sin(angle + psi)
                merged_distance = math.hypot(x, y)
                merged_angle = math.atan2(y, x)
                index = int(round((merged_angle - angle_min) / angle_increment))
                if 0 <= index < count and merged_distance < merged_ranges[index]:
                    merged_ranges[index] = merged_distance
                if nearest is None or merged_distance < nearest:
                    nearest = merged_distance

        if contributed == 0:
            return None, None

        msg = LaserScan()
        msg.header.stamp = latest_stamp
        msg.header.frame_id = self.base_frame
        msg.angle_min = angle_min
        msg.angle_max = angle_max
        msg.angle_increment = angle_increment
        msg.time_increment = 0.0
        msg.scan_time = 0.2
        msg.range_min = 0.08
        msg.range_max = 3.5
        msg.ranges = [r if math.isfinite(r) else msg.range_max for r in merged_ranges]
        return msg, nearest

    def analyze_camera(self, msg: Optional[Image]) -> str:
        if msg is None or not msg.data:
            return "no camera"

        encoding = msg.encoding.lower()
        channels = 3
        order = "rgb"
        if encoding in ("mono8", "8uc1"):
            channels = 1
        elif encoding in ("rgba8", "bgra8"):
            channels = 4
            order = "rgb" if encoding == "rgba8" else "bgr"
        elif encoding == "bgr8":
            order = "bgr"
        elif encoding != "rgb8":
            return f"camera encoding {msg.encoding}"

        data = msg.data
        sample_count = 0
        red_total = 0
        green_total = 0
        blue_total = 0
        stride = max(channels, int(len(data) / 600) * channels)

        for index in range(0, len(data) - channels + 1, stride):
            if channels == 1:
                value = data[index]
                red = green = blue = value
            else:
                first = data[index]
                second = data[index + 1]
                third = data[index + 2]
                if order == "rgb":
                    red, green, blue = first, second, third
                else:
                    blue, green, red = first, second, third
            red_total += red
            green_total += green
            blue_total += blue
            sample_count += 1

        if sample_count == 0:
            return "camera empty"

        red_avg = red_total / sample_count
        green_avg = green_total / sample_count
        blue_avg = blue_total / sample_count
        brightness = (red_avg + green_avg + blue_avg) / 3.0

        if brightness < 45:
            return "dark"
        if red_avg > green_avg * 1.25 and red_avg > blue_avg * 1.25:
            return "red dominant"
        if green_avg > red_avg * 1.20 and green_avg > blue_avg * 1.20:
            return "green dominant"
        if blue_avg > red_avg * 1.20 and blue_avg > green_avg * 1.20:
            return "blue dominant"
        if brightness > 170:
            return "bright"
        return "balanced"

    def choose_reaction(self, nearest: Optional[float], camera_summary: str) -> Tuple[Tuple[float, float, float, float], str]:
        if nearest is not None and nearest < self.danger_distance_m:
            return (255.0, 0.0, 0.0, 100.0), "lidar danger"
        if nearest is not None and nearest < self.caution_distance_m:
            return (255.0, 210.0, 0.0, 100.0), "lidar caution"
        if camera_summary == "red dominant":
            return (255.0, 0.0, 0.0, 100.0), "camera red"
        if camera_summary == "green dominant":
            return (0.0, 255.0, 0.0, 100.0), "camera green"
        if camera_summary == "blue dominant":
            return (0.0, 90.0, 255.0, 100.0), "camera blue"
        if camera_summary == "bright":
            return (255.0, 255.0, 255.0, 100.0), "camera bright"
        if camera_summary == "dark":
            return (0.0, 150.0, 255.0, 100.0), "camera dark"
        return (0.0, 255.0, 90.0, 100.0), "clear"

    def publish_rgb(self, r: float, g: float, b: float, a: float) -> None:
        msg = ColorRGBA()
        msg.r = float(clamp(r, 0.0, 255.0))
        msg.g = float(clamp(g, 0.0, 255.0))
        msg.b = float(clamp(b, 0.0, 255.0))
        msg.a = float(a)
        self.rgb_pub.publish(msg)

    def publish_state(self, text: str) -> None:
        msg = String()
        msg.data = text
        self.state_pub.publish(msg)

    def pulse_beep(self) -> None:
        now = self.get_clock().now()
        if (now - self.last_beep_time).nanoseconds < 1_000_000_000:
            return
        msg = UInt16()
        msg.data = 1
        self.beep_pub.publish(msg)
        self.beep_is_on = True
        self.last_beep_time = now

    def stop_beep_if_needed(self) -> None:
        if not self.beep_is_on:
            return
        if (self.get_clock().now() - self.last_beep_time).nanoseconds < 100_000_000:
            return
        msg = UInt16()
        msg.data = 0
        self.beep_pub.publish(msg)
        self.beep_is_on = False


def main() -> None:
    rclpy.init()
    node = SensorFusionRgbDemo()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            node.destroy_node()
        except KeyboardInterrupt:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
