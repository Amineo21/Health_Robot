#!/bin/bash
# =============================================================================
# Host-side autostart for the M3 Pro Docker container.
#
# REPLACES the original /home/jetson/Docker_M3Pro_Joy.sh (the factory version
# ran `docker run -it` with no volumes, no restart policy, and no persistent
# workspace — every reboot wiped the build and the saved map).
#
# This version:
#   - Names the container "m3pro" (stable, no more hunting docker ps)
#   - --restart=unless-stopped (Docker auto-brings it back on crashes + reboot)
#   - Bind-mounts:
#       /home/jetson/m3pro_teacher_ws  → /root/m3pro_teacher_ws
#       /home/jetson/robot_maps        → /root/maps
#   - Runs container_autostart.sh as PID 1, which launches bringup + camera +
#     SLAM + Nav2 + explore + dashboard automatically.
#
# Installed as ~/Docker_M3Pro_Joy.sh via deploy_persistence.sh and invoked by
# the existing ~/.config/autostart/uros.desktop on login.
# =============================================================================

# Wait for the Docker service to start.
while true; do
    if systemctl is-active --quiet docker; then
        break
    fi
    sleep 1
done

# Allow X from the local container to reach :0.
xhost +local:root >/dev/null 2>&1 || true

# Make sure the persistent dirs exist on the host.
mkdir -p /home/jetson/m3pro_teacher_ws
mkdir -p /home/jetson/robot_maps

# Recreate the "m3pro" container from scratch every boot (so flag/volume
# changes take effect). --rm is NOT set — the container survives between
# launches of this script via --restart=unless-stopped, but if this script
# is invoked again (e.g. on relogin) and the container already exists, we
# stop+remove it first so the new config wins.
if docker ps -a --format '{{.Names}}' | grep -qx m3pro; then
    docker stop m3pro >/dev/null 2>&1 || true
    docker rm m3pro >/dev/null 2>&1 || true
fi

docker run -d \
  --name m3pro \
  --restart=unless-stopped \
  --net=host \
  --env="DISPLAY" \
  --env="QT_X11_NO_MITSHM=1" \
  -e PULSE_SERVER=unix:/run/user/1000/pulse/native \
  -e ALSA_CARD=0 \
  -e XDG_RUNTIME_DIR=/tmp/runtime-jetson \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -v /run/user/1000/pulse:/run/user/1000/pulse:ro \
  -v /home/jetson/.config/pulse:/root/.config/pulse:ro \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /home/jetson/m3pro_teacher_ws:/root/m3pro_teacher_ws \
  -v /home/jetson/robot_maps:/root/maps \
  --device=/dev/bus/usb \
  --device=/dev/input \
  --security-opt apparmor:unconfined \
  ${ROBOT_IMAGE:-rosmaster-m3pro-nano:1.1.0} \
  /bin/bash /root/m3pro_teacher_ws/setup/container_autostart.sh

echo "Started m3pro container."
docker ps --filter name=m3pro --format '  {{.Names}}: {{.Status}}'
