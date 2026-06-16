#!/usr/bin/env bash
set -euo pipefail

# Installs a ROS 2 / DDS auto-source block into the robot Docker container's
# /root/.bashrc so every `docker exec -it <container> bash` picks up the right
# domain, DDS transport, and workspace overlays automatically.
#
# Usage:
#   ./setup/setup_container_bashrc.sh [ROBOT_IP]
#
# Env overrides:
#   ROBOT_HOST=10.10.220.142
#   ROBOT_USER=jetson
#   CONTAINER=<name>              # skip auto-detection
#   ROS_DOMAIN_ID=30
#   FASTDDS_BUILTIN_TRANSPORTS=UDPv4

ROBOT_HOST="${1:-${ROBOT_HOST:-10.10.220.142}}"
ROBOT_USER="${ROBOT_USER:-jetson}"
ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
FASTDDS_BUILTIN_TRANSPORTS="${FASTDDS_BUILTIN_TRANSPORTS:-UDPv4}"
CONTAINER="${CONTAINER:-}"

MARKER_BEGIN="# >>> m3pro_teacher_ws ros env (managed) >>>"
MARKER_END="# <<< m3pro_teacher_ws ros env (managed) <<<"

if [ -z "$CONTAINER" ]; then
  CONTAINER="$(
    ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" \
      "docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower(\$0) ~ /rosmaster|m3pro|yahboom/ {print \$1; exit}'"
  )"
fi

if [ -z "$CONTAINER" ]; then
  echo "ERROR: No running M3 Pro Docker container found on $ROBOT_HOST" >&2
  exit 1
fi

echo "Target: $ROBOT_USER@$ROBOT_HOST container=$CONTAINER"
echo "  ROS_DOMAIN_ID=$ROS_DOMAIN_ID"
echo "  FASTDDS_BUILTIN_TRANSPORTS=$FASTDDS_BUILTIN_TRANSPORTS"
echo

# Build the block on the Mac; ship via stdin so we can use a real HEREDOC safely.
BLOCK="$(cat <<EOF
$MARKER_BEGIN
export ROS_DOMAIN_ID=$ROS_DOMAIN_ID
export FASTDDS_BUILTIN_TRANSPORTS=$FASTDDS_BUILTIN_TRANSPORTS
if [ -f /opt/ros/humble/setup.bash ]; then source /opt/ros/humble/setup.bash; fi
for ws in /root/yahboomcar_ws /root/M3Pro_ws /root/m3pro_teacher_ws; do
  [ -f "\$ws/install/setup.bash" ] && source "\$ws/install/setup.bash"
done
$MARKER_END
EOF
)"

# Install via docker exec as root. The sed strips any previous managed block,
# then we append the fresh one. Idempotent by the marker pair.
ssh -o BatchMode=yes "$ROBOT_USER@$ROBOT_HOST" \
  "docker exec -i -u root '$CONTAINER' bash -s" <<REMOTE
set -e
BASHRC=/root/.bashrc
touch "\$BASHRC"
# Strip any previous managed block
sed -i '/^# >>> m3pro_teacher_ws ros env (managed) >>>\$/,/^# <<< m3pro_teacher_ws ros env (managed) <<<\$/d' "\$BASHRC"
# Append fresh block
cat >> "\$BASHRC" <<'BASHRC_BLOCK'
$BLOCK
BASHRC_BLOCK
echo "--- installed block ---"
sed -n '/^# >>> m3pro_teacher_ws ros env (managed) >>>\$/,/^# <<< m3pro_teacher_ws ros env (managed) <<<\$/p' "\$BASHRC"
REMOTE

echo
echo "Done. Verify with:"
echo "  ssh $ROBOT_USER@$ROBOT_HOST \"docker exec -it $CONTAINER bash -lc 'env | grep -E ROS_DOMAIN_ID\\|FASTDDS; ros2 pkg list | head -3'\""
