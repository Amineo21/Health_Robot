#!/usr/bin/env python3
"""
ROS 2 node that serves the M3 Pro web dashboard over HTTP plus a collection
of side-endpoints for things rosbridge isn't well-suited for:

  GET  /                             static dashboard
  GET  /camera/snapshot              latest camera JPEG
  GET  /camera/stream                MJPEG stream
  POST /mic/chunk                    push an Opus/WebM mic chunk; server republishes
                                     on /teacher/mic_chunks AND streams it to
                                     ffplay so it comes out of the robot's speaker
  POST /mode/switch   (json)         {mode: mapping|navigation, map?: path}
                                     kills the current ros2 launch and starts the
                                     requested one
  GET  /sounds                       list uploaded mp3 files
  POST /sounds/upload  (raw body)    with ?name=<filename.mp3>, stores under
                                     /root/sounds/ (persistent while the container
                                     lives)
  POST /sounds/play/<name>           plays the named file via ffplay
  POST /sounds/delete/<name>         removes it
"""
import json
import os
import re
import shlex
import signal
import subprocess
import threading
import time
import urllib.parse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image
from std_msgs.msg import MultiArrayDimension, String, UInt8MultiArray

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


# =============================================================================
# Audio sinks — mic playback + mp3 soundboard — run ffplay subprocesses so the
# MCU speaker / HDMI audio picks them up. ffplay is in the ros-humble image via
# the ffmpeg transitive dependency, but we tolerate its absence.
# =============================================================================

SOUNDS_DIR = Path("/root/sounds")
SOUNDS_DIR.mkdir(exist_ok=True)

MAPS_DIR = Path("/root/maps")
MAPS_DIR.mkdir(exist_ok=True)


def list_maps() -> list:
    """Scan MAPS_DIR for saved map sets.

    A 'map' is a set of files sharing a base name, e.g.:
      m3pro_map.yaml        (occupancy grid metadata for AMCL / map_server)
      m3pro_map.pgm         (occupancy grid bitmap)
      m3pro_map.data        (slam_toolbox serialized pose graph)
      m3pro_map.posegraph   (slam_toolbox ancillary)
    """
    maps = {}
    for p in MAPS_DIR.iterdir():
        if not p.is_file():
            continue
        stem = p.stem
        maps.setdefault(stem, {"name": stem, "parts": {}, "mtime": 0, "size": 0})
        maps[stem]["parts"][p.suffix.lstrip(".")] = p.name
        maps[stem]["size"] += p.stat().st_size
        maps[stem]["mtime"] = max(maps[stem]["mtime"], int(p.stat().st_mtime))
    out = []
    for stem, info in maps.items():
        # Navigation mode uses Nav2 + AMCL, so it needs an occupancy grid map.
        info["loadable"] = ("yaml" in info["parts"]) and ("pgm" in info["parts"])
        out.append(info)
    out.sort(key=lambda m: -m["mtime"])
    return out


def delete_map(name: str) -> dict:
    safe = _safe_filename(name)
    removed = []
    for ext in (".data", ".posegraph", ".yaml", ".pgm"):
        p = MAPS_DIR / f"{safe}{ext}"
        if p.is_file():
            try:
                p.unlink(); removed.append(p.name)
            except Exception as e:
                return {"ok": False, "error": f"{p.name}: {e}"}
    return {"ok": True, "removed": removed}


def _have(binary: str) -> bool:
    from shutil import which
    return which(binary) is not None


