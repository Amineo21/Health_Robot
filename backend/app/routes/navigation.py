from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.events import NavigationEtaTelemetry, NavigationGoal, NavigationGoalEvent, RobotStatus
from app.mqtt.topics import ROBOT_NAV_CANCEL_TOPIC, ROBOT_NAV_GOAL_TOPIC

router = APIRouter(prefix="/api/navigation", tags=["navigation"])


@router.post("/eta", response_model=NavigationEtaTelemetry)
async def ingest_navigation_eta(request: Request, telemetry: NavigationEtaTelemetry) -> NavigationEtaTelemetry:
    return request.app.state.navigation_eta_service.process_nav2_telemetry(telemetry)


@router.get("/eta", response_model=RobotStatus)
async def get_navigation_eta(request: Request) -> RobotStatus:
    return request.app.state.robot_state.get_status()


@router.post("/goal", response_model=NavigationGoalEvent)
async def send_navigation_goal(request: Request, goal: NavigationGoal) -> NavigationGoalEvent:
    event = NavigationGoalEvent(
        mission_id=goal.mission_id,
        destination_name=goal.destination_name,
        x=goal.x,
        y=goal.y,
    )
    request.app.state.mqtt_service.publish_json(
        ROBOT_NAV_GOAL_TOPIC,
        {"x": goal.x, "y": goal.y, "mission_id": goal.mission_id, "destination_name": goal.destination_name},
    )
    return event


@router.post("/cancel")
async def cancel_navigation(request: Request) -> dict[str, str]:
    request.app.state.mqtt_service.publish_json(ROBOT_NAV_CANCEL_TOPIC, {"cancel": True})
    return {"status": "cancelled"}
