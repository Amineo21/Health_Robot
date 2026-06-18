# Robot MQTT Rosbridge Adapter

## Architecture

```text
Frontend -> Backend JWT/RBAC -> MQTT local -> Backend rosbridge adapter -> ws://10.10.220.180:9090 -> ROS2 robot
```

The robot already exposes ROS through `rosbridge_websocket` on port `9090`. The backend keeps MQTT as its internal command and telemetry bus, then bridges those MQTT messages to the robot WebSocket.

## Why There Is No `health_robot_bridge`

The old `robot/src/health_robot_bridge` package had to be copied and launched inside the `m3pro` container. That made it fragile after robot/container restarts. The backend adapter is simpler for this project because it connects directly to the robot port documented by the M3 Pro course stack.

## Configuration

Runtime variables:

```text
ROBOT_ROSBRIDGE_ENABLED=true
ROBOT_ROSBRIDGE_URL=ws://10.10.220.180:9090
ROBOT_DASHBOARD_URL=http://10.10.220.180:8080
ROBOT_MAPS_DIRECTORY=/root/maps
ROBOT_BASE_X=0.0
ROBOT_BASE_Y=0.0
ROBOT_BASE_YAW=0.0
```

These are wired in `infra/docker-compose.yml` for the backend service.

## Map Management

Saved maps live inside the robot Docker container under `/root/maps`. The backend exposes authenticated endpoints under `/api/robot/maps`:

- `GET /api/robot/maps/current` returns the latest `/map` OccupancyGrid snapshot received from rosbridge.
- `GET /api/robot/maps` proxies the robot dashboard map list from `/root/maps`.
- `POST /api/robot/maps/mapping/start` switches the robot stack to mapping mode through the robot dashboard service.
- `POST /api/robot/maps/save` saves the current SLAM map to `/root/maps/<name>` using `/slam_toolbox/save_map` and `/slam_toolbox/serialize_map` through rosbridge.
- `POST /api/robot/maps/{name}/load` switches to navigation mode with `/root/maps/<name>.yaml`.
- `DELETE /api/robot/maps/{name}` deletes the matching `.yaml`, `.pgm`, `.data`, and `.posegraph` files.

## Camera, Audio, And Arm

Robot media stays behind the backend instead of exposing robot services to the browser:

- `GET /api/robot/camera/snapshot` proxies the robot dashboard JPEG snapshot from `ROBOT_DASHBOARD_URL`.
- `GET /api/robot/sounds` lists files from the robot dashboard sound directory (`/root/sounds`).
- `POST /api/robot/sounds/{name}/play` asks the robot dashboard to play a sound. Admin and caregiver are allowed.
- `POST /api/robot/sounds/upload?name=<file>` uploads raw `application/octet-stream` audio. Admin only.
- `DELETE /api/robot/sounds/{name}` deletes a sound through the robot dashboard. Admin only.
- `GET /api/robot/arm` returns the latest `/joint_states` arm snapshot converted to servo degrees.
- `POST /api/robot/arm` publishes `arm_msgs/msg/ArmJoints` on `/arm6_joints`. Admin only.

## Safety Boundary

The frontend must not connect directly to rosbridge. Human users still go through backend JWT/RBAC checks, then commands are published to MQTT and forwarded by the backend adapter.
