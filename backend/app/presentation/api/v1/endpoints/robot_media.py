from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query, Response, status

from app.application.dto.robot_media_dto import (
    RobotArmCommandRequest,
    RobotArmState,
    RobotSoundOperationResponse,
    RobotSoundsResponse,
)
from app.infrastructure.robot_maps.dashboard_client import RobotDashboardError
from app.presentation.api.dependencies import (
    AdminUserDep,
    CaregiverOrAdminDep,
    RobotDashboardClientDep,
    RobotRosbridgeBridgeDep,
)

router = APIRouter(prefix="/robot", tags=["robot media"])

SAFE_FILE_NAME_RE = re.compile(r"[^a-zA-Z0-9_.-]+")


def _safe_file_name(name: str) -> str:
    safe = SAFE_FILE_NAME_RE.sub("_", name.strip()).strip("._-")
    if not safe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file name")
    return safe[:120]


def _dashboard_error(exc: RobotDashboardError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/camera/snapshot")
def get_camera_snapshot(_current_user: CaregiverOrAdminDep, dashboard_client: RobotDashboardClientDep) -> Response:
    try:
        content, media_type = dashboard_client.get_camera_snapshot()
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return Response(content=content, media_type=media_type, headers={"Cache-Control": "no-cache"})


@router.get("/sounds", response_model=RobotSoundsResponse)
def list_robot_sounds(_current_user: CaregiverOrAdminDep, dashboard_client: RobotDashboardClientDep) -> RobotSoundsResponse:
    try:
        result = dashboard_client.list_sounds()
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return RobotSoundsResponse.model_validate(result)


@router.post("/sounds/upload", response_model=RobotSoundOperationResponse)
def upload_robot_sound(
    _current_user: AdminUserDep,
    dashboard_client: RobotDashboardClientDep,
    name: Annotated[str, Query(min_length=1, max_length=120)],
    body: Annotated[bytes, Body(media_type="application/octet-stream")],
) -> RobotSoundOperationResponse:
    try:
        result = dashboard_client.upload_sound(_safe_file_name(name), body)
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return RobotSoundOperationResponse.model_validate(result)


@router.post("/sounds/{name}/play", response_model=RobotSoundOperationResponse)
def play_robot_sound(name: str, _current_user: CaregiverOrAdminDep, dashboard_client: RobotDashboardClientDep) -> RobotSoundOperationResponse:
    try:
        result = dashboard_client.play_sound(_safe_file_name(name))
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return RobotSoundOperationResponse.model_validate(result)


@router.delete("/sounds/{name}", response_model=RobotSoundOperationResponse)
def delete_robot_sound(name: str, _current_user: AdminUserDep, dashboard_client: RobotDashboardClientDep) -> RobotSoundOperationResponse:
    try:
        result = dashboard_client.delete_sound(_safe_file_name(name))
    except RobotDashboardError as exc:
        raise _dashboard_error(exc) from None
    return RobotSoundOperationResponse.model_validate(result)


@router.get("/arm", response_model=RobotArmState)
def get_robot_arm_state(_current_user: CaregiverOrAdminDep, bridge: RobotRosbridgeBridgeDep) -> RobotArmState:
    return RobotArmState.model_validate(bridge.get_latest_arm_state())


@router.post("/arm", response_model=RobotArmState)
def command_robot_arm(_current_user: AdminUserDep, bridge: RobotRosbridgeBridgeDep, payload: RobotArmCommandRequest) -> RobotArmState:
    bridge.publish_arm_joints(payload.joints(), payload.time_ms)
    return RobotArmState(joints=payload.joints())
