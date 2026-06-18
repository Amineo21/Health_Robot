#!/usr/bin/env bash
# =============================================================================
# One-shot installer for the persistent M3 Pro autostart.
#
# From the Mac:
#   ./setup/install_persistence.sh ROBOT_IP
#
# What it does on the robot:
#   1. rsyncs this workspace to /home/jetson/m3pro_teacher_ws (bind-mount source)
#   2. creates /home/jetson/robot_maps (persistent saved maps)
#   3. replaces /home/jetson/Docker_M3Pro_Joy.sh with the volume-mounting version
#      (backs up the original to Docker_M3Pro_Joy.sh.bak.<ts>)
#   4. makes container_autostart.sh executable
#   5. stops any currently-running m3pro-related container
#   6. starts the new m3pro container (docker run -d --name m3pro --restart=unless-stopped)
#   7. does the first-run colcon build inside the bind-mount (if install/ is missing)
#   8. restarts the container so autostart picks up the fresh install/
#   9. waits for ports 8080 + 9090 to listen and prints success
#
# Idempotent: safe to re-run after a workspace change or a reboot.
#
# Env overrides:
#   ROBOT_USER=jetson
#   SKIP_RSYNC=0            # set 1 to skip the rsync step (workspace already on robot)
#   SKIP_BUILD=0            # set 1 to skip the first-run build (trust an existing install/)
#   TUNNEL=1                # set 0 to skip creating SSH port-forwards on the Mac
# =============================================================================

set -euo pipefail

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ "$#" -lt 1 ]; then
  sed -n '4,22p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

ROBOT_HOST="$1"
ROBOT_USER="${ROBOT_USER:-jetson}"
SKIP_RSYNC="${SKIP_RSYNC:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
TUNNEL="${TUNNEL:-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

