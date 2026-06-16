from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from app.domain.entities.robot import RobotMapMetadata, RobotPose, RobotRuntimeTelemetry
from tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, auth_headers, login


def test_robot_status_without_token(client: TestClient) -> None:
    response = client.get("/api/robot/status")

    assert response.status_code == 401


def test_robot_status_caregiver(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.get("/api/robot/status", headers=auth_headers(token))

    assert response.status_code == 200


def test_robot_status_admin(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.get("/api/robot/status", headers=auth_headers(token))

    assert response.status_code == 200


def test_robot_status_exposes_runtime_map_and_pose(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    client.app.state.robot_state_repository.update_runtime(
        RobotRuntimeTelemetry(
            pose=RobotPose(x=0.75, y=1.25),
            map=RobotMapMetadata(width=131, height=144, resolution=0.05, origin_x=-3.15, origin_y=-2.99),
            min_obstacle_distance_m=0.4,
        )
    )

    response = client.get("/api/robot/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["pose"] == {"x": 0.75, "y": 1.25, "yaw": None}
    assert response.json()["map"] == {
        "width": 131,
        "height": 144,
        "resolution": 0.05,
        "origin_x": -3.15,
        "origin_y": -2.99,
    }
    assert response.json()["min_obstacle_distance_m"] == 0.4


def test_emergency_caregiver(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post(
        "/api/safety/emergency",
        headers=auth_headers(token),
        json={"source": "ui", "reason": "caregiver emergency stop"},
    )

    assert response.status_code == 200


def test_emergency_admin(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.post(
        "/api/safety/emergency",
        headers=auth_headers(token),
        json={"source": "admin", "reason": "admin emergency stop"},
    )

    assert response.status_code == 200


def test_emergency_reset_caregiver_forbidden(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post("/api/safety/emergency/reset", headers=auth_headers(token))

    assert response.status_code == 403


def test_emergency_reset_admin(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.post("/api/safety/emergency/reset", headers=auth_headers(token))

    assert response.status_code == 200


def test_navigation_eta_caregiver(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.get("/api/navigation/eta", headers=auth_headers(token))

    assert response.status_code == 200
