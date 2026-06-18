#!/usr/bin/env bash
set -euo pipefail

# Restarts the micro-ros-agent container on the robot and verifies that
# YB_Node comes back with /battery publishing.
#
# On this image micro-ros-agent runs in its own Docker container on the host,
# bridging /dev/myserial (MCU) to DDS. YB_Node is published from the MCU via
# the agent, so restarting the agent makes YB_Node reappear.
#
# Usage:
#   ./scripts/restart_microros_agent.sh [ROBOT_IP]
#
# Env overrides:
#   ROBOT_HOST=10.10.220.142
#   ROBOT_USER=jetson
#   AGENT_IMAGE=192.168.2.51:5000/micro-ros-agent:humble
#   SERIAL_DEV=/dev/myserial
#   SERIAL_BAUD=2000000
#   VERBOSITY=4
#   WAIT_TOPIC=/battery
#   WAIT_TIMEOUT=30
#   ROS_DOMAIN_ID=30
#   FASTDDS_BUILTIN_TRANSPORTS=UDPv4

ROBOT_HOST="${1:-${ROBOT_HOST:-10.10.220.142}}"
ROBOT_USER="${ROBOT_USER:-jetson}"
AGENT_IMAGE="${AGENT_IMAGE:-192.168.2.51:5000/micro-ros-agent:humble}"
SERIAL_DEV="${SERIAL_DEV:-/dev/myserial}"
SERIAL_BAUD="${SERIAL_BAUD:-2000000}"
VERBOSITY="${VERBOSITY:-4}"
WAIT_TOPIC="${WAIT_TOPIC:-/battery}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-30}"
ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
FASTDDS_BUILTIN_TRANSPORTS="${FASTDDS_BUILTIN_TRANSPORTS:-UDPv4}"

echo "Target: $ROBOT_USER@$ROBOT_HOST"
echo "Agent image: $AGENT_IMAGE"
echo "Serial:      $SERIAL_DEV @ $SERIAL_BAUD"
echo

# --- Step 1: stop any existing micro-ros-agent container on the host ---
ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" bash -s <<REMOTE_STOP
set -e
existing=\$(docker ps --format '{{.Names}}\t{{.Image}}' | awk -F'\t' '\$2 ~ /micro-ros-agent/ {print \$1}')
if [ -n "\$existing" ]; then
  for c in \$existing; do
    echo "Stopping \$c..."
    docker stop "\$c" >/dev/null 2>&1 || true
  done
else
  echo "No micro-ros-agent container running."
fi
# Clean any stale stopped ones with that image (in case --rm missed)
stale=\$(docker ps -a --format '{{.Names}}\t{{.Image}}' | awk -F'\t' '\$2 ~ /micro-ros-agent/ {print \$1}')
if [ -n "\$stale" ]; then
  for c in \$stale; do docker rm -f "\$c" >/dev/null 2>&1 || true; done
fi

# Verify serial device exists
if [ ! -e "$SERIAL_DEV" ]; then
  echo "WARNING: $SERIAL_DEV not present on host. MCU may be off or unplugged." >&2
fi
REMOTE_STOP

# --- Step 2: start fresh agent detached ---
echo
echo "Starting fresh micro-ros-agent..."
ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" bash -s <<REMOTE_START
set -e
docker run -d --rm --init \
  --name micro_ros_agent \
  --net=host --privileged \
  -v /dev:/dev -v /dev/shm:/dev/shm \
  '$AGENT_IMAGE' \
  serial --dev '$SERIAL_DEV' -b '$SERIAL_BAUD' -v$VERBOSITY >/dev/null
sleep 1
docker ps --filter name=micro_ros_agent --format 'Started: {{.Names}} ({{.Status}})'
REMOTE_START

# --- Step 3: wait for the agent to accept a session (log signal) ---
echo
echo "Waiting for MCU XRCE session (up to 20s)..."
ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" bash -s <<'REMOTE_WAIT_SESSION'
set -e
for i in $(seq 1 20); do
  if docker logs micro_ros_agent 2>&1 | grep -qE 'session established|create_client.*OK|Root\.session'; then
    echo "MCU session established."
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for MCU session. Recent agent log:"
docker logs --tail 20 micro_ros_agent 2>&1 || true
REMOTE_WAIT_SESSION

# --- Step 4: verify /battery is publishing from inside the main ROS container ---
echo
echo "Verifying $WAIT_TOPIC is publishing (timeout ${WAIT_TIMEOUT}s)..."

MAIN_CONTAINER="$(
  ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" \
    "docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower(\$0) ~ /rosmaster|m3pro|yahboom/ && tolower(\$0) !~ /micro-ros/ {print \$1; exit}'"
)"

if [ -z "$MAIN_CONTAINER" ]; then
  echo "ERROR: Main ROS container not found — /battery check skipped." >&2
  exit 2
fi

ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" \
  "docker exec -i -e ROS_DOMAIN_ID=$ROS_DOMAIN_ID -e FASTDDS_BUILTIN_TRANSPORTS=$FASTDDS_BUILTIN_TRANSPORTS $MAIN_CONTAINER bash -lc '
    source /opt/ros/humble/setup.bash
    [ -f /root/yahboomcar_ws/install/setup.bash ] && source /root/yahboomcar_ws/install/setup.bash
    end=\$(( \$(date +%s) + $WAIT_TIMEOUT ))
    while [ \$(date +%s) -lt \$end ]; do
      if ros2 topic list 2>/dev/null | grep -qx $WAIT_TOPIC; then
        info=\$(ros2 topic info $WAIT_TOPIC 2>/dev/null || true)
        pubs=\$(echo \"\$info\" | awk -F: \"/Publisher count/ {print \\\$2}\" | tr -d \" \")
        if [ \"\$pubs\" -ge 1 ] 2>/dev/null; then
          echo \"$WAIT_TOPIC publishers: \$pubs\"
          echo \"Sampling hz for 3s...\"
          timeout 3 ros2 topic hz $WAIT_TOPIC 2>&1 | tail -5 || true
          echo \"ros2 node list:\"
          ros2 node list 2>/dev/null | grep -E \"YB_Node|yahboom\" || ros2 node list 2>/dev/null | head
          exit 0
        fi
      fi
      sleep 1
    done
    echo \"TIMED OUT waiting for $WAIT_TOPIC publisher.\"
    echo \"Topics:\"; ros2 topic list 2>/dev/null | head
    exit 3
  '"

echo
echo "Done."
