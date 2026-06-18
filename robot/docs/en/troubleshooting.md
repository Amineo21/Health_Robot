---
title: Troubleshooting
parent: English
nav_order: 7
---

# Troubleshooting
{: .no_toc }

The errors you are most likely to hit, and the fix for each.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## SLAM and navigation

| Symptom | Cause | Fix |
| --- | --- | --- |
| RViz shows no map, no robot. slam_toolbox logs `Message Filter dropping message ... the timestamp on the message is earlier than all the data in the transform cache`. | The hardware bringup is not running, so the `odom -> base_footprint` transform is missing. SLAM drops every scan. | Start Layer 2 first: `ros2 launch slam_mapping bringup.launch.py`. See [Getting started](getting-started.html). |
| `Invalid frame ID "odom" passed to canTransform`. | Same cause: the EKF in the bringup is not publishing `odom`. | Start the bringup. Confirm with `ros2 run tf2_ros tf2_echo odom base_footprint`. |
| RViz panel says `Fixed Frame [map] does not exist`. | No node is publishing the `map` frame yet. | Before SLAM starts, set **Fixed Frame** to `odom`. Once SLAM runs, set it back to `map`. |
| `ros2 topic hz /scan_multi` prints nothing. | The lidar merger (part of the bringup) is not running, or a lidar is unplugged. | Start the bringup. Check `/scan0` and `/scan1` individually. |
| Nav2 ignores goals sent to `/goal_pose`. | The Nav2 lifecycle nodes are not active, or there is no map. | `ros2 lifecycle get /bt_navigator` should say `active`. Make sure a map exists (SLAM running, or a map loaded). |
| The robot plans a path but never moves. | The micro-ROS agent is down, so `/cmd_vel` never reaches the wheels. | Ask your instructor to run `setup/restart_microros_agent.sh <robot-ip>`. |
| The map drifts then suddenly jumps. | CPU saturation: scans are processed late. | This is expected on the Jetson. The course `slam_toolbox_params.yaml` already raises the scan thresholds to limit it. |

## Vision and arm

| Symptom | Cause | Fix |
| --- | --- | --- |
| No `/camera/color/image_raw` topic. | The camera node is not started. | Start the camera (the bringup or `container_autostart.sh` does this on a prepared robot). |
| `object_detector_node` detects nothing. | The HSV color range does not match the object, or the object is too far or too small. | Tune `hsv_*` and `min_contour_area` in `detection_params.yaml`. See [Arm control](arm.html). |
| Arm log says `[DRY RUN] Would send arm: [...]`. | The `arm_msgs` package is not installed, so commands are simulated only. | This is safe. Install `arm_msgs` to drive the real servos, or keep dry-run for testing logic. |
| The arm moves but misses the object. | The detection depth is wrong, or the camera-to-arm transform is off. | Check the depth value and the static TF `base_link -> camera_color_optical_frame`. |

## Network and tools

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ros2 topic list` from your laptop shows nothing. | Wrong `ROS_DOMAIN_ID`, or you are not on the robot network. | Use `ROS_DOMAIN_ID=30` and the same `FASTDDS_BUILTIN_TRANSPORTS=UDPv4`. Easiest is to run commands inside the container. |
| Foxglove cannot connect. | rosbridge is not running, or the WebSocket URL is wrong. | Launch a stack that starts rosbridge (port 9090). Connect to `ws://<robot-ip>:9090`. |
| The web dashboard page loads but stays `DISCONNECTED`. | The HTTP server (8080) is up but rosbridge (9090) is not. | Both ports are needed. Relaunch `web_dashboard.launch.py`. |
| Many timestamp warnings, TF lookups fail intermittently. | The robot system clock has drifted. | Sync the clock: `sudo timedatectl set-ntp true` on the Jetson. |

## A reliable reset

When several things are wrong at once, restart cleanly from the bottom up:

```bash
# 1. Hardware layer
ros2 launch slam_mapping bringup.launch.py
# wait for "Subscribing to topics 2"

# 2. Your exercise (SLAM, Nav2, vision ...) in a second shell
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py
```

Always start Layer 2 before Layer 3. Most "nothing works" situations are a
missing bringup.
