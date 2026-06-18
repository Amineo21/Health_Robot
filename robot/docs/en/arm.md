---
title: Arm control
parent: English
nav_order: 3
---

# Controlling the 6-axis arm
{: .no_toc }

Move the arm, visualize it, and pick up objects the camera sees.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

> **Safety first.** The arm is only powered with instructor authorization.
> Keep hands and cables clear of its full reach. Test logic in dry-run mode
> (see below) before driving the real servos.

## How the arm is built

The M3 Pro arm has **six servos**. Each servo takes an angle from `0` to
`180` degrees, where `90` is the centre position.

| Servo | Joint | Movement |
| --- | --- | --- |
| 1 | `base_yaw_joint` | Rotates the whole arm left/right. |
| 2 | `shoulder_joint` | Raises/lowers the upper arm. |
| 3 | `elbow_joint` | Bends the forearm. |
| 4 | `wrist_pitch_joint` | Tilts the wrist up/down. |
| 5 | `wrist_roll_joint` | Rotates the gripper. |
| 6 | gripper | Opens/closes the fingers. |

A safe resting pose ("home") in servo degrees is:

```text
[ j1=90, j2=120, j3=10, j4=20, j5=90, j6=30 ]
        base  shoulder elbow wrist  roll  gripper(open)
```

The gripper opens near `30` and closes on an object near `75` to `90`.

## Two ways radians and degrees relate

The robot firmware speaks **servo degrees** (0 to 180, 90 = centre). ROS and
URDF speak **radians** (0 = centre). The conversion is:

```python
radians = math.radians(servo_degrees - 90)      # degrees -> radians
servo_degrees = math.degrees(radians) + 90      # radians -> degrees
```

## Recipe 1: Visualize the arm in RViz

The `arm_joint_state_bridge_demo` node turns raw arm angles into a standard
`JointState` message so RViz can draw the URDF model.

```bash
ros2 run m3pro_teacher_demos arm_joint_state_bridge_demo
```

It subscribes to the arm topic (`/arm6_joints`, `arm_msgs/ArmJoints`) and
publishes `/teacher/joint_states`. Add a **RobotModel** and **TF** display in
RViz to watch the arm move in 3D.

Set `demo_motion:=true` to make it animate a slow sweep with no real
hardware, useful to check the URDF:

```bash
ros2 run m3pro_teacher_demos arm_joint_state_bridge_demo --ros-args -p demo_motion:=true
```

## Recipe 2: Send the arm to a pose

The arm is commanded with an `arm_msgs/ArmJoints` message: six servo angles
in degrees. The exact topic depends on the robot firmware and is set by the
`arm_command_topic` parameter in `detection_params.yaml`.

```python
# Minimal node: send the arm to home, then close the gripper.
import rclpy
from rclpy.node import Node
from arm_msgs.msg import ArmJoints

class ArmPose(Node):
    def __init__(self):
        super().__init__("arm_pose")
        self.pub = self.create_publisher(ArmJoints, "/arm6_joints", 10)
        self.create_timer(1.0, self.tick)
        self.step = 0

    def tick(self):
        msg = ArmJoints()
        msg.joint1, msg.joint2, msg.joint3 = 90, 120, 10
        msg.joint4, msg.joint5 = 20, 90
        msg.joint6 = 30 if self.step == 0 else 80   # open, then close
        self.pub.publish(msg)
        self.get_logger().info(f"sent gripper={msg.joint6}")
        self.step += 1

rclpy.init()
rclpy.spin(ArmPose())
```

> **Dry run.** If the `arm_msgs` package is not installed, the course pick
> nodes print `[DRY RUN] Would send arm: [...]` instead of moving servos.
> This lets you test the logic safely. Install `arm_msgs` to drive the real
> arm.

## Recipe 3: Click to pick (arm only)

`click_pick.launch.py` lets you pick an object by **clicking it in a browser
photo**. The base does not move; only the arm.

**Step 1.** Make sure the hardware bringup and the camera are running.

```bash
ros2 launch slam_mapping bringup.launch.py        # Layer 2
ros2 launch slam_mapping app_camera.launch.py     # camera
```

**Step 2.** Start the click-to-pick stack.

```bash
ros2 launch m3pro_teacher_vision click_pick.launch.py
```

This starts the `click_to_pick_node`, Yahboom's KDL inverse-kinematics
service (`/get_kinemarics`), a web server and rosbridge.

**Step 3.** Open `http://<robot-ip>:8080/pick.html` in a browser. Click on
the object in the camera image. The node:

1. Reads the depth at that pixel and transforms it into the `base_link`
   frame.
2. Calls the IK service to find joint angles that reach the point.
3. Shows whether the point is reachable.
4. On the **grasp** command, runs `HOVER -> DESCEND -> GRASP -> LIFT`.

## Recipe 4: Detect a color and pick it autonomously

`detect_and_pick.launch.py` runs the full vision-to-arm pipeline: detect an
object by color, drive to it, and pick it up.

```bash
# Full pipeline: detection + depth obstacle scan + arm pickup
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py

# Detection only, no arm or base motion (safe for tuning)
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py pick:=false
```

The `pick_and_place_node` runs a state machine:

```text
IDLE -> APPROACH -> REACH -> GRASP -> LIFT -> DONE -> IDLE
        drive to    deploy   close    raise
        the object  the arm  gripper
```

The detector publishes detected objects on `/teacher/detections`
(`PoseArray`), markers on `/teacher/detection_markers`, and an annotated
image on `/teacher/detection_image`.

### Tuning color detection

The detector finds objects by **HSV color range**, set in
`m3pro_teacher_vision/config/detection_params.yaml`. The defaults match red:

```yaml
object_detector_node:
  ros__parameters:
    hsv_low_1:  [0,   120, 70]      # red wraps both ends of the hue circle
    hsv_high_1: [10,  255, 255]
    hsv_low_2:  [170, 120, 70]
    hsv_high_2: [180, 255, 255]
    min_contour_area: 500           # ignore blobs smaller than 500 px2
```

For other colors:

| Color | Hue (H) | Saturation (S) | Value (V) |
| --- | --- | --- | --- |
| Green | 35 to 85 | above 100 | above 70 |
| Blue | 100 to 130 | above 120 | above 70 |
| Yellow | 20 to 35 | above 100 | above 100 |

### How the position is computed

The detector finds the object centre in the image, reads the depth there,
and back-projects it to 3D with the pin-hole camera model:

```python
x_3d = (cx_px - cx) / fx * z      # z is the measured depth
y_3d = (cy_px - cy) / fy * z
```

The result is published in the camera frame. `pick_and_place_node` then uses
TF2 to convert it into `base_link`, and solves a 2-segment inverse
kinematics (law of cosines) for the shoulder and elbow angles.

## Where to next

- [Integration](integration.html) - navigate to an object, then pick it.
- [Recipes](recipes.html) - more arm and vision code snippets.
