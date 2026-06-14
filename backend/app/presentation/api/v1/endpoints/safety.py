from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.application.dto.robot_dto import BatteryEvent, BatteryTelemetry, EmergencyEvent, EmergencyStopRequest
from app.presentation.api.dependencies import UseCasesDep

router = APIRouter(prefix="/safety", tags=["securite"])


@router.post("/battery", response_model=BatteryEvent)
def ingest_battery_telemetry(
    use_cases: UseCasesDep,
    telemetry: BatteryTelemetry,
) -> BatteryEvent:
    event = use_cases.process_battery_telemetry.execute(telemetry.to_domain())
    return BatteryEvent.from_domain(event)


@router.post("/emergency", response_model=EmergencyEvent)
def trigger_emergency_stop(
    use_cases: UseCasesDep,
    payload: EmergencyStopRequest,
) -> EmergencyEvent:
    event = use_cases.trigger_emergency_stop.execute(payload.to_domain())
    return EmergencyEvent.from_domain(event)


@router.post("/emergency/reset")
def clear_emergency(
    use_cases: UseCasesDep,
    actor: Annotated[str, Query()] = "admin",
) -> dict[str, str]:
    return use_cases.clear_emergency.execute(actor)