say() { printf '\033[1;36m▶\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m⚠\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
say "Target : $ROBOT_USER@$ROBOT_HOST"

# SSH sanity check.
ssh -o BatchMode=yes -o ConnectTimeout=5 "$ROBOT_USER@$ROBOT_HOST" 'hostname && uptime' \
  || fail "Cannot reach $ROBOT_USER@$ROBOT_HOST via SSH. Run setup/ssh_copy_104.sh first?"

# -----------------------------------------------------------------------------
# 1. rsync workspace source → host bind-mount path
# -----------------------------------------------------------------------------
if [ "$SKIP_RSYNC" = "1" ]; then
  say "[1/9] rsync SKIPPED (SKIP_RSYNC=1)"
else
  say "[1/9] rsync $ROOT_DIR → $ROBOT_USER@$ROBOT_HOST:m3pro_teacher_ws/"
  rsync -az --delete \
    --exclude '.git' --exclude '.DS_Store' --exclude '__pycache__' \
    --exclude 'build' --exclude 'install' --exclude 'log' \
    "$ROOT_DIR/" "$ROBOT_USER@$ROBOT_HOST:m3pro_teacher_ws/"
fi

# -----------------------------------------------------------------------------
# 2. create /home/jetson/robot_maps
# 3. install new Docker_M3Pro_Joy.sh (backs up original)
# 4. chmod the autostart script
# -----------------------------------------------------------------------------
say "[2-4/9] host-side setup (dirs + Docker_M3Pro_Joy.sh + perms)"
ssh "$ROBOT_USER@$ROBOT_HOST" bash -s <<'REMOTE_SETUP'
set -e
mkdir -p "$HOME/m3pro_teacher_ws" "$HOME/robot_maps"
TARGET="$HOME/Docker_M3Pro_Joy.sh"
SOURCE="$HOME/m3pro_teacher_ws/setup/Docker_M3Pro_Joy.sh"
if [ ! -f "$SOURCE" ]; then
  echo "  ERROR: $SOURCE not present on robot — did rsync run?" >&2
  exit 2
fi
# Back up original once (by content — don't re-back up on re-runs).
if [ -f "$TARGET" ] && ! cmp -s "$SOURCE" "$TARGET"; then
  cp "$TARGET" "${TARGET}.bak.$(date +%s)"
fi
cp "$SOURCE" "$TARGET"
chmod +x "$TARGET"
chmod +x "$HOME/m3pro_teacher_ws/setup/container_autostart.sh"
echo "  installed $TARGET"
echo "  autostart dir: $HOME/robot_maps"
REMOTE_SETUP

# -----------------------------------------------------------------------------
# 5. stop any stale containers bound to the m3pro image
# -----------------------------------------------------------------------------
say "[5/9] stop stale rosmaster-m3pro containers"
ssh "$ROBOT_USER@$ROBOT_HOST" bash -s <<'REMOTE_STOP'
set -e
# Any container whose image matches rosmaster-m3pro — not just ones named m3pro.
stale=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /rosmaster-m3pro/ {print $1}')
if [ -n "$stale" ]; then
  for c in $stale; do
    echo "  stopping $c"
    docker stop "$c" >/dev/null 2>&1 || true
    docker rm   "$c" >/dev/null 2>&1 || true
  done
else
  echo "  nothing to stop"
fi
REMOTE_STOP

# -----------------------------------------------------------------------------
# 6. launch the new m3pro container
# -----------------------------------------------------------------------------
say "[6/9] launch m3pro container via Docker_M3Pro_Joy.sh"
ssh "$ROBOT_USER@$ROBOT_HOST" '/home/'"$ROBOT_USER"'/Docker_M3Pro_Joy.sh'

# -----------------------------------------------------------------------------
# 7. first-run build inside the bind-mount
# -----------------------------------------------------------------------------
if [ "$SKIP_BUILD" = "1" ]; then
  say "[7/9] colcon build SKIPPED (SKIP_BUILD=1)"
else
  say "[7/9] colcon build in bind-mounted workspace (up to ~3 min)"
  # Wait for the container to actually exist before exec-ing in.
  for i in $(seq 1 20); do
    if ssh "$ROBOT_USER@$ROBOT_HOST" 'docker ps --format "{{.Names}}" | grep -qx m3pro'; then
      break
    fi
    sleep 1
  done
  ssh "$ROBOT_USER@$ROBOT_HOST" 'docker exec m3pro bash -lc "
    cd /root/m3pro_teacher_ws &&
    source /opt/ros/humble/setup.bash &&
    source /root/M3Pro_ws/install/setup.bash 2>/dev/null ;
    colcon build --symlink-install 2>&1 | tail -4
  "' || warn "colcon build had errors — docker exec -it m3pro bash to debug"

  # ament_python --symlink-install quirk: create lib/pkg/exec symlink so the
  # launch file can find the entry point.
  ssh "$ROBOT_USER@$ROBOT_HOST" 'docker exec m3pro bash -lc "
    mkdir -p /root/m3pro_teacher_ws/install/m3pro_teacher_web/lib/m3pro_teacher_web &&
    ln -sf ../../bin/web_server_node /root/m3pro_teacher_ws/install/m3pro_teacher_web/lib/m3pro_teacher_web/web_server_node
  "' 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# 8. restart container so autostart sees the fresh install/
# -----------------------------------------------------------------------------
say "[8/9] restart m3pro so container_autostart picks up install/"
ssh "$ROBOT_USER@$ROBOT_HOST" 'docker restart m3pro' >/dev/null

# -----------------------------------------------------------------------------
# 9. wait for ports 8080 + 9090, report
# -----------------------------------------------------------------------------
say "[9/9] waiting for web :8080 and rosbridge :9090 ..."
for i in $(seq 1 60); do
  if ssh "$ROBOT_USER@$ROBOT_HOST" 'ss -ltn 2>/dev/null | grep -q ":8080 " && ss -ltn 2>/dev/null | grep -q ":9090 "' 2>/dev/null; then
    say "  both ports listening after ${i}s"
    break
  fi
  sleep 2
  if [ "$i" = "60" ]; then
    warn "  timed out waiting for ports. Inspect with: ssh $ROBOT_USER@$ROBOT_HOST 'docker logs m3pro | tail -40'"
  fi
done

# -----------------------------------------------------------------------------
# Optional SSH port-forward from the Mac
# -----------------------------------------------------------------------------
if [ "$TUNNEL" = "1" ] && command -v ssh >/dev/null 2>&1; then
  pkill -f "ssh .*-L.*8080:localhost" >/dev/null 2>&1 || true
  ssh -fN -L 8080:localhost:8080 -L 9090:localhost:9090 "$ROBOT_USER@$ROBOT_HOST" \
    && say "SSH tunnel up: http://localhost:8080"
fi

cat <<EOF

\033[1;32m✓ Persistence installed.\033[0m

  Dashboard (LAN)     : http://$ROBOT_HOST:8080
  Dashboard (tunneled): http://localhost:8080    (mic needs this secure origin)
  Rosbridge           : ws://$ROBOT_HOST:9090
  VNC                 : vnc://$ROBOT_HOST:5900
  Maps persist in     : /home/$ROBOT_USER/robot_maps/  (bind-mounted to /root/maps)
  Workspace lives in  : /home/$ROBOT_USER/m3pro_teacher_ws/  (bind-mounted)

Next reboot / power cycle:
  - Docker starts automatically
  - \`--restart=unless-stopped\` brings the m3pro container back up
  - container_autostart.sh launches bringup + camera + SLAM/Nav2/explore + web dashboard
  - No manual SSH needed.

Useful commands:
  ssh $ROBOT_USER@$ROBOT_HOST 'docker logs -f m3pro'            # autostart log
  ssh $ROBOT_USER@$ROBOT_HOST 'docker exec m3pro tail -f /tmp/m3pro_explore.log'
  ssh $ROBOT_USER@$ROBOT_HOST 'docker exec -it m3pro bash'      # interactive shell
  ./setup/start_slam_nav_on_robot.sh $ROBOT_HOST status        # at-a-glance status
EOF
