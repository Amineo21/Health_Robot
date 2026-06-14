from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, login


def test_admin_create_user(client: TestClient, admin_token: str) -> None:
    response = client.post(
        "/api/admin/users",
        headers=auth_headers(admin_token),
        json={
            "email": "created-user@health-robot.local",
            "name": "Created User",
            "role": "caregiver",
            "password": "secret",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["email"] == "created-user@health-robot.local"
    assert payload["role"] == "caregiver"
    assert payload["is_active"] is True
    assert "password" not in payload
    assert "password_hash" not in payload


def test_caregiver_cannot_create_user(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.post(
        "/api/admin/users",
        headers=auth_headers(token),
        json={
            "email": "forbidden-user@health-robot.local",
            "name": "Forbidden",
            "role": "caregiver",
            "password": "secret",
        },
    )

    assert response.status_code == 403


def test_admin_list_users(client: TestClient, admin_token: str) -> None:
    response = client.get("/api/admin/users", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert any(user["role"] == "admin" for user in response.json())


def test_admin_update_user(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    user_id, _, _ = create_caregiver()

    response = client.patch(
        f"/api/admin/users/{user_id}",
        headers=auth_headers(admin_token),
        json={"name": "Updated Caregiver", "is_active": True},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Caregiver"


def test_admin_reset_user_password(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    user_id, email, old_password = create_caregiver(password="old-password")

    response = client.post(
        f"/api/admin/users/{user_id}/reset-password",
        headers=auth_headers(admin_token),
        json={"password": "new-password"},
    )

    assert response.status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "password": old_password}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "new-password"}).status_code == 200


def test_admin_delete_deactivates_user(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    user_id, email, password = create_caregiver()

    response = client.delete(f"/api/admin/users/{user_id}", headers=auth_headers(admin_token))

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 403


def test_cannot_deactivate_last_admin(client: TestClient, admin_token: str) -> None:
    response = client.delete("/api/admin/users/admin-1", headers=auth_headers(admin_token))

    assert response.status_code == 403
