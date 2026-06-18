---
title: Dashboard
parent: English
nav_order: 5
---

# Watching the robot: dashboard, Foxglove, RViz
{: .no_toc }

Three ways to see what the robot sees and to send it commands.

## Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Which tool should I use?

| Tool | Install needed | Best for |
| --- | --- | --- |
| Web dashboard | None, just a browser | Quick checks, demos, sending goals |
| Foxglove Studio | Free desktop app | Rich inspection, recording, custom layouts |
| RViz | On the robot, viewed over VNC | The classic ROS 3D view, costmaps, planners |

All three connect to the same robot at the same time.

## The web dashboard

A browser dashboard served by the robot itself. No install on your side.

**Start it:**

```bash
ros2 launch m3pro_teacher_web web_dashboard.launch.py
```

This starts two servers:

- **Port 8080** - HTTP: the dashboard page and the camera MJPEG stream.
- **Port 9090** - rosbridge WebSocket: ROS topics and services as JSON.

Both are needed. The page loads from 8080, then opens a WebSocket to 9090.

**Open it:** browse to `http://<robot-ip>:8080`.

What you get:

- The live `/map` drawn on a canvas (free / obstacle / unknown).
- The robot pose and heading on the map.
- The camera stream (`http://<robot-ip>:8080/camera/stream`).
- **Click the map to send a navigation goal** - same as RViz "2D Goal Pose".
- A button to save the current map via the `/slam_toolbox/save_map` service.

There is also a pick page at `http://<robot-ip>:8080/pick.html`, used by the
[click-to-pick recipe](arm.html).

> If `explore.launch.py` or `click_pick.launch.py` already runs rosbridge on
> 9090, start the dashboard without its own bridge:
> `ros2 launch m3pro_teacher_web web_dashboard.launch.py rosbridge:=false`.

## Foxglove Studio

[Foxglove Studio](https://foxglove.dev) is a free desktop app for inspecting
ROS data. It needs a rosbridge server running on the robot (port 9090).

Launches that already start rosbridge: `web_dashboard.launch.py`,
`explore.launch.py`, `click_pick.launch.py`. If none is running, start a
standalone bridge:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
```

**Connect:** open Foxglove, choose **Open connection -> Rosbridge**, and
enter:

```text
ws://<robot-ip>:9090
```

**A useful 4-panel layout:**

| Panel | Shows |
| --- | --- |
| 3D | `/map`, `/tf`, the robot model, `/scan_multi`, the Nav2 path `/plan` |
| Image | `/camera/color/image_raw` or `/teacher/detection_image` |
| Raw Messages | `/battery`, `/teacher/fusion_state` |
| Publish | publish `/goal_pose` to send the robot somewhere |

In the 3D panel, set the display frame to `map` once SLAM is running.

**Send a goal from Foxglove:** add a Publish panel, set the topic to
`/goal_pose`, type `geometry_msgs/msg/PoseStamped`, and publish a pose with
`header.frame_id: map`.

**Record data:** Foxglove can record the live connection to an `.mcap` file,
which you can replay offline later.

## RViz

RViz is the classic ROS 3D viewer. On this robot it runs **on the Jetson**
and you view it over VNC, because streaming a 3D window over the network is
heavy.

The course ships a ready-made layout:

```bash
ros2 run rviz2 rviz2 -d \
  $(ros2 pkg prefix m3pro_teacher_nav)/share/m3pro_teacher_nav/rviz/nav2_view.rviz
```

The `nav2_view.rviz` preset shows: a grid, the robot model, the TF tree, the
merged laser scan, the `/map`, the local and global costmaps, the global and
local plans, and detection markers.

**The one setting that matters:** the **Fixed Frame**.

- Before SLAM starts, set it to `odom`.
- Once SLAM or Nav2 runs, set it to `map`.

If RViz says `Fixed Frame [map] does not exist`, no node is publishing the
map yet. See [Troubleshooting](troubleshooting.html).

**VNC note:** RViz over VNC can lag. For everyday monitoring, the web
dashboard or Foxglove is lighter. Use RViz when you specifically need the
costmap and planner visualizations.

## Sending goals: the three tools side by side

| Tool | How to send a goal |
| --- | --- |
| Web dashboard | Click a point on the map. |
| Foxglove | Publish panel on `/goal_pose`. |
| RViz | "2D Goal Pose" toolbar button. |
| Terminal | `ros2 topic pub --once /goal_pose ...` (see [Recipes](recipes.html)). |

All four publish the same `/goal_pose` message. Pick whichever is in front
of you.
