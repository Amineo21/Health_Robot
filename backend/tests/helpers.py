from __future__ import annotations

from fastapi.testclient import TestClient

ADMIN_EMAIL = "admin@health-robot.local"
ADMIN_PASSWORD = "admin"
CAREGIVER_PASSWORD = "caregiver"


def login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
