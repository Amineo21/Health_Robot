from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from app.domain.entities.robot import RobotPose, RobotRuntimeTelemetry
from tests.helpers import auth_headers, login


def test_mission_api_runs_create_arrive_confirm_complete_flow(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    reset_response = client.post("/api/safety/emergency/reset", headers=auth_headers(admin_token))
    assert reset_response.status_code == 200

    stock = client.post(
        "/api/annotated-points",
        headers=auth_headers(admin_token),
        json={"name": "Stock principal", "type": "STOCK", "x": 1.0, "y": 1.0, "yaw": 0.0},
    )
    assert stock.status_code == 201
    stock_id = stock.json()["id"]

    supplies = client.put(
        f"/api/annotated-points/{stock_id}/supplies",
        headers=auth_headers(admin_token),
        json={"supplies": [{"supply_type": "gants", "priority_order": 1}]},
    )
    assert supplies.status_code == 200

    delivery_room = client.post(
        "/api/annotated-points",
        headers=auth_headers(admin_token),
        json={"name": "Chambre 203", "type": "DELIVERY_ROOM", "x": 3.0, "y": 3.0, "yaw": 0.0},
    )
    assert delivery_room.status_code == 201

    _, email, password = create_caregiver()
    caregiver_token = login(client, email, password)
    mission_response = client.post(
        "/api/missions",
        headers=auth_headers(caregiver_token),
        json={"supply_type": "gants", "delivery_room_id": delivery_room.json()["id"]},
    )
    assert mission_response.status_code == 201
    mission = mission_response.json()
    mission_id = mission["id"]
    assert mission["status"] == "NAVIGATING_TO_STOCK"
    assert mission["stock_point_id"] == stock_id

    client.app.state.use_cases.process_robot_status_telemetry.execute(
        RobotRuntimeTelemetry(pose=RobotPose(x=1.1, y=1.0, yaw=0.0))
    )
    missions_after_stock_arrival = client.get("/api/missions", headers=auth_headers(caregiver_token)).json()
    assert missions_after_stock_arrival[0]["status"] == "WAITING_FOR_RECOVERY_CONFIRMATION"

    recovery = client.post(f"/api/missions/{mission_id}/confirm-recovery", headers=auth_headers(caregiver_token))
    assert recovery.status_code == 200
    assert recovery.json()["status"] == "NAVIGATING_TO_DELIVERY"

    client.app.state.use_cases.process_robot_status_telemetry.execute(
        RobotRuntimeTelemetry(pose=RobotPose(x=3.0, y=3.0, yaw=0.0))
    )
    missions_after_delivery_arrival = client.get("/api/missions", headers=auth_headers(caregiver_token)).json()
    assert missions_after_delivery_arrival[0]["status"] == "WAITING_FOR_DELIVERY_CONFIRMATION"

    delivery = client.post(f"/api/missions/{mission_id}/confirm-delivery", headers=auth_headers(caregiver_token))
    assert delivery.status_code == 200
    assert delivery.json()["status"] == "COMPLETED"


def test_robot_recovery_done_advances_mission_autonomously(
    client: TestClient,
    admin_token: str,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    client.post("/api/safety/emergency/reset", headers=auth_headers(admin_token))

    stock = client.post(
        "/api/annotated-points",
        headers=auth_headers(admin_token),
        json={"name": "Stock auto", "type": "STOCK", "x": 5.0, "y": 5.0, "yaw": 0.0},
    )
    stock_id = stock.json()["id"]
    client.put(
        f"/api/annotated-points/{stock_id}/supplies",
        headers=auth_headers(admin_token),
        json={"supplies": [{"supply_type": "linge", "priority_order": 1}]},
    )
    delivery_room = client.post(
        "/api/annotated-points",
        headers=auth_headers(admin_token),
        json={"name": "Chambre 410", "type": "DELIVERY_ROOM", "x": 7.0, "y": 7.0, "yaw": 0.0},
    )

    _, email, password = create_caregiver()
    caregiver_token = login(client, email, password)
    mission_id = client.post(
        "/api/missions",
        headers=auth_headers(caregiver_token),
        json={"supply_type": "linge", "delivery_room_id": delivery_room.json()["id"]},
    ).json()["id"]

    # Le robot arrive au stock -> la mission attend la recuperation.
    use_cases = client.app.state.use_cases
    use_cases.process_robot_status_telemetry.execute(
        RobotRuntimeTelemetry(pose=RobotPose(x=5.0, y=5.0, yaw=0.0))
    )
    waiting = client.get("/api/missions", headers=auth_headers(caregiver_token)).json()[0]
    assert waiting["status"] == "WAITING_FOR_RECOVERY_CONFIRMATION"

    # Le robot signale lui-meme la recuperation (scan + bras) -> pas de bouton humain.
    confirmed = use_cases.mission_orchestrator.confirm_recovery_autonomous(mission_id)
    assert confirmed is not None
    assert confirmed.status.value == "NAVIGATING_TO_DELIVERY"

    # Un recovery_done en double / hors etat est ignore sans erreur.
    assert use_cases.mission_orchestrator.confirm_recovery_autonomous(mission_id) is None


def test_annotated_point_writes_are_admin_only(
    client: TestClient,
    create_caregiver: Callable[[str], tuple[str, str, str]],
) -> None:
    _, email, password = create_caregiver()
    caregiver_token = login(client, email, password)

    response = client.post(
        "/api/annotated-points",
        headers=auth_headers(caregiver_token),
        json={"name": "Stock interdit", "type": "STOCK", "x": 0, "y": 0, "yaw": 0},
    )

    assert response.status_code == 403


def test_robot_screen_status_requires_dedicated_token(client: TestClient) -> None:
    unauthorized = client.get("/api/robot-screen/status")
    assert unauthorized.status_code == 403

    authorized = client.get("/api/robot-screen/status", headers={"X-Robot-Screen-Token": "robot-screen-test-token"})
    assert authorized.status_code == 200
    assert authorized.json()["screen_title_fr"]
