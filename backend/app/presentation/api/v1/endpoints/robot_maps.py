from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.application.dto.map_dto import (
    RobotMapOperationResponse,
    RobotMapSnapshot,
    SaveRobotMapRequest,
    SaveRobotMapResponse,
    SavedRobotMapsResponse,
)
from app.core.config import settings
from app.infrastructure.robot_maps.dashboard_client import RobotDashboardError
from app.presentation.api.dependencies import (
    AdminUserDep,
    CaregiverOrAdminDep,
    RobotDashboardClientDep,
    RobotRosbridgeBridgeDep,
)

router = APIRouter(prefix="/robot/maps", tags=["robot maps"])

SAFE_MAP_NAME_RE = re.compile(r"[^a-zA-Z0-9_.-]+")


def _safe_map_name(name: str | None) -> str:
    if not name:
        return "map_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe = SAFE_MAP_NAME_RE.sub("_", name.strip()).strip("._-")
    if not safe:
        return "map_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return safe[:80]


def _dashboard_error(exc: RobotDashboardError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


def _ensure_ok(result: dict[str, Any]) -> RobotMapOperationResponse:
    ok = result.get("ok", True)
    if ok is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.get("error", "Robot map operation failed"))
    return RobotMapOperationResponse(ok=bool(ok), result=result)


@router.get("", response_model=SavedRobotMapsResponse)
def list_robot_maps(_current_user: CaregiverOrAdminDep, dashboard_client: RobotDashboardClientDep) -> SavedRobotMapsResponse:
    try:
        result = dashboard_client.list_maps()
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return SavedRobotMapsResponse.model_validate(result)


@router.get("/current", response_model=RobotMapSnapshot)
def get_current_robot_map(_current_user: CaregiverOrAdminDep, bridge: RobotRosbridgeBridgeDep) -> RobotMapSnapshot:
    snapshot = bridge.get_latest_map_snapshot()
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No robot map received yet")
    return RobotMapSnapshot.model_validate(snapshot)


@router.get("/mode", response_model=RobotMapOperationResponse)
def get_robot_map_mode(_current_user: CaregiverOrAdminDep, dashboard_client: RobotDashboardClientDep) -> RobotMapOperationResponse:
    try:
        result = dashboard_client.get_mode_status()
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return RobotMapOperationResponse(ok=bool(result.get("ok", True)), result=result)


@router.post("/mapping/start", response_model=RobotMapOperationResponse)
def start_mapping_mode(_current_user: AdminUserDep, dashboard_client: RobotDashboardClientDep) -> RobotMapOperationResponse:
    try:
        result = dashboard_client.switch_mode("mapping")
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return _ensure_ok(result)


@router.post("/save", response_model=SaveRobotMapResponse)
def save_current_robot_map(
    _current_user: AdminUserDep,
    bridge: RobotRosbridgeBridgeDep,
    payload: SaveRobotMapRequest | None = None,
) -> SaveRobotMapResponse:
    name = _safe_map_name(payload.name if payload else None)
    base_path = f"{settings.robot_maps_directory.rstrip('/')}/{name}"
    try:
        result = bridge.save_map(base_path)
    except TimeoutError as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(exc)) from None
    return SaveRobotMapResponse(ok=True, name=name, base_path=base_path, **result)


@router.post("/{name}/load", response_model=RobotMapOperationResponse)
def load_robot_map(name: str, _current_user: AdminUserDep, dashboard_client: RobotDashboardClientDep) -> RobotMapOperationResponse:
    safe = _safe_map_name(name)
    try:
        result = dashboard_client.load_map(safe)
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return _ensure_ok(result)


@router.delete("/{name}", response_model=RobotMapOperationResponse)
def delete_robot_map(name: str, _current_user: AdminUserDep, dashboard_client: RobotDashboardClientDep) -> RobotMapOperationResponse:
    safe = _safe_map_name(name)
    try:
        result = dashboard_client.delete_map(safe)
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return _ensure_ok(result)
