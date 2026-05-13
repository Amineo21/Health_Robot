from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.events import NavigationEtaTelemetry, RobotStatus

router = APIRouter(prefix="/api/navigation", tags=["navigation"])


@router.post("/eta", response_model=NavigationEtaTelemetry)
async def ingest_navigation_eta(request: Request, telemetry: NavigationEtaTelemetry) -> NavigationEtaTelemetry:
    return request.app.state.navigation_eta_service.process_nav2_telemetry(telemetry)


@router.get("/eta", response_model=RobotStatus)
async def get_navigation_eta(request: Request) -> RobotStatus:
    return request.app.state.robot_state.get_status()
