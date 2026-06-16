---
title: Integration
parent: English
nav_order: 4
---

# Putting it all together
{: .no_toc }

Run mapping, navigation, vision and the arm as one system: map a room,
drive to an object, and pick it up.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## The full system

```text
            +-----------------------------------------------+
            |                 Layer 3: apps                 |
            |  SLAM   Nav2   object detector   arm pick      |
            +-----------------------------------------------+
              ^         ^            ^               ^
        /scan_multi   /map        /camera/*     /teacher/detections
        /odom /tf    /goal_pose                 /arm6_joints
              |         |            |               |
            +-----------------------------------------------+
            |        Layer 2: bringup (hardware)             |
            |  state publisher  IMU filter  scan merge  EKF  |
            +-----------------------------------------------+
              ^         ^
        /scan0 /scan1  /odom_raw /imu_raw
              |
            +-----------------------------------------------+
            |    Layer 1: micro-ROS agent  <-->  STM32 MCU   |
            +-----------------------------------------------+
```

The golden rule: **always start from the bottom**. Layer 2 before Layer 3,
every time.

## Startup order

| Order | What | Command |
| --- | --- | --- |
| 1 | Hardware bringup (Layer 2) | `ros2 launch slam_mapping bringup.launch.py` |
| 2 | Camera | `ros2 launch slam_mapping app_camera.launch.py` |
| 3 | SLAM + Nav2 | `ros2 launch m3pro_teacher_nav slam_and_nav.launch.py` |
| 4 | Vision + arm | `ros2 launch m3pro_teacher_vision detect_and_pick.launch.py` |

Each runs in its own shell (`docker exec -it m3pro bash`, then source the
environment). On a robot prepared with the persistence scripts, steps 1 and
2 already run at boot.

## End-to-end walkthrough

The goal: the robot maps a room, navigates to a target zone, finds a red
object there, and picks it up.

### Step 1: Start the hardware

```bash
ros2 launch slam_mapping bringup.launch.py
# wait for: First IMU message received / Subscribing to topics 2
ros2 launch slam_mapping app_camera.launch.py
```

Check Layer 2 is healthy:

```bash
ros2 run tf2_ros tf2_echo odom base_footprint     # must print a transform
ros2 topic hz /scan_multi                          # around 8-10 Hz
```

### Step 2: Map the room

```bash
ros2 launch m3pro_teacher_nav slam_online.launch.py
ros2 run teleop_twist_keyboard teleop_twist_keyboard   # second shell
```

Drive slowly, cover every wall, revisit places. When the map looks complete:

```bash
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/lab}}"
```

Stop SLAM (`Ctrl+C`).

### Step 3: Navigate on the saved map

```bash
ros2 launch m3pro_teacher_nav navigation.launch.py map:=/root/maps/lab.yaml
```

Set the robot's start pose (RViz **2D Pose Estimate** or `/initialpose`),
then send it to the zone where the object is:

```bash
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"
```

Wait for the robot to arrive.

### Step 4: Detect and pick

```bash
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py
```

The detector finds the red object, the robot makes a short final approach,
and the arm runs `APPROACH -> REACH -> GRASP -> LIFT`. Watch progress on
`/teacher/detection_image` and the arm state in the node log.

> Tune the color first with `detect_and_pick.launch.py pick:=false`, so the
> arm stays still while you check detections. See [Arm control](arm.html).

## A faster all-in-one path

To skip the save/reload cycle, use `slam_and_nav.launch.py`: it maps **and**
navigates at the same time. Then add vision on top.

```bash
# Shell 1 - hardware (skip if autostarted)
ros2 launch slam_mapping bringup.launch.py
ros2 launch slam_mapping app_camera.launch.py

# Shell 2 - map and navigate together
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py

# Shell 3 - detect and pick
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py
```

Send goals with `/goal_pose`, and the robot navigates through space it has
already mapped while the vision pipeline looks for objects.

## How the layers share data

| Topic | Produced by | Consumed by |
| --- | --- | --- |
| `/scan_multi` | bringup (scan merger) | SLAM, Nav2 costmap |
| `/odom`, `/tf` | bringup (EKF) | SLAM, Nav2, arm |
| `/map` | slam_toolbox | Nav2, dashboard |
| `/goal_pose` | you, dashboard, explore | Nav2 |
| `/camera/color/image_raw` | camera | object detector |
| `/teacher/detections` | object detector | arm pick node |
| `/teacher/camera_scan` | depth obstacle node | Nav2 costmap |
| `/cmd_vel` | Nav2, arm approach | micro-ROS agent -> wheels |
| `/arm6_joints` | arm pick node | arm driver |

If one stage shows nothing, check the topic that feeds it with
`ros2 topic hz <topic>`.

## Where to next

- [Dashboard](dashboard.html) - watch the whole system from one screen.
- [Troubleshooting](troubleshooting.html) - when a stage is silent.
