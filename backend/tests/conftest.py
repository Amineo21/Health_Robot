from __future__ import annotations

import os
from collections.abc import Callable, Generator
from itertools import count

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("MQTT_ENABLED", "false")

from app.main import create_app
from tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, CAREGIVER_PASSWORD, auth_headers, login

_user_counter = count(1)


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def admin_token(client: TestClient) -> str:
    return login(client, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture
def create_caregiver(client: TestClient, admin_token: str) -> Callable[[str], tuple[str, str, str]]:
    def create(password: str = CAREGIVER_PASSWORD) -> tuple[str, str, str]:
        user_index = next(_user_counter)
        email = f"caregiver-{user_index}@health-robot.local"
        response = client.post(
            "/api/admin/users",
            headers=auth_headers(admin_token),
            json={
                "email": email,
                "name": f"Caregiver {user_index}",
                "role": "caregiver",
                "password": password,
            },
        )
        assert response.status_code == 201
        return response.json()["id"], email, password

    return create
