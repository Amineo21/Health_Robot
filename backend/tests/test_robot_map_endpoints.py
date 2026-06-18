from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.helpers import auth_headers


class FakeBridge:
    def __init__(self) -> None:
        self.saved_base_path: str | None = None

    def get_latest_map_snapshot(self) -> dict[str, Any]:
        return {
            "width": 2,
            "height": 2,
            "resolution": 0.05,
            "origin_x": -1.0,
            "origin_y": -2.0,
            "data": [0, 100, -1, 0],
            "updated_at": 1.0,
        }

    def save_map(self, base_path: str) -> dict[str, Any]:
        self.saved_base_path = base_path
        return {
            "occupancy": {"result": True, "values": {}},
            "pose_graph": {"result": True, "values": {}},
        }


class FakeDashboardClient:
    def __init__(self) -> None:
        self.loaded_map: str | None = None

    def list_maps(self) -> dict[str, Any]:
        return {"maps": [{"name": "demo", "parts": {"yaml": "demo.yaml", "pgm": "demo.pgm"}, "mtime": 1, "size": 10, "loadable": True}]}

    def get_mode_status(self) -> dict[str, Any]:
        return {"ok": True, "active": "mapping"}

    def switch_mode(self, mode: str, map_path: str | None = None) -> dict[str, Any]:
        return {"ok": True, "active": mode, "map": map_path}

    def load_map(self, name: str) -> dict[str, Any]:
        self.loaded_map = name
        return {"ok": True, "map": name}

    def delete_map(self, name: str) -> dict[str, Any]:
        return {"ok": True, "removed": [f"{name}.yaml"]}


def test_get_current_robot_map(client: TestClient, admin_token: str) -> None:
    client.app.state.robot_rosbridge_bridge = FakeBridge()

    response = client.get("/api/robot/maps/current", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["data"] == [0, 100, -1, 0]


def test_list_saved_robot_maps(client: TestClient, admin_token: str) -> None:
    client.app.state.robot_dashboard_client = FakeDashboardClient()

    response = client.get("/api/robot/maps", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["maps"][0]["name"] == "demo"


def test_save_robot_map_uses_root_maps_directory(client: TestClient, admin_token: str) -> None:
    bridge = FakeBridge()
    client.app.state.robot_rosbridge_bridge = bridge

    response = client.post("/api/robot/maps/save", headers=auth_headers(admin_token), json={"name": "my map"})

    assert response.status_code == 200
    assert response.json()["base_path"] == "/root/maps/my_map"
    assert bridge.saved_base_path == "/root/maps/my_map"


def test_caregiver_cannot_start_mapping(
    client: TestClient,
    create_caregiver,
) -> None:
    _, email, password = create_caregiver()
    from tests.helpers import login

    token = login(client, email, password)

    response = client.post("/api/robot/maps/mapping/start", headers=auth_headers(token))

    assert response.status_code == 403


def test_load_saved_map_switches_to_navigation(client: TestClient, admin_token: str) -> None:
    dashboard = FakeDashboardClient()
    client.app.state.robot_dashboard_client = dashboard

    response = client.post("/api/robot/maps/demo/load", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["result"]["map"] == "demo"
    assert dashboard.loaded_map == "demo"
