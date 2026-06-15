from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.application.dto.robot_dto import NavigationEtaTelemetry, RobotStatus
from app.domain.entities.mqtt_topics import ROBOT_NAV_CANCEL_TOPIC, ROBOT_NAV_GOAL_TOPIC
from app.presentation.api.dependencies import UseCasesDep

router = APIRouter(prefix="/navigation", tags=["navigation"])


class NavigationGoal(BaseModel):
    x: float
    y: float
    mission_id: Optional[str] = None
    destination_name: Optional[str] = None


class NavigationGoalEvent(BaseModel):
    mission_id: Optional[str] = None
    destination_name: Optional[str] = None
    x: float
    y: float
    status: Literal["ACCEPTED"] = "ACCEPTED"


@router.post("/eta", response_model=NavigationEtaTelemetry)
def ingest_navigation_eta(
    use_cases: UseCasesDep,
    telemetry: NavigationEtaTelemetry,
) -> NavigationEtaTelemetry:
    result = use_cases.process_navigation_eta.execute(telemetry.to_domain())
    return NavigationEtaTelemetry.from_domain(result)


@router.get("/eta", response_model=RobotStatus)
def get_navigation_eta(use_cases: UseCasesDep) -> RobotStatus:
    status = use_cases.get_robot_status.execute()
    return RobotStatus.from_domain(status)


@router.post("/goal", response_model=NavigationGoalEvent)
def send_navigation_goal(request: Request, goal: NavigationGoal) -> NavigationGoalEvent:
    request.app.state.mqtt_service.publish_json(
        ROBOT_NAV_GOAL_TOPIC,
        {
            "x": goal.x,
            "y": goal.y,
            "mission_id": goal.mission_id,
            "destination_name": goal.destination_name,
        },
    )
    return NavigationGoalEvent(
        mission_id=goal.mission_id,
        destination_name=goal.destination_name,
        x=goal.x,
        y=goal.y,
    )


@router.post("/cancel")
def cancel_navigation(request: Request) -> dict[str, str]:
    request.app.state.mqtt_service.publish_json(ROBOT_NAV_CANCEL_TOPIC, {"cancel": True})
    return {"status": "cancelled"}
