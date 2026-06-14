from __future__ import annotations

from fastapi import APIRouter

from app.application.dto.robot_dto import NavigationEtaTelemetry, RobotStatus
from app.presentation.api.dependencies import CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/navigation", tags=["navigation"])


@router.post("/eta", response_model=NavigationEtaTelemetry)
def ingest_navigation_eta(
    use_cases: UseCasesDep,
    telemetry: NavigationEtaTelemetry,
) -> NavigationEtaTelemetry:
    # Public in development: robot-only telemetry endpoint.
    # Future protection: require_robot_api_key.
    result = use_cases.process_navigation_eta.execute(telemetry.to_domain())
    return NavigationEtaTelemetry.from_domain(result)


@router.get("/eta", response_model=RobotStatus)
def get_navigation_eta(use_cases: UseCasesDep, _current_user: CaregiverOrAdminDep) -> RobotStatus:
    status = use_cases.get_robot_status.execute()
    return RobotStatus.from_domain(status)
