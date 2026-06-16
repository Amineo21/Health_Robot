---
title: Navigation
parent: English
nav_order: 2
---

# Navigation: mapping and autonomous driving
{: .no_toc }

Build a map of a room, then let the robot drive itself to any point on it.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Before you start

The hardware bringup (Layer 2) must be running. See
[Getting started](getting-started.html). Every command below runs **inside
the `m3pro` container** with the environment sourced.

## Which launch file do I use?

| Goal | Launch file | Package |
| --- | --- | --- |
| Map a room for the first time | `slam_online.launch.py` | `m3pro_teacher_nav` |
| Drive autonomously on a saved map | `navigation.launch.py` | `m3pro_teacher_nav` |
| Map and navigate at the same time | `slam_and_nav.launch.py` | `m3pro_teacher_nav` |
| Explore and map a room with no input | `explore.launch.py` | `m3pro_teacher_nav` |
| Localize on a saved map only | `localize.launch.py` | `m3pro_teacher_nav` |

## Recipe 1: Build a map with SLAM

SLAM (Simultaneous Localization And Mapping) builds the map while tracking
where the robot is on it. The course uses `slam_toolbox` in async mode,
which suits the Jetson CPU.

**Step 1.** Start SLAM.

```bash
ros2 launch m3pro_teacher_nav slam_online.launch.py
```

This launches the scan merger (a 360 degree `/scan_merged`), `slam_toolbox`,
and RViz preset to show the map.

**Step 2.** Drive the robot slowly through the room. In a second shell:

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

Drive **slowly**. Cover every wall. Return to places you have already seen so
SLAM can close loops and tighten the map.

**Step 3.** Watch the map grow. Open RViz, Foxglove or the web dashboard and
look at the `/map` topic. Free space is dark, obstacles are light, unknown is
grey.

**Step 4.** Save the map when it looks complete.

```bash
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/my_room}}"
```

This writes `my_room.yaml` and `my_room.pgm` into `/root/maps`. That folder
is kept across reboots on a prepared robot.

> Tip. You can also save with the standard tool:
> `ros2 run nav2_map_server map_saver_cli -f /root/maps/my_room`.

## Recipe 2: Drive autonomously on a saved map

Once you have a map, Nav2 can plan and follow paths to any goal.

**Step 1.** Start Nav2 with your map.

```bash
ros2 launch m3pro_teacher_nav navigation.launch.py \
  map:=/root/maps/my_room.yaml
```

This loads the map, starts AMCL (localization by particle filter), the
planner, the controller and the recovery behaviors.

**Step 2.** Tell the robot where it is. The robot does not know its start
pose on the loaded map. In RViz use the **2D Pose Estimate** button and click
where the robot actually is, pointing in its facing direction. Or publish it:

```bash
ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped \
  "{header: {frame_id: map}, pose: {pose: {position: {x: 0.0, y: 0.0}, orientation: {w: 1.0}}}}"
```

**Step 3.** Send a navigation goal.

```bash
# Simple: publish a goal pose (RViz "2D Goal Pose" does the same)
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"
```

The robot plans a global path (`/plan`), follows it with the local planner
(`/local_plan`), and stops within the goal tolerance.

For full control and feedback, send the goal as an action instead:

```bash
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}}"
```

## Recipe 3: Map and navigate at the same time

`slam_and_nav.launch.py` runs `slam_toolbox` **and** Nav2 together. There is
no AMCL and no map file: SLAM provides both the map and the localization.

```bash
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py
```

Send goals exactly as in Recipe 2. The robot navigates into space it has
already mapped and extends the map as it goes. This is the simplest way to
test navigation without first saving a map.

## Recipe 4: Explore a room with no input

`explore.launch.py` adds frontier exploration: the robot finds the boundary
between known and unknown space and drives there on its own, like a robot
vacuum.

```bash
ros2 launch m3pro_teacher_nav explore.launch.py
```

It runs `slam_toolbox` + Nav2 + `explore_lite` + rosbridge (port 9090 for
Foxglove). The robot maps the whole room with no teleop. When the map looks
done, save it as in Recipe 1.

## Saving and reusing maps

| Action | Command |
| --- | --- |
| Save current map | `ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap "{name: {data: /root/maps/my_room}}"` |
| Save with standard tool | `ros2 run nav2_map_server map_saver_cli -f /root/maps/my_room` |
| List saved maps | `ls /root/maps` |
| Reuse a map for navigation | `ros2 launch m3pro_teacher_nav navigation.launch.py map:=/root/maps/my_room.yaml` |

A map is two files: `name.yaml` (metadata: resolution, origin) and
`name.pgm` (the image).

## Tuning the behavior

The two parameter files live in `m3pro_teacher_nav/config/`.

**`slam_toolbox_params.yaml`** controls mapping:

```yaml
resolution: 0.05            # metres per map cell (5 cm)
max_laser_range: 3.5        # lidar usable range
minimum_travel_distance: 0.5 # only insert a scan after moving 0.5 m
minimum_travel_heading: 0.5  # ... or turning 0.5 rad
```

**`nav2_params.yaml`** controls driving:

```yaml
# Speed limits of the local planner
max_vel_x: 0.20             # forward speed (m/s), cautious indoors
max_vel_theta: 0.8          # turn speed (rad/s)
xy_goal_tolerance: 0.15     # "arrived" within 15 cm

# Obstacle inflation: a safety halo around walls
inflation_radius: 0.35      # robot keeps this clearance
```

Raise `max_vel_x` for a faster robot, lower it for a safer one. Raise
`inflation_radius` to make the robot keep further from walls.

## What feeds the costmap

Nav2 builds its obstacle map from **two** sensors:

- `/scan_multi` (or `/teacher/scan_merged`) - the 360 degree lidar.
- `/teacher/camera_scan` - a virtual scan made from the depth camera, which
  catches low obstacles the 2D lidar misses. See [Arm control](arm.html) and
  [Recipes](recipes.html).

## Where to next

- [Arm control](arm.html) - pick up the objects you navigate to.
- [Integration](integration.html) - chain navigation, detection and the arm.
