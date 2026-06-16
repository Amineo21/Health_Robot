#!/usr/bin/env python3
"""
M3 Pro launch supervisor.

Runs inside the Docker container as the direct or near-direct child of PID 1.
Spawns every launch the stack needs (bringup, camera, mode-stack, dashboard),
watches their process trees, and relaunches any that die. Publishes a JSON
status snapshot on /teacher/watchdog/status so the dashboard can show per-
service up/down state and restart counts.

Exposes a small control surface:

  topic   /teacher/watchdog/status          (std_msgs/String, JSON)
  service /teacher/watchdog/set_mode        (std_srvs/SetBool trick:
                                             data=True  means explore,
                                             data=False means navigation — but
                                             we actually accept arbitrary
                                             mode strings via a std_msgs/String
                                             on /teacher/watchdog/mode_cmd for
                                             finer control.)
  topic   /teacher/watchdog/mode_cmd        (std_msgs/String; publish
                                             "explore" / "navigation" / "slam-nav"
                                             to switch, or "restart:<service>"
                                             to force-restart just one service.)

Status JSON shape:

  {
    "mode":          "explore",
    "mode_requested": null,          // or "navigation" while a switch is pending
    "services": {
      "bringup":   {"alive": true,  "pid": 123, "restarts": 0, "last_restart": 0},
      "camera":    {"alive": false, "pid": null, "restarts": 3, "last_restart": 1776..},
      "mode":      {"alive": true,  "pid": 234, "restarts": 0, "last_restart": 0,
                    "cmd": "ros2 launch m3pro_teacher_nav explore.launch.py"},
      "dashboard": {"alive": true,  "pid": 456, "restarts": 0, "last_restart": 0}
    },
    "uptime_s": 482
  }

Spawned processes all run in a fresh session (setsid) so our own signals
don't propagate to them. Kill lineage is handled explicitly via process group
IDs when we need a clean shutdown.
"""
import json
import os
import shlex
import signal
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

import rclpy
from nav_msgs.msg import Odometry
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from std_msgs.msg import Float32, String


M3PRO_WS = os.environ.get("M3PRO_WS", "/root/m3pro_teacher_ws")
MAPS_DIR = os.environ.get("MAPS_DIR", "/root/maps")
MAP_NAME = os.environ.get("MAP_NAME", "m3pro_map")
SKIP_CAMERA = os.environ.get("SKIP_CAMERA", "0") == "1"


ROS_SETUP = (
    "source /opt/ros/humble/setup.bash ; "
    "[ -f /root/yahboomcar_ws/install/setup.bash ] && source /root/yahboomcar_ws/install/setup.bash ; "
    "[ -f /root/M3Pro_ws/install/setup.bash ] && source /root/M3Pro_ws/install/setup.bash ; "
    f"[ -f {M3PRO_WS}/install/setup.bash ] && source {M3PRO_WS}/install/setup.bash ; "
)


def mode_cmd_for(mode: str) -> str:
    """Return the ros2 launch command for a given mode."""
    if mode == "navigation":
        return f"ros2 launch m3pro_teacher_nav localize.launch.py map:={shlex.quote(f'{MAPS_DIR}/{MAP_NAME}')}"
    if mode == "slam-nav":
        return "ros2 launch m3pro_teacher_nav slam_and_nav.launch.py rviz:=false"
    # default
    return "ros2 launch m3pro_teacher_nav explore.launch.py"


VALID_MODES = {"explore", "navigation", "slam-nav"}

# Children that sometimes escape `ros2 launch`'s process-group cleanup —
# we force-kill them by name on a mode switch. Other services are owned by
# their launch parent so killing the parent is sufficient.
MODE_STACK_ZOMBIES = [
    "async_slam_toolbox_node",
    "localization_slam_toolbox_node",
    "controller_server",
    "planner_server",
    "smoother_server",
    "behavior_server",
    "bt_navigator",
    "lifecycle_manager",
    "explore_node",
    "rosbridge_websocket",
]


@dataclass
class Service:
    name: str
    cmd: str
    proc: Optional[subprocess.Popen] = None
    restarts: int = 0
    last_restart: float = 0.0

    @property
    def alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    @property
    def pid(self) -> Optional[int]:
        return self.proc.pid if self.proc else None


