from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, login


class FakeBridge:
    def __init__(self) -> None:
        self.last_command: tuple[list[int], int] | None = None

    def get_latest_arm_state(self) -> dict[str, list[int]]:
        return {"joints": [90, 80, 70, 60, 50, 40]}

    def publish_arm_joints(self, joints: list[int], time_ms: int) -> None:
        self.last_command = (joints, time_ms)


class FakeDashboardClient:
    def get_camera_snapshot(self) -> tuple[bytes, str]:
        return b"jpeg", "image/jpeg"

    def list_sounds(self) -> dict[str, Any]:
        return {"sounds": [{"name": "hello.mp3", "size": 4, "modified": 1}]}

    def upload_sound(self, name: str, data: bytes) -> dict[str, Any]:
        return {"ok": True, "name": name, "size": len(data)}

    def play_sound(self, name: str) -> dict[str, Any]:
        return {"ok": True, "name": name}

    def delete_sound(self, name: str) -> dict[str, Any]:
        return {"ok": True, "name": name}


def test_camera_snapshot_is_proxied(client: TestClient, admin_token: str) -> None:
    client.app.state.robot_dashboard_client = FakeDashboardClient()

    response = client.get("/api/robot/camera/snapshot", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.content == b"jpeg"
    assert response.headers["content-type"] == "image/jpeg"


def test_sounds_are_listed(client: TestClient, admin_token: str) -> None:
    client.app.state.robot_dashboard_client = FakeDashboardClient()

    response = client.get("/api/robot/sounds", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["sounds"][0]["name"] == "hello.mp3"


def test_caregiver_can_play_but_not_upload_sound(client: TestClient, create_caregiver) -> None:
    client.app.state.robot_dashboard_client = FakeDashboardClient()
    _, email, password = create_caregiver()
    token = login(client, email, password)

    play_response = client.post("/api/robot/sounds/hello.mp3/play", headers=auth_headers(token))
    upload_response = client.post("/api/robot/sounds/upload?name=hello.mp3", headers=auth_headers(token), content=b"data")

    assert play_response.status_code == 200
    assert upload_response.status_code == 403


def test_admin_can_command_arm(client: TestClient, admin_token: str) -> None:
    bridge = FakeBridge()
    client.app.state.robot_rosbridge_bridge = bridge

    response = client.post(
        "/api/robot/arm",
        headers=auth_headers(admin_token),
        json={"joint1": 1, "joint2": 2, "joint3": 3, "joint4": 4, "joint5": 5, "joint6": 6, "time_ms": 700},
    )

    assert response.status_code == 200
    assert response.json()["joints"] == [1, 2, 3, 4, 5, 6]
    assert bridge.last_command == ([1, 2, 3, 4, 5, 6], 700)
