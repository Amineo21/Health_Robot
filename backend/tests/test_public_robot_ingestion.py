from __future__ import annotations

from fastapi.testclient import TestClient


def test_battery_ingestion_stays_public_for_mvp(client: TestClient) -> None:
    response = client.post("/api/safety/battery", json={"level": 80})

    assert response.status_code == 200


def test_navigation_eta_ingestion_stays_public_for_mvp(client: TestClient) -> None:
    response = client.post("/api/navigation/eta", json={"path_distance_m": 12, "current_speed_mps": 0.5})

    assert response.status_code == 200
