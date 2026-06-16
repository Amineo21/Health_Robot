#!/bin/bash
# micro-ros-agent on the host. Bridges the MCU's UART → DDS so ROS2 nodes on
# the Jetson (/odom_raw, /imu_raw, /battery, /cmd_vel consumer, etc.) can
# reach the wheel controller.
#
# Uses --restart=unless-stopped so if the agent crashes or loses its MCU
# session (dropping /odom_raw → killing Nav2 planning), Docker brings it back.

# Remove any prior instance so the name is free.
docker rm -f micro_ros_agent 2>/dev/null || true

docker run -d --name micro_ros_agent --init \
  --restart=unless-stopped \
  -v /dev:/dev -v /dev/shm:/dev/shm \
  --privileged --net=host \
  microros/micro-ros-agent:humble \
  serial --dev /dev/myserial -b 2000000 -v4

echo "Started micro_ros_agent (detached, auto-restarts)."
docker ps --filter name=micro_ros_agent --format '  {{.Names}}: {{.Status}}'
