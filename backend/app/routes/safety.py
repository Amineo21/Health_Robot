from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.events import BatteryEvent, BatteryTelemetry, EmergencyEvent, EmergencyStopRequest

router = APIRouter(prefix="/api/safety", tags=["securite"])


@router.post("/battery", response_model=BatteryEvent)
async def ingest_battery_telemetry(request: Request, telemetry: BatteryTelemetry) -> BatteryEvent:
    return request.app.state.safety_service.process_battery_telemetry(telemetry)


@router.post("/emergency", response_model=EmergencyEvent)
async def trigger_emergency_stop(request: Request, payload: EmergencyStopRequest) -> EmergencyEvent:
    return request.app.state.safety_service.trigger_emergency_stop(payload)


@router.post("/emergency/reset")
async def clear_emergency(request: Request, actor: str = "admin") -> dict[str, str]:
    return request.app.state.safety_service.clear_emergency(actor)
