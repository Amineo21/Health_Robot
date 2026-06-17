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
ROBOT_BASE_X=0.0
ROBOT_BASE_Y=0.0
ROBOT_BASE_YAW=0.0
```

These are wired in `infra/docker-compose.yml` for the backend service.

## Safety Boundary

The frontend must not connect directly to rosbridge. Human users still go through backend JWT/RBAC checks, then commands are published to MQTT and forwarded by the backend adapter.
