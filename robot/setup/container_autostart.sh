#!/bin/bash
# =============================================================================
# Simple, reliable autostart — spawn each launch once, keep PID 1 alive.
# No watchdog. No respawn. No monitor loops. Previously the watchdog node
# had a subtle bug that caused runaway bash spawning (load avg 400+), so for
# now we go back to basics. User can manually `docker exec` and fix anything
# that dies.
# =============================================================================

M3PRO_WS="${M3PRO_WS:-/root/m3pro_teacher_ws}"
MAPS_DIR="${MAPS_DIR:-/root/maps}"

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
export FASTDDS_BUILTIN_TRANSPORTS="${FASTDDS_BUILTIN_TRANSPORTS:-UDPv4}"

mkdir -p "$MAPS_DIR"

source /opt/ros/humble/setup.bash
[ -f /root/yahboomcar_ws/install/setup.bash ] && source /root/yahboomcar_ws/install/setup.bash
[ -f /root/M3Pro_ws/install/setup.bash ] && source /root/M3Pro_ws/install/setup.bash

# First-run build of the teacher workspace if install/ is empty.
if [ -d "$M3PRO_WS/src" ] && [ ! -f "$M3PRO_WS/install/setup.bash" ]; then
  echo "[bootstrap] first-run colcon build ..."
  ( cd "$M3PRO_WS" && colcon build --symlink-install ) 2>&1 | tail -10 \
    || echo "[bootstrap] WARN: colcon build had errors"
fi

# ament_python quirks — make web_server_node discoverable + live HTML edits.
if [ -f "$M3PRO_WS/install/m3pro_teacher_web/bin/web_server_node" ]; then
  mkdir -p "$M3PRO_WS/install/m3pro_teacher_web/lib/m3pro_teacher_web"
  ln -sf "../../bin/web_server_node" \
         "$M3PRO_WS/install/m3pro_teacher_web/lib/m3pro_teacher_web/web_server_node"
fi
WEB_SRC="$M3PRO_WS/src/m3pro_teacher_web/web"
WEB_INSTALL="$M3PRO_WS/install/m3pro_teacher_web/share/m3pro_teacher_web/web"
if [ -d "$WEB_SRC" ] && [ -e "$WEB_INSTALL" ] && [ ! -L "$WEB_INSTALL" ]; then
  rm -rf "$WEB_INSTALL"; ln -sf "$WEB_SRC" "$WEB_INSTALL"
fi

[ -f "$M3PRO_WS/install/setup.bash" ] && source "$M3PRO_WS/install/setup.bash"

# -----------------------------------------------------------------------------
# Spawn helper — runs in a new session so SIGTERM to our shell doesn't kill them.
# -----------------------------------------------------------------------------
spawn_once() {
  local name="$1"; shift
  local logfile="/tmp/m3pro_${name}.log"
  echo "[bootstrap] ▶ starting $name (log $logfile)"
  setsid nohup "$@" >"$logfile" 2>&1 < /dev/null &
  disown || true
}

# Launches — in dependency order, with small sleeps so TF/discovery settles.
spawn_once bringup ros2 launch M3Pro_navigation base_bringup.launch.py
sleep 5
spawn_once camera ros2 launch slam_mapping app_camera.launch.py
sleep 3
spawn_once mode ros2 launch m3pro_teacher_nav slam_online.launch.py rviz:=false
sleep 3
spawn_once dashboard ros2 launch m3pro_teacher_web web_dashboard.launch.py rosbridge:=false port:=8080

echo "[bootstrap] all launched. Keeping PID 1 alive via tail -f /dev/null."
echo "[bootstrap] dashboard: http://$(hostname -I | awk '{print $1}'):8080"
echo "[bootstrap] rosbridge: ws://$(hostname -I | awk '{print $1}'):9090"
echo "[bootstrap] logs: /tmp/m3pro_bringup.log /tmp/m3pro_camera.log /tmp/m3pro_mode.log /tmp/m3pro_dashboard.log"

# PID 1 must stay alive for the container to live. Ignore SIGTERM so docker
# stop → kill all children cleanly.
trap 'echo "[bootstrap] SIGTERM — killing children"; pkill -TERM -P $$ ; sleep 2 ; pkill -KILL -P $$ ; exit 0' TERM INT
tail -f /dev/null