class Watchdog(Node):
    BACKOFF_S = 15.0          # min seconds between restarts of the same service
    POLL_PERIOD_S = 5.0       # monitor tick

    def __init__(self) -> None:
        super().__init__("m3pro_watchdog")
        self.started = time.time()
        self._svcs: Dict[str, Service] = {}
        self.mode: str = "explore"
        self.mode_requested: Optional[str] = None

        self.status_pub = self.create_publisher(String, "/teacher/watchdog/status", 10)
        self.create_subscription(String, "/teacher/watchdog/mode_cmd", self._on_mode_cmd, 10)

        # Dependency health watches — "is the sensor still alive?" probes. We
        # just track the last-received timestamp for each and compute freshness
        # at status-publish time.
        self._last = {"odom_raw": 0.0, "scan_multi": 0.0, "battery": 0.0}
        self.create_subscription(Odometry, "/odom_raw",
                                 lambda _m: self._touch("odom_raw"), 10)
        self.create_subscription(LaserScan, "/scan_multi",
                                 lambda _m: self._touch("scan_multi"), 10)
        self.create_subscription(Float32, "/battery",
                                 lambda _m: self._touch("battery"), 10)

        self._boot()

        # Periodic monitor.
        self.create_timer(self.POLL_PERIOD_S, self._tick)
        # More frequent status publish so the dashboard updates smoothly.
        self.create_timer(1.0, self._publish_status)

    def _touch(self, name: str) -> None:
        self._last[name] = time.time()

    # --- startup / lifecycle --------------------------------------------------

    def _spawn(self, svc: Service) -> None:
        logfile = f"/tmp/m3pro_{svc.name}.log"
        # Use `bash -c` (NOT `bash -lc`). A login shell sources /etc/profile
        # and ~/.profile, some of which block on pipe_wait in the container
        # and piled up hundreds of zombie-ish bash children. We source ROS
        # overlays explicitly via ROS_SETUP so login behavior gains us
        # nothing.
        wrapped = f"{ROS_SETUP} exec {svc.cmd} >{shlex.quote(logfile)} 2>&1"
        # start_new_session=True does the setsid without preexec_fn, which
        # avoids a subprocess-internal error-reporting pipe (FD 3) that was
        # getting inherited by bash and leaving it stuck on pipe_wait.
        # close_fds ensures we don't leak any other parent FDs into the child.
        svc.proc = subprocess.Popen(
            ["bash", "-c", wrapped],
            start_new_session=True,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        svc.last_restart = time.time()
        self.get_logger().info(f"▶ spawned {svc.name} pid={svc.proc.pid} (log {logfile})")

    def _kill(self, svc: Service, sig: int = signal.SIGINT) -> None:
        if not svc.proc:
            return
        try:
            # Signal the whole process group so ros2 launch's children also go.
            pgid = os.getpgid(svc.proc.pid)
            os.killpg(pgid, sig)
        except ProcessLookupError:
            pass
        except Exception as e:
            self.get_logger().warn(f"kill {svc.name}: {e}")

    def _log(self, msg: str) -> None:
        """Log + stderr so we always see it even if rclpy logging is weird."""
        self.get_logger().info(msg)
        print(f"[watchdog] {msg}", flush=True)

    def _boot(self) -> None:
        self._log(f"_boot called once. BACKOFF_S={self.BACKOFF_S} POLL_PERIOD_S={self.POLL_PERIOD_S}")
        # Ensure workspace symlinks exist (web_server_node exec + live HTML dir).
        try:
            web_bin = f"{M3PRO_WS}/install/m3pro_teacher_web/bin/web_server_node"
            if Path(web_bin).is_file():
                libdir = Path(f"{M3PRO_WS}/install/m3pro_teacher_web/lib/m3pro_teacher_web")
                libdir.mkdir(parents=True, exist_ok=True)
                link = libdir / "web_server_node"
                if not link.exists():
                    link.symlink_to("../../bin/web_server_node")
            web_src = Path(f"{M3PRO_WS}/src/m3pro_teacher_web/web")
            web_install = Path(f"{M3PRO_WS}/install/m3pro_teacher_web/share/m3pro_teacher_web/web")
            if web_src.is_dir() and web_install.exists() and not web_install.is_symlink():
                import shutil
                shutil.rmtree(web_install)
                web_install.symlink_to(web_src)
        except Exception as e:
            self.get_logger().warn(f"symlink fixup: {e}")

        Path(MAPS_DIR).mkdir(parents=True, exist_ok=True)

        self._svcs["bringup"] = Service("bringup",
            "ros2 launch M3Pro_navigation base_bringup.launch.py")
        if not SKIP_CAMERA:
            self._svcs["camera"] = Service("camera",
                "ros2 launch slam_mapping app_camera.launch.py")
        self._svcs["mode"] = Service("mode", mode_cmd_for(self.mode))
        self._svcs["dashboard"] = Service("dashboard",
            "ros2 launch m3pro_teacher_web web_dashboard.launch.py rosbridge:=false port:=8080")

        for svc in self._svcs.values():
            self._spawn(svc)

    # --- mode switching -------------------------------------------------------

    def _on_mode_cmd(self, msg: String) -> None:
        cmd = (msg.data or "").strip()
        if not cmd:
            return
        if cmd.startswith("restart:"):
            name = cmd.split(":", 1)[1].strip()
            svc = self._svcs.get(name)
            if not svc:
                self.get_logger().warn(f"restart: unknown service '{name}'")
                return
            self.get_logger().info(f"restart requested for {name}")
            self._kill(svc, signal.SIGINT)
            # Monitor loop will relaunch on next tick.
            return
        if cmd not in VALID_MODES:
            self.get_logger().warn(f"invalid mode_cmd '{cmd}' (valid: {VALID_MODES})")
            return
        if cmd == self.mode:
            self.get_logger().info(f"mode '{cmd}' already active — forcing restart")
            self._kill(self._svcs["mode"], signal.SIGINT)
            return
        self.get_logger().info(f"mode change requested: {self.mode} → {cmd}")
        self.mode_requested = cmd
        self._kill(self._svcs["mode"], signal.SIGINT)

    def _apply_pending_mode(self) -> None:
        if self.mode_requested is None:
            return
        svc = self._svcs["mode"]
        # Wait for the previous mode launch to fully die.
        if svc.alive:
            return
        # Force-clear any lingering mode-stack children.
        for zombie in MODE_STACK_ZOMBIES:
            subprocess.run(["pkill", "-KILL", "-f", zombie],
                           check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.mode = self.mode_requested
        self.mode_requested = None
        svc.cmd = mode_cmd_for(self.mode)
        # Fall through; monitor tick will spawn it.

    # --- monitor --------------------------------------------------------------

    def _tick(self) -> None:
        # AUTO-RESPAWN DISABLED — during debugging we hit a runaway spawn loop
        # where even with BACKOFF_S=15 the watchdog kept launching `bash -c
        # "ros2 launch ..."` children that stuck in pipe_wait on the Jetson
        # under heavy load, driving load average over 400. The stack is more
        # useful with monitor-only behaviour: if a service dies it's reported
        # via /teacher/watchdog/status and the user can click Reset SLAM to
        # force a respawn (via mode_cmd, which DOES call _spawn).
        self._apply_pending_mode()

    # --- status publish -------------------------------------------------------

    def _publish_status(self) -> None:
        now = time.time()
        # Freshness = seconds since last message, or None if never seen.
        def age(name):
            ts = self._last.get(name, 0.0)
            return (now - ts) if ts > 0 else None

        payload = {
            "mode": self.mode,
            "mode_requested": self.mode_requested,
            "services": {
                name: {
                    "alive": svc.alive,
                    "pid": svc.pid,
                    "restarts": svc.restarts,
                    "last_restart": int(svc.last_restart) if svc.last_restart else 0,
                    "cmd": svc.cmd,
                } for name, svc in self._svcs.items()
            },
            "feeds": {
                # "age" in seconds since last message. "alive" = fresh (< 5 s).
                # /odom_raw missing = MCU session dead → Nav2 will stall.
                "odom_raw":   {"age": age("odom_raw"),   "alive": (age("odom_raw")   or 99) < 5},
                "scan_multi": {"age": age("scan_multi"), "alive": (age("scan_multi") or 99) < 5},
                "battery":    {"age": age("battery"),    "alive": (age("battery")    or 99) < 10},
            },
            "uptime_s": int(time.time() - self.started),
        }
        msg = String()
        msg.data = json.dumps(payload)
        self.status_pub.publish(msg)

    # --- shutdown -------------------------------------------------------------

    def shutdown(self) -> None:
        self.get_logger().info("watchdog shutting down — killing children")
        for svc in self._svcs.values():
            self._kill(svc, signal.SIGINT)
        time.sleep(2)
        for svc in self._svcs.values():
            self._kill(svc, signal.SIGKILL)


def main() -> None:
    rclpy.init()
    node = Watchdog()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.shutdown()
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
