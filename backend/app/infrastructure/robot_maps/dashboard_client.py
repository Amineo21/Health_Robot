from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class RobotDashboardError(RuntimeError):
    pass


class RobotDashboardClient:
    def __init__(self, base_url: str, timeout_seconds: float = 8.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    def list_maps(self) -> dict[str, Any]:
        return self._request_json("GET", "/maps")

    def load_map(self, name: str) -> dict[str, Any]:
        return self._request_json("POST", f"/maps/load/{urllib.parse.quote(name)}")

    def delete_map(self, name: str) -> dict[str, Any]:
        return self._request_json("POST", f"/maps/delete/{urllib.parse.quote(name)}")

    def get_mode_status(self) -> dict[str, Any]:
        return self._request_json("GET", "/mode/status")

    def switch_mode(self, mode: str, map_path: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"mode": mode}
        if map_path:
            payload["map"] = map_path
        return self._request_json("POST", "/mode/switch", payload)

    def _request_json(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(
            f"{self._base_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=self._timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise RobotDashboardError(detail or exc.reason) from exc
        except OSError as exc:
            raise RobotDashboardError(str(exc)) from exc

        if not body:
            return {}

        try:
            decoded = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RobotDashboardError("Robot dashboard returned non-JSON response") from exc
        if not isinstance(decoded, dict):
            raise RobotDashboardError("Robot dashboard returned unexpected response")
        return decoded
