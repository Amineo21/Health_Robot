from __future__ import annotations

from fastapi import APIRouter

from app.application.dto.robot_dto import NavigationEtaTelemetry, RobotStatus
from app.presentation.api.dependencies import CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/navigation", tags=["navigation"])


@router.post(
    "/eta",
    response_model=NavigationEtaTelemetry,
    summary="Ingest robot navigation ETA telemetry",
    description=(
        "Public in development for the MVP. Robot-only endpoint used by navigation/NAV2 to publish "
        "path distance, remaining distance, speed, and ETA. Future protection: X-Robot-Api-Key."
    ),
    response_description="Normalized navigation ETA telemetry.",
)
def ingest_navigation_eta(
    use_cases: UseCasesDep,
    telemetry: NavigationEtaTelemetry,
) -> NavigationEtaTelemetry:
    # Public in development: robot-only telemetry endpoint.
    # Future protection: require_robot_api_key.
    result = use_cases.process_navigation_eta.execute(telemetry.to_domain())
    return NavigationEtaTelemetry.from_domain(result)


@router.get(
    "/eta",
    response_model=RobotStatus,
    summary="Get navigation ETA status",
    description="Returns the robot status including latest ETA fields. Requires an admin or caregiver bearer token.",
    response_description="Robot status snapshot with navigation ETA fields.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Authenticated user does not have access to navigation ETA status."},
    },
)
def get_navigation_eta(use_cases: UseCasesDep, _current_user: CaregiverOrAdminDep) -> RobotStatus:
    status = use_cases.get_robot_status.execute()
    return RobotStatus.from_domain(status)
