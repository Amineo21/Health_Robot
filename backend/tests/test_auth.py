from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

ADMIN_EMAIL = "admin@health-robot.local"
ADMIN_PASSWORD = "admin"
CAREGIVER_EMAIL = "caregiver@health-robot.local"
CAREGIVER_PASSWORD = "caregiver"


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(create_app()) as test_client:
        yield test_client


def login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_admin_valid(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == 28800
    assert payload["user"]["role"] == "admin"
    assert "password" not in payload["user"]
    assert "password_hash" not in payload["user"]


def test_login_caregiver_valid(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": CAREGIVER_EMAIL, "password": CAREGIVER_PASSWORD})

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


def test_get_me_with_caregiver_token(client: TestClient) -> None:
    token = login(client, CAREGIVER_EMAIL, CAREGIVER_PASSWORD)

    response = client.get("/api/auth/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["role"] == "caregiver"


def test_robot_status_without_token(client: TestClient) -> None:
    response = client.get("/api/robot/status")

    assert response.status_code == 401


def test_robot_status_caregiver(client: TestClient) -> None:
    token = login(client, CAREGIVER_EMAIL, CAREGIVER_PASSWORD)

    response = client.get("/api/robot/status", headers=auth_headers(token))

    assert response.status_code == 200


def test_robot_status_admin(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.get("/api/robot/status", headers=auth_headers(token))

    assert response.status_code == 200


def test_emergency_caregiver(client: TestClient) -> None:
    token = login(client, CAREGIVER_EMAIL, CAREGIVER_PASSWORD)

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


def test_emergency_reset_caregiver_forbidden(client: TestClient) -> None:
    token = login(client, CAREGIVER_EMAIL, CAREGIVER_PASSWORD)

    response = client.post("/api/safety/emergency/reset", headers=auth_headers(token))

    assert response.status_code == 403



def test_emergency_reset_admin(client: TestClient) -> None:
    token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = client.post("/api/safety/emergency/reset", headers=auth_headers(token))

    assert response.status_code == 200


def test_navigation_eta_caregiver(client: TestClient) -> None:
    token = login(client, CAREGIVER_EMAIL, CAREGIVER_PASSWORD)

    response = client.get("/api/navigation/eta", headers=auth_headers(token))

    assert response.status_code == 200


def test_battery_ingestion_stays_public_for_mvp(client: TestClient) -> None:
    response = client.post("/api/safety/battery", json={"level": 80})

    assert response.status_code == 200


def test_navigation_eta_ingestion_stays_public_for_mvp(client: TestClient) -> None:
    response = client.post("/api/navigation/eta", json={"path_distance_m": 12, "current_speed_mps": 0.5})

    assert response.status_code == 200
