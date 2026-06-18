---
title: Getting started
parent: English
nav_order: 1
---

# Getting started
{: .no_toc }

Connect to the robot, understand its layers, and start the hardware before
any exercise.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## What you need

- A **ROSMASTER M3 Pro**, powered on, on the same network as your laptop.
- The **robot IP address**. Ask your instructor. In this guide it is written
  `<robot-ip>` (a typical lab value is `192.168.50.102`).
- An **SSH client**. Built into macOS, Linux and recent Windows.

## The three layers

The robot software is built in three layers. Each layer depends on the one
below it.

```text
Layer 3   Course apps    SLAM, Nav2, vision, arm, dashboard
              |          (the packages you launch in the exercises)
Layer 2   Bringup        robot_state_publisher, IMU filter, scan merger, EKF
              |          (produces /odom, /scan_multi, /tf)
Layer 1   micro-ROS      bridges the STM32 MCU to ROS 2
              |          (raw wheels, /odom_raw, /imu_raw, /battery)
          STM32 MCU      motors, encoders, IMU, battery, LED, buzzer
```

If a SLAM or navigation node shows no map and no robot, the cause is almost
always that **Layer 2 (bringup) is not running**. See
[Troubleshooting](troubleshooting.html).

## Connect to the robot

ROS 2 Humble runs inside a Docker container named `m3pro` on the robot's
Jetson. Open an SSH session, then enter the container:

```bash
ssh jetson@<robot-ip>
docker exec -it m3pro bash
```

On a robot prepared with the `setup/` scripts, the container starts
automatically at boot. You only start it by hand if it was stopped.

## Source the ROS 2 environment

Every new shell inside the container must source ROS 2 and the course
workspace:

```bash
source /opt/ros/humble/setup.bash
source /root/m3pro_teacher_ws/install/setup.bash
```

This robot uses a fixed ROS network configuration:

```bash
export ROS_DOMAIN_ID=30
export FASTDDS_BUILTIN_TRANSPORTS=UDPv4
```

A prepared robot already sets all of this in the container `.bashrc`, so a
fresh `docker exec -it m3pro bash` is ready to use.

## Start the hardware layer (bringup)

Before launching any SLAM, navigation or vision node, **Layer 2 must be
running**. The bringup starts:

| Node | Role |
| --- | --- |
| `robot_state_publisher` | Publishes the robot URDF and its static TF tree. |
| `imu_filter_madgwick` | Produces a clean, filtered `/imu`. |
| `laserscan_multi_merger` | Merges `/scan0` + `/scan1` into a 360 degree `/scan_multi`. |
| `ekf_node` | Fuses wheel odometry and IMU into `/odom` and the `odom -> base_footprint` transform. |

Launch it:

```bash
ros2 launch slam_mapping bringup.launch.py
```

Wait for the log lines `First IMU message received` and
`Subscribing to topics 2`. On a robot prepared with the persistence
scripts, the bringup is launched automatically at boot.

## Verify the robot is alive

```bash
ros2 topic list                                 # /odom /scan_multi /imu /battery /tf ...
ros2 topic echo /battery --once                 # battery voltage
ros2 topic hz /scan_multi                        # lidar rate, around 8-10 Hz
ros2 run tf2_ros tf2_echo odom base_footprint     # must print a live transform
```

If `tf2_echo` prints `Invalid frame ID "odom"`, the bringup is **not**
running. Start it before continuing.

## Drive the robot by hand

The robot listens for velocity commands on `/cmd_vel`.

```bash
# Interactive keyboard control
ros2 run teleop_twist_keyboard teleop_twist_keyboard

# Or a single nudge forward for one message
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"
```

The M3 Pro has mecanum wheels, so `linear.y` also works: the robot can
strafe sideways without turning.

> **Safety.** Keep a clear space around the robot. Stop it at any time with
> `Ctrl+C` on the teleop, or publish a zero `Twist`. The buzzer stays
> disabled during the course. The arm is only powered with instructor
> authorization.

## Where to next

- [Navigation](navigation.html) - build a map and drive autonomously.
- [Dashboard](dashboard.html) - watch the robot from a browser, Foxglove or RViz.