class MicPlayer:
    """Keep a persistent ffplay subprocess fed by the mic WebM stream.

    Each push-to-talk session is a fresh WebM container (MediaRecorder starts a
    new header each time you stop/start). We detect session boundaries by a
    silence timeout and respawn ffplay per session.
    """

    def __init__(self, logger):
        self.logger = logger
        self.proc: Optional[subprocess.Popen] = None
        self.last_chunk_ts = 0.0
        self.lock = threading.Lock()
        self.session_gap = 1.5  # seconds of silence → new session

    def feed(self, chunk: bytes, mime: str) -> None:
        if not _have("ffplay"):
            return
        now = time.time()
        with self.lock:
            if self.proc and (now - self.last_chunk_ts) > self.session_gap:
                # Previous session finished — close stdin so ffplay drains + exits.
                try:
                    self.proc.stdin.close()
                except Exception:
                    pass
                try:
                    self.proc.wait(timeout=1.0)
                except Exception:
                    self.proc.kill()
                self.proc = None
            if self.proc is None:
                # `-` = stdin, `-nodisp` = no video window, `-autoexit` on EOF.
                self.proc = subprocess.Popen(
                    ["ffplay", "-loglevel", "error", "-nodisp",
                     "-autoexit", "-f", "webm", "-"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                self.logger.info("Spawned ffplay for mic playback")
            try:
                self.proc.stdin.write(chunk)
                self.proc.stdin.flush()
            except BrokenPipeError:
                self.proc = None  # will respawn next chunk
            self.last_chunk_ts = now


def play_sound_file(path: Path) -> bool:
    """Fire-and-forget ffplay for a local file. Returns True if launched."""
    if not _have("ffplay"):
        return False
    try:
        subprocess.Popen(
            ["ffplay", "-loglevel", "error", "-nodisp", "-autoexit", str(path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


# =============================================================================
# Mode switch — kill current ros2 launch(es), start a new one
# =============================================================================

LAUNCH_BY_MODE = {
    "mapping":    "ros2 launch m3pro_teacher_nav slam_online.launch.py rviz:=false",
    "navigation": "ros2 launch m3pro_teacher_nav navigation.launch.py map:={map} rviz:=false",
}
ROS_SETUP = (
    "source /opt/ros/humble/setup.bash ; "
    "[ -f /root/yahboomcar_ws/install/setup.bash ] && source /root/yahboomcar_ws/install/setup.bash ; "
    "[ -f /root/M3Pro_ws/install/setup.bash ] && source /root/M3Pro_ws/install/setup.bash ; "
    "[ -f /root/m3pro_teacher_ws/install/setup.bash ] && source /root/m3pro_teacher_ws/install/setup.bash ; "
)


VALID_MODES = set(LAUNCH_BY_MODE.keys())
MODE_FAILURE_PATTERNS = (
    re.compile(r"Failed to load map yaml file"),
    re.compile(r"Failed processing YAML file"),
    re.compile(r"Failed to bring up all requested nodes"),
    re.compile(r"Caught exception in callback for transition"),
)

# Exposed by /mode/status so the dashboard can poll the progress of an
# in-flight mode switch. Updated from the background thread that runs the
# kill-and-relaunch sequence.
_mode_state = {
    "active": "mapping",        # best-guess current mode (updated on success)
    "pending": None,            # mode being switched TO, or None if idle
    "progress": "idle",         # short human label
    "log_tail": "",             # last line of the target mode's launch log
    "started_at": 0,
    "finished_at": 0,
    "ok": True,
    "error": None,
}
_mode_lock = threading.Lock()


def _status_update(**kw):
    with _mode_lock:
        _mode_state.update(kw)


def _read_tail(path: str, lines: int = 1) -> str:
    try:
        with open(path, "rb") as f:
            f.seek(0, 2); size = f.tell()
            f.seek(max(0, size - 4096))
            text = f.read().decode("utf-8", "replace").splitlines()
            return "\n".join(text[-lines:])
    except Exception:
        return ""


def _proc_exists(pattern: str) -> bool:
    return subprocess.run(
        ["pgrep", "-f", pattern],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0


def _ros2_topic_exists(topic: str, timeout_s: int = 5) -> bool:
    cmd = (
        f"{ROS_SETUP}"
        f"timeout {int(timeout_s)} ros2 topic list 2>/dev/null | "
        f"grep -qx {shlex.quote(topic)}"
    )
    return subprocess.run(
        ["bash", "-lc", cmd],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0


def _port_open(port: int) -> bool:
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", port), timeout=1)
        sock.close()
        return True
    except OSError:
        return False


def _read_failure(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-200:]
    except Exception:
        return None
    for line in reversed(lines):
        text = line.strip()
        if any(p.search(text) for p in MODE_FAILURE_PATTERNS):
            return text
    return None


def _mode_ready(mode: str) -> bool:
    if not _port_open(9090):
        return False
    if mode == "mapping":
        return _ros2_topic_exists("/map", timeout_s=3)
    if mode == "navigation":
        return _ros2_topic_exists("/map", timeout_s=3) and _ros2_topic_exists("/amcl_pose", timeout_s=3)
    return False


def _normalize_map_arg(mode: str, map_path: str) -> str:
    chosen = (map_path or "/root/maps/m3pro_map").strip()
    if mode == "navigation" and not chosen.endswith(".yaml"):
        chosen = f"{chosen}.yaml"
    return chosen


def detect_active_mode() -> str:
    """Best-effort process-based mode detection for non-watchdog deployments."""
    if _proc_exists("navigation.launch.py") or _proc_exists(r"/nav2_amcl/amcl"):
        return "navigation"
    if _proc_exists("localize.launch.py") or _proc_exists("localization_slam_toolbox_node"):
        return "navigation"
    if _proc_exists("explore.launch.py") or _proc_exists("explore_node"):
        return "mapping"
    if _proc_exists("manual_mapping.launch.py") or _proc_exists("slam_online.launch.py"):
        return "mapping"
    if _proc_exists("slam_and_nav.launch.py") or _proc_exists("async_slam_toolbox_node"):
        return "mapping"
    return _mode_state["active"]


def switch_mode(mode: str, map_path: str, logger) -> dict:
    """Kill the current mode launch and start the requested one.

    Runs in a background thread so the HTTP response returns fast. Caller can
    poll /mode/status for progress.
    """
    if mode not in VALID_MODES:
        return {"ok": False, "error": f"unknown mode '{mode}' (valid: {sorted(VALID_MODES)})"}
    if _mode_state["pending"] is not None:
        return {"ok": False, "error": f"mode switch already in progress ({_mode_state['pending']})"}

    normalized_map = _normalize_map_arg(mode, map_path)
    target = LAUNCH_BY_MODE[mode].format(map=shlex.quote(normalized_map))
    log_path = f"/tmp/m3pro_mode.log"

    def worker():
        _status_update(pending=mode, progress="killing existing mode launch",
                       ok=True, error=None, started_at=int(time.time()),
                       finished_at=0, log_tail="")
        # Kill any previous mapping/navigation/explore launch parents
        # plus common stuck children.
        kill_patterns = [
            "slam_online.launch.py", "manual_mapping.launch.py", "explore.launch.py", "localize.launch.py",
            "slam_and_nav.launch.py", "navigation.launch.py",
            "async_slam_toolbox_node", "localization_slam_toolbox_node",
            "controller_server", "planner_server", "smoother_server",
            "behavior_server", "bt_navigator", "lifecycle_manager",
            "explore_node", "rosbridge_websocket",
        ]
        for sig in ("INT", "TERM", "KILL"):
            for pat in kill_patterns:
                subprocess.run(["pkill", f"-{sig}", "-f", pat], check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(2 if sig == "INT" else 1)

        _status_update(progress=f"launching {mode}")
        wrapped = f"{ROS_SETUP} exec {target} >{shlex.quote(log_path)} 2>&1"
        subprocess.Popen(
            ["bash", "-c", wrapped],
            start_new_session=True, close_fds=True,
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        logger.info(f"Mode switch → {mode} (log {log_path})")

        ok = False
        for i in range(45):
            time.sleep(1)
            tail = _read_tail(log_path, 1)[:120]
            _status_update(progress=f"launching {mode} ({i+1}s) — tail: {tail}")
            failure = _read_failure(log_path)
            if failure:
                _status_update(
                    active=detect_active_mode(),
                    pending=None,
                    progress="error",
                    ok=False,
                    error=failure,
                    finished_at=int(time.time()),
                    log_tail=_read_tail(log_path, 8),
                )
                return
            if _mode_ready(mode):
                ok = True
                break
        _status_update(
            active=mode if ok else detect_active_mode(),
            pending=None,
            progress="done" if ok else f"timeout waiting for {mode} readiness",
            ok=ok,
            error=None if ok else f"{mode} did not become ready within 45s",
            finished_at=int(time.time()),
            log_tail=_read_tail(log_path, 4),
        )

    threading.Thread(target=worker, daemon=True).start()
    return {"ok": True, "mode": mode, "note": "switching — poll /mode/status"}


def mode_status() -> dict:
    with _mode_lock:
        status = dict(_mode_state)
    if status["pending"] is None:
        status["active"] = detect_active_mode()
    return status


# =============================================================================
# HTTP handler
# =============================================================================

SAFE_NAME = str.maketrans({c: "_" for c in "/\\..:;\"'*?<>|"})


def _safe_filename(name: str) -> str:
    return Path(name).name.translate(SAFE_NAME) or "file"


class DashboardHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, node=None, **kwargs):
        self.node = node
        super().__init__(*args, **kwargs)

    # ----- CORS preflight -----
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers",
                         "Content-Type, X-Mic-Mime, X-Mic-Sample-Rate")
        self.end_headers()

    def end_headers(self):
        # Always allow cross-origin — the dashboard may be served locally.
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    # ----- GET -----
    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route == "/camera/snapshot":
            self.serve_snapshot()
        elif route == "/camera/stream":
            self.serve_mjpeg_stream()
        elif route == "/sounds":
            self.serve_sound_list()
        elif route == "/mode/status":
            self._json(200, mode_status())
        elif route == "/maps":
            self._json(200, {"maps": list_maps()})
        else:
            super().do_GET()

    # ----- POST -----
    def do_POST(self):
        route = self.path.split("?", 1)[0]
        if route.startswith("/mic/chunk"):
            self.handle_mic_chunk()
        elif route == "/mode/switch":
            self.handle_mode_switch()
        elif route == "/sounds/upload":
            self.handle_sound_upload()
        elif route.startswith("/sounds/play/"):
            self.handle_sound_play(route[len("/sounds/play/"):])
        elif route.startswith("/sounds/delete/"):
            self.handle_sound_delete(route[len("/sounds/delete/"):])
        elif route.startswith("/maps/load/"):
            self.handle_map_load(route[len("/maps/load/"):])
        elif route.startswith("/maps/delete/"):
            self.handle_map_delete(route[len("/maps/delete/"):])
        else:
            self.send_error(404, "Not Found")

    def handle_map_load(self, name: str):
        safe = _safe_filename(urllib.parse.unquote(name))
        map_yaml = str(MAPS_DIR / f"{safe}.yaml")
        if not (MAPS_DIR / f"{safe}.yaml").is_file():
            self._json(404, {"ok": False, "error": f"map '{safe}' .yaml file not found"})
            return
        if self.node is None:
            self._json(500, {"ok": False, "error": "web_server_node not ready"})
            return
        res = switch_mode("navigation", map_yaml, self.node.get_logger())
        res["map"] = safe
        self._json(200 if res.get("ok") else 400, res)

    def handle_map_delete(self, name: str):
        safe = _safe_filename(urllib.parse.unquote(name))
        res = delete_map(safe)
        self._json(200 if res.get("ok") else 500, res)

    # ----- helpers -----
    def _json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self, max_bytes: int) -> Optional[bytes]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > max_bytes:
            self.send_error(400, f"Missing or oversized body (max {max_bytes})")
            return None
        return self.rfile.read(length)

    # ----- endpoints -----
    def serve_snapshot(self):
        jpeg = self.node.get_jpeg() if self.node else None
        if jpeg is None:
            self.send_error(503, "No camera frame available yet")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(jpeg)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(jpeg)

    def serve_mjpeg_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            while True:
                jpeg = self.node.get_jpeg() if self.node else None
                if jpeg is not None:
                    self.wfile.write(b"--frame\r\n")
                    self.wfile.write(b"Content-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
                    self.wfile.write(jpeg)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
                time.sleep(0.15)  # ~6 FPS
        except (BrokenPipeError, ConnectionResetError):
            pass

    def handle_mic_chunk(self):
        audio = self._read_body(2_000_000)
        if audio is None:
            return
        mime = self.headers.get("X-Mic-Mime", "audio/webm;codecs=opus")
        rate = self.headers.get("X-Mic-Sample-Rate", "48000")
        try:
            if self.node:
                self.node.on_mic_chunk(audio, mime, rate)
        except Exception:
            pass
        self.send_response(204)
        self.end_headers()

    def handle_mode_switch(self):
        body = self._read_body(4096)
        if body is None:
            return
        try:
            payload = json.loads(body.decode() or "{}")
        except Exception:
            self._json(400, {"ok": False, "error": "invalid JSON"})
            return
        mode = payload.get("mode", "")
        map_path = payload.get("map", "/root/maps/m3pro_map")
        res = switch_mode(mode, map_path, self.node.get_logger()) if self.node else {"ok": False}
        self._json(200 if res.get("ok") else 400, res)

    def serve_sound_list(self):
        entries = []
        for p in sorted(SOUNDS_DIR.glob("*")):
            if p.is_file():
                entries.append({
                    "name": p.name,
                    "size": p.stat().st_size,
                    "modified": int(p.stat().st_mtime),
                })
        self._json(200, {"sounds": entries})

    def handle_sound_upload(self):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        name = _safe_filename((params.get("name") or ["upload.bin"])[0])
        body = self._read_body(25_000_000)  # 25 MB per file
        if body is None:
            return
        dest = SOUNDS_DIR / name
        try:
            dest.write_bytes(body)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            return
        self._json(200, {"ok": True, "name": name, "size": len(body)})

    def handle_sound_play(self, name: str):
        name = _safe_filename(urllib.parse.unquote(name))
        path = SOUNDS_DIR / name
        if not path.is_file():
            self._json(404, {"ok": False, "error": "not found"})
            return
        ok = play_sound_file(path)
        self._json(200 if ok else 500, {"ok": ok, "name": name})

    def handle_sound_delete(self, name: str):
        name = _safe_filename(urllib.parse.unquote(name))
        path = SOUNDS_DIR / name
        if path.is_file():
            try:
                path.unlink()
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                return
        self._json(200, {"ok": True, "name": name})

    def log_message(self, format, *args):
        pass  # suppress per-request logs


# =============================================================================
# ROS 2 node
# =============================================================================

class WebServerNode(Node):
    def __init__(self):
        super().__init__("web_server_node")
        self.port = int(self.declare_parameter("port", 8080).value)
        self.camera_topic = self.declare_parameter(
            "camera_topic", "/camera/color/image_raw"
        ).value

        self.latest_jpeg: Optional[bytes] = None
        self.jpeg_lock = threading.Lock()

        self.mic_chunks_pub = self.create_publisher(UInt8MultiArray, "/teacher/mic_chunks", 20)
        self.mic_meta_pub = self.create_publisher(String, "/teacher/mic_meta", 5)
        # Mode-change commands sent to m3pro_teacher_watchdog via this topic.
        global _mode_cmd_pub
        _mode_cmd_pub = self.create_publisher(String, "/teacher/watchdog/mode_cmd", 10)
        self._mic_chunk_count = 0
        self.mic_player = MicPlayer(self.get_logger())

        if HAS_CV2:
            self.create_subscription(
                Image, self.camera_topic, self.on_image, qos_profile_sensor_data,
            )
            self.get_logger().info(f"Subscribed to camera: {self.camera_topic}")
        else:
            self.get_logger().warning("cv2 not available — camera JPEG endpoint disabled")

        from ament_index_python.packages import get_package_share_directory
        web_dir = str(Path(get_package_share_directory("m3pro_teacher_web")) / "web")

        handler = partial(DashboardHandler, node=self, directory=web_dir)
        self.httpd = ThreadingHTTPServer(("0.0.0.0", self.port), handler)
        self.httpd.daemon_threads = True
        self.http_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.http_thread.start()
        self.get_logger().info(f"Web dashboard: http://0.0.0.0:{self.port}")
        if not _have("ffplay"):
            self.get_logger().warning(
                "ffplay not found — audio playback (mic, soundboard) will be disabled"
            )

    def on_image(self, msg: Image):
        try:
            encoding = msg.encoding.lower()
            h, w = msg.height, msg.width
            data = bytes(msg.data)
            if encoding == "rgb8":
                arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w, 3)
                arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            elif encoding == "bgr8":
                arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w, 3)
            elif encoding in ("mono8", "8uc1"):
                arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w)
            elif encoding == "rgba8":
                arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w, 4)
                arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
            elif encoding == "bgra8":
                arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w, 4)
                arr = cv2.cvtColor(arr, cv2.COLOR_BGRA2BGR)
            else:
                return
            _, jpeg_buf = cv2.imencode(".jpg", arr, [cv2.IMWRITE_JPEG_QUALITY, 70])
            with self.jpeg_lock:
                self.latest_jpeg = jpeg_buf.tobytes()
        except Exception:
            pass

    def get_jpeg(self):
        with self.jpeg_lock:
            return self.latest_jpeg

    def on_mic_chunk(self, audio_bytes: bytes, mime: str, sample_rate: str) -> None:
        # 1. Republish on ROS so other nodes can pick it up (STT, recording, etc.)
        msg = UInt8MultiArray()
        msg.layout.dim = [MultiArrayDimension(label="bytes", size=len(audio_bytes), stride=1)]
        msg.data = list(audio_bytes)
        self.mic_chunks_pub.publish(msg)
        if self._mic_chunk_count == 0:
            meta = String()
            meta.data = f"mime={mime};rate={sample_rate}"
            self.mic_meta_pub.publish(meta)
            self.get_logger().info(f"Mic stream started: {meta.data}")
        self._mic_chunk_count += 1
        # 2. Stream to the robot's speaker via ffplay.
        self.mic_player.feed(audio_bytes, mime)


def main():
    rclpy.init()
    node = WebServerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.httpd.shutdown()
        try:
            node.destroy_node()
        except KeyboardInterrupt:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
