from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, auth_headers, login


def test_login_admin_valid(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == 28800
    assert payload["user"]["role"] == "admin"
    assert "password" not in payload["user"]
    assert "password_hash" not in payload["user"]


def test_login_preflight_allows_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_login_caregiver_valid(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()

    response = client.post("/api/auth/login", json={"email": email, "password": password})

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "caregiver"


def test_login_bad_password(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_login_unknown_email(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "unknown@health-robot.local", "password": "admin"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_get_me_without_token(client: TestClient) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_get_me_with_admin_token(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.get("/api/auth/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_get_me_with_caregiver_token(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    token = login(client, email, password)

    response = client.get("/api/auth/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["role"] == "caregiver"
