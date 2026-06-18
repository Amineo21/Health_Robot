#!/usr/bin/env bash
set -euo pipefail

# Install a systemd service on the robot that supervises the micro-ros-agent
# Docker container. Replaces the flaky ~/.config/autostart/start.desktop
# lxterminal launcher with a proper boot-time service that:
#   - waits for docker.service and /dev/myserial
#   - runs the agent in the foreground under systemd supervision
#   - auto-restarts on crash
#   - logs to the journal (journalctl -u micro-ros-agent)
#
# Usage:
#   ./scripts/install_microros_service.sh [ROBOT_IP]
#   ./scripts/install_microros_service.sh 10.10.220.142 --uninstall
#
# Env overrides:
#   ROBOT_USER=jetson
#   AGENT_IMAGE=192.168.2.51:5000/micro-ros-agent:humble
#   SERIAL_DEV=/dev/myserial
#   SERIAL_BAUD=2000000
#   VERBOSITY=4

ROBOT_HOST="${1:-${ROBOT_HOST:-10.10.220.142}}"
ROBOT_USER="${ROBOT_USER:-jetson}"
AGENT_IMAGE="${AGENT_IMAGE:-192.168.2.51:5000/micro-ros-agent:humble}"
SERIAL_DEV="${SERIAL_DEV:-/dev/myserial}"
SERIAL_BAUD="${SERIAL_BAUD:-2000000}"
VERBOSITY="${VERBOSITY:-4}"
SERVICE_NAME="micro-ros-agent.service"
AUTOSTART_FILE="/home/$ROBOT_USER/.config/autostart/start.desktop"
AUTOSTART_DISABLED="$AUTOSTART_FILE.disabled-by-m3pro-teacher-ws"

MODE="install"
if [ "${2:-}" = "--uninstall" ] || [ "${1:-}" = "--uninstall" ]; then
  MODE="uninstall"
fi

if [ "$MODE" = "uninstall" ]; then
  echo "Uninstalling $SERVICE_NAME on $ROBOT_USER@$ROBOT_HOST..."
  ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" bash -s <<REMOTE
set -e
sudo systemctl disable --now $SERVICE_NAME 2>/dev/null || true
sudo rm -f /etc/systemd/system/$SERVICE_NAME
sudo systemctl daemon-reload
# Restore the old autostart if we disabled it
if [ -f "$AUTOSTART_DISABLED" ] && [ ! -f "$AUTOSTART_FILE" ]; then
  mv "$AUTOSTART_DISABLED" "$AUTOSTART_FILE"
  echo "Restored $AUTOSTART_FILE"
fi
echo "Uninstalled."
REMOTE
  exit 0
fi

echo "Installing $SERVICE_NAME on $ROBOT_USER@$ROBOT_HOST"
echo "  image:  $AGENT_IMAGE"
echo "  serial: $SERIAL_DEV @ $SERIAL_BAUD (v$VERBOSITY)"
echo

# Build the service unit on the Mac and ship it via SSH.
UNIT="$(cat <<UNIT_EOF
[Unit]
Description=micro-ROS Agent (Yahboom M3 Pro, serial $SERIAL_DEV)
Documentation=https://micro.ros.org/
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=20

# Wait up to 60s for the MCU serial device to appear before starting.
ExecStartPre=/bin/bash -c 'for i in \$(seq 1 60); do [ -e $SERIAL_DEV ] && exit 0; sleep 1; done; echo "$SERIAL_DEV never appeared" >&2; exit 1'

# Clean any stale container (name collision after unclean stop).
ExecStartPre=-/usr/bin/docker rm -f micro_ros_agent

# Run foreground so systemd supervises the container lifetime directly.
ExecStart=/usr/bin/docker run --rm --init \\
  --name micro_ros_agent \\
  --net=host --privileged \\
  -v /dev:/dev -v /dev/shm:/dev/shm \\
  $AGENT_IMAGE \\
  serial --dev $SERIAL_DEV -b $SERIAL_BAUD -v$VERBOSITY

ExecStop=/usr/bin/docker stop -t 10 micro_ros_agent

[Install]
WantedBy=multi-user.target
UNIT_EOF
)"

ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" bash -s <<REMOTE
set -e

# 1. Disable the old GUI autostart that also launches the agent (prevents
#    double-launch / port contention).
if [ -f "$AUTOSTART_FILE" ] && [ ! -f "$AUTOSTART_DISABLED" ]; then
  mv "$AUTOSTART_FILE" "$AUTOSTART_DISABLED"
  echo "Disabled old autostart: $AUTOSTART_FILE -> $AUTOSTART_DISABLED"
fi

# 2. Write the unit file.
sudo tee /etc/systemd/system/$SERVICE_NAME >/dev/null <<'UNITFILE'
$UNIT
UNITFILE

# 3. Stop any currently-running agent (from my earlier manual docker run or
#    the GUI autostart) so systemd can take it over cleanly.
for c in \$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' '\$2 ~ /micro-ros-agent/ {print \$1}'); do
  echo "Stopping existing agent container: \$c"
  docker stop "\$c" >/dev/null 2>&1 || true
done

# 4. Enable and start.
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

sleep 3
systemctl is-active $SERVICE_NAME && echo "Service active."
echo
echo "--- recent log ---"
sudo journalctl -u $SERVICE_NAME -n 15 --no-pager
REMOTE

echo
echo "Installed. Common commands on the robot:"
echo "  systemctl status $SERVICE_NAME"
echo "  journalctl -u $SERVICE_NAME -f"
echo "  sudo systemctl restart $SERVICE_NAME"
echo
echo "To roll back:"
echo "  ./scripts/install_microros_service.sh $ROBOT_HOST --uninstall"
