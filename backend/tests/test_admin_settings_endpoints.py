from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, login


def test_caregiver_cannot_read_settings(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.get("/api/admin/settings", headers=auth_headers(token))

    assert response.status_code == 403


def test_admin_get_settings(client: TestClient, admin_token: str) -> None:
    response = client.get("/api/admin/settings", headers=auth_headers(admin_token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["max_speed_mps"] == 0.5
    assert payload["meal_speed_mps"] == 0.3
    assert payload["low_battery_threshold"] == 20


def test_admin_update_settings(client: TestClient, admin_token: str) -> None:
    response = client.patch(
        "/api/admin/settings",
        headers=auth_headers(admin_token),
        json={"max_speed_mps": 0.4, "low_battery_threshold": 25, "teleop_enabled": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["max_speed_mps"] == 0.4
    assert payload["low_battery_threshold"] == 25
    assert payload["teleop_enabled"] is True


def test_admin_update_settings_rejects_unsafe_speed(client: TestClient, admin_token: str) -> None:
    response = client.patch(
        "/api/admin/settings",
        headers=auth_headers(admin_token),
        json={"max_speed_mps": 0.6},
    )

    assert response.status_code == 400
