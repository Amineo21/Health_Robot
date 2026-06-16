from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, login


def test_caregiver_can_navigate_to_free_position(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post(
        "/api/robot/command/navigate",
        headers=auth_headers(token),
        json={"x": 1.5, "y": 2.3, "yaw": 0.0, "label": "destination libre"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "navigate"
    assert payload["requested_by_role"] == "caregiver"
    assert payload["payload"]["max_speed_mps"] <= 0.5


def test_caregiver_cannot_use_teleop(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post(
        "/api/robot/command/teleop",
        headers=auth_headers(token),
        json={"linear_x": 0.1, "angular_z": 0.2, "duration_ms": 300},
    )

    assert response.status_code == 403


def test_admin_can_use_teleop(client: TestClient, admin_token: str) -> None:
    response = client.post(
        "/api/robot/command/teleop",
        headers=auth_headers(admin_token),
        json={"linear_x": 0.1, "angular_z": 0.2, "duration_ms": 300},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "teleop"


def test_caregiver_can_trigger_command_emergency_stop(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post(
        "/api/robot/command/emergency-stop",
        headers=auth_headers(token),
        json={"reason": "manual ui stop"},
    )

    assert response.status_code == 200
    assert response.json()["type"] == "emergency_stop"


def test_admin_only_return_base(client: TestClient, admin_token: str) -> None:
    reset_response = client.post("/api/safety/emergency/reset", headers=auth_headers(admin_token))
    assert reset_response.status_code == 200

    response = client.post("/api/robot/command/return-base", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["type"] == "return_base"


def test_caregiver_cannot_return_base(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    reset_response = client.post("/api/safety/emergency/reset", headers=auth_headers(admin_token))
    assert reset_response.status_code == 200

    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post("/api/robot/command/return-base", headers=auth_headers(token))

    assert response.status_code == 403
