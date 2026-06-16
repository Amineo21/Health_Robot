---
title: Recipes
parent: English
nav_order: 6
---

# Code recipes
{: .no_toc }

Copy-paste snippets for the things you do most. All commands run inside the
`m3pro` container with the ROS 2 environment sourced.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Inspect the system from the command line

```bash
ros2 topic list                       # all topics
ros2 topic echo /odom --once           # one message from a topic
ros2 topic hz /scan_multi              # publish rate
ros2 topic info /cmd_vel               # type, publisher and subscriber counts
ros2 node list                         # running nodes
ros2 node info /slam_toolbox            # a node's topics and services
ros2 param list /controller_server      # a node's parameters
ros2 run tf2_ros tf2_echo map base_link  # a live transform between two frames
```

## Drive the robot

The robot listens on `/cmd_vel` (`geometry_msgs/msg/Twist`).

```bash
# One nudge forward (publishes once)
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"

# Continuous: turn in place at 5 Hz
ros2 topic pub -r 5 /cmd_vel geometry_msgs/msg/Twist "{angular: {z: 0.5}}"

# Strafe sideways - mecanum wheels only
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {y: 0.1}}"

# Stop
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{}"

# Interactive keyboard control
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

In Python:

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist

class Driver(Node):
    def __init__(self):
        super().__init__("driver")
        self.pub = self.create_publisher(Twist, "/cmd_vel", 10)
        self.create_timer(0.1, self.tick)     # 10 Hz

    def tick(self):
        msg = Twist()
        msg.linear.x = 0.1                     # 0.1 m/s forward
        self.pub.publish(msg)

rclpy.init()
rclpy.spin(Driver())
```

## Send a navigation goal

```bash
# As a topic (what RViz "2D Goal Pose" and the dashboard do)
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"

# As an action, with feedback and a result
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}}"
```

In Python, with the Nav2 helper:

```python
import rclpy
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator

rclpy.init()
nav = BasicNavigator()
nav.waitUntilNav2Active()

goal = PoseStamped()
goal.header.frame_id = "map"
goal.header.stamp = nav.get_clock().now().to_msg()
goal.pose.position.x = 1.5
goal.pose.position.y = 0.5
goal.pose.orientation.w = 1.0

nav.goToPose(goal)
while not nav.isTaskComplete():
    feedback = nav.getFeedback()       # distance remaining, etc.
print(nav.getResult())
```

## Read the map

The map is `nav_msgs/msg/OccupancyGrid` on `/map`. Each cell is `-1`
(unknown), `0` (free) or `1-100` (occupied).

```python
import rclpy
from rclpy.node import Node
from nav_msgs.msg import OccupancyGrid

class MapReader(Node):
    def __init__(self):
        super().__init__("map_reader")
        self.create_subscription(OccupancyGrid, "/map", self.on_map, 1)

    def on_map(self, msg):
        w, h = msg.info.width, msg.info.height
        free = sum(1 for c in msg.data if c == 0)
        self.get_logger().info(f"map {w}x{h}, resolution {msg.info.resolution} m, "
                               f"{free} free cells")

rclpy.init()
rclpy.spin(MapReader())
```

Pixel to world coordinates:

```python
world_x = px * info.resolution + info.origin.position.x
world_y = py * info.resolution + info.origin.position.y
```

## Save the map

```bash
# Via the slam_toolbox service
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/my_room}}"

# Via the standard map saver tool
ros2 run nav2_map_server map_saver_cli -f /root/maps/my_room
```

## Subscribe to a laser scan

```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from rclpy.qos import qos_profile_sensor_data

class ScanReader(Node):
    def __init__(self):
        super().__init__("scan_reader")
        self.create_subscription(LaserScan, "/scan_multi", self.on_scan,
                                 qos_profile_sensor_data)

    def on_scan(self, msg):
        valid = [r for r in msg.ranges if msg.range_min < r < msg.range_max]
        if valid:
            self.get_logger().info(f"nearest obstacle: {min(valid):.2f} m")

rclpy.init()
rclpy.spin(ScanReader())
```

Note the `qos_profile_sensor_data`: sensor topics use best-effort QoS, and a
default subscription would receive nothing.

## Read odometry and the robot pose

```python
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry

class PoseReader(Node):
    def __init__(self):
        super().__init__("pose_reader")
        self.create_subscription(Odometry, "/odom", self.on_odom, 10)

    def on_odom(self, msg):
        p = msg.pose.pose.position
        self.get_logger().info(f"robot at x={p.x:.2f} y={p.y:.2f}")

rclpy.init()
rclpy.spin(PoseReader())
```

For the pose **on the map**, look up the `map -> base_link` transform:

```python
from tf2_ros import Buffer, TransformListener
import rclpy
from rclpy.node import Node

class TfReader(Node):
    def __init__(self):
        super().__init__("tf_reader")
        self.buffer = Buffer()
        TransformListener(self.buffer, self)
        self.create_timer(1.0, self.tick)

    def tick(self):
        try:
            t = self.buffer.lookup_transform("map", "base_link",
                                             rclpy.time.Time())
            self.get_logger().info(f"on map: x={t.transform.translation.x:.2f}")
        except Exception as e:
            self.get_logger().warn(f"no transform yet: {e}")

rclpy.init()
rclpy.spin(TfReader())
```

## Command the arm

```bash
# Send six servo angles (degrees, 90 = centre). Topic depends on firmware.
ros2 topic pub --once /arm6_joints arm_msgs/msg/ArmJoints \
  "{joint1: 90, joint2: 120, joint3: 10, joint4: 20, joint5: 90, joint6: 30}"
```

See [Arm control](arm.html) for the full arm recipes.

## Add a static transform

Two frames not connected in TF (a common cause of "no transform" errors):

```bash
ros2 run tf2_ros static_transform_publisher \
  --x 0.091 --y 0 --z 0.093 \
  --qx 0 --qy 0 --qz 0 --qw 1 \
  --frame-id base_link --child-frame-id camera_link
```

## Record and replay data

```bash
# Record selected topics
ros2 bag record /scan_multi /odom /tf /tf_static /map -o my_run

# Inspect a recording
ros2 bag info my_run

# Replay it (other nodes see the topics as if live)
ros2 bag play my_run
```

Foxglove Studio can also record the live connection to an `.mcap` file.

## A minimal node template

```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class MyNode(Node):
    def __init__(self):
        super().__init__("my_node")
        self.pub = self.create_publisher(String, "/teacher/hello", 10)
        self.create_subscription(String, "/teacher/hello", self.on_msg, 10)
        self.create_timer(1.0, self.tick)

    def tick(self):
        msg = String()
        msg.data = "hello from my_node"
        self.pub.publish(msg)

    def on_msg(self, msg):
        self.get_logger().info(f"received: {msg.data}")

def main():
    rclpy.init()
    rclpy.spin(MyNode())
    rclpy.shutdown()

if __name__ == "__main__":
    main()
```
