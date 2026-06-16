# Health Robot MQTT/ROS2 Bridge

Bridge between the Health Robot backend MQTT commands and the ROS2 stack already running in the `m3pro` container.

Flow:

```text
Frontend -> Backend FastAPI JWT/RBAC -> MQTT -> health_robot_bridge -> ROS2/Nav2
```

The frontend must not talk directly to ROS2 or rosbridge for the MVP.

## Robot Target

- SSH: `jetson@10.10.220.180`
- Hostname: `jetson-desktop`
- Active containers: `m3pro`, `micro_ros_agent`
- Existing map: `/root/maps/ma_piece.yaml`

## ROS2 Targets

- Commands: `/navigate_to_pose`, `/goal_pose`, `/cmd_vel`
- Costmap services: `/global_costmap/clear_entirely_global_costmap`, `/local_costmap/clear_entirely_local_costmap`
- Telemetry: `/battery` (`std_msgs/Float32` voltage on the course stack), `/odom`, `/amcl_pose`, `/pose`, `/map`, `/scan_multi`, `/plan`

## Reference Dashboard Notes

The course dashboard in `m3pro_teacher_web` is an operator dashboard, not an authenticated admin UI. It talks directly to rosbridge with `roslib` and exposes controls such as map click goals, teleop, mode switch, save map, abort, clear costmaps, and set initial pose.

For Health Robot MVP, keep the safer path:

```text
Frontend admin/caregiver UI -> Backend JWT/RBAC -> MQTT -> Bridge -> ROS2
```

Do not add `roslib` direct access to the Health Robot frontend for this MVP. Reuse the UX ideas only: click-to-navigate, admin-only teleop, admin-only clear costmaps, admin-only return base, and visible connection/status indicators.

## MQTT Topics

Subscribe:

```text
robot/command/#
robot/admin/restart
```

Publish:

```text
robot/status
robot/battery
robot/nav2/feedback
robot/emergency
```

## Local Build In A ROS2 Humble Workspace

```bash
cd /root/health_robot_ws
cp -r /path/to/Health_Robot/robot/src/health_robot_bridge src/
python3 -m pip install paho-mqtt
rosdep install --from-paths src --ignore-src -r -y
colcon build --symlink-install --packages-select health_robot_bridge
source install/setup.bash
```

## Launch

Pass the MQTT broker IP reachable from the robot. If the broker runs on the development machine, use that machine's LAN IP, not `localhost`.

```bash
ros2 launch health_robot_bridge bridge.launch.py \
  mqtt_host:=<BROKER_IP> \
  mqtt_port:=1883 \
  base_x:=0.0 \
  base_y:=0.0 \
  base_yaw:=0.0
```

The top-level repo also provides `robot/launch/health_robot.launch.py` for the same bridge node when launching from this monorepo workspace.
