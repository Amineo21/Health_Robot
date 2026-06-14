from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.application.dto.robot_dto import BatteryEvent, BatteryTelemetry, EmergencyEvent, EmergencyStopRequest
from app.presentation.api.dependencies import AdminUserDep, CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/safety", tags=["securite"])


@router.post(
    "/battery",
    response_model=BatteryEvent,
    summary="Ingest robot battery telemetry",
    description=(
        "Public in development for the MVP. Robot-only endpoint used to ingest battery telemetry, "
        "compute safety status, and trigger autonomous return-to-base when needed. "
        "Future protection: X-Robot-Api-Key."
    ),
    response_description="Battery safety event generated from telemetry.",
)
def ingest_battery_telemetry(
    use_cases: UseCasesDep,
    telemetry: BatteryTelemetry,
) -> BatteryEvent:
    # Public in development: robot-only telemetry endpoint.
    # Future protection: require_robot_api_key.
    event = use_cases.process_battery_telemetry.execute(telemetry.to_domain())
    return BatteryEvent.from_domain(event)


@router.post(
    "/emergency",
    response_model=EmergencyEvent,
    summary="Trigger emergency stop",
    description="Triggers an emergency stop. Requires an admin or caregiver bearer token.",
    response_description="Emergency stop event sent to robot safety channels.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Authenticated user cannot trigger emergency stop."},
    },
)
def trigger_emergency_stop(
    use_cases: UseCasesDep,
    _current_user: CaregiverOrAdminDep,
    payload: EmergencyStopRequest,
) -> EmergencyEvent:
    event = use_cases.trigger_emergency_stop.execute(payload.to_domain())
    return EmergencyEvent.from_domain(event)


@router.post(
    "/emergency/reset",
    summary="Reset emergency stop",
    description="Clears the emergency latch and starts the admin restart procedure. Requires an admin bearer token.",
    response_description="Emergency reset acknowledgement.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can reset an emergency stop."},
    },
)
def clear_emergency(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    actor: Annotated[str, Query()] = "admin",
) -> dict[str, str]:
    return use_cases.clear_emergency.execute(actor)
