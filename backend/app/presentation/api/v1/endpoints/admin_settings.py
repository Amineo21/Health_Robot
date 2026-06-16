from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.application.dto.settings_dto import RobotSettingsResponse, UpdateRobotSettingsRequest
from app.application.use_cases.settings_errors import SettingsValidationError
from app.presentation.api.dependencies import AdminUserDep, UseCasesDep

router = APIRouter(prefix="/admin/settings", tags=["admin settings"])


@router.get(
    "",
    response_model=RobotSettingsResponse,
    summary="Get robot settings",
    description="Returns robot behavior and safety settings. Requires an admin bearer token.",
    responses={
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can read settings."},
    },
)
def get_robot_settings(use_cases: UseCasesDep, _current_user: AdminUserDep) -> RobotSettingsResponse:
    return RobotSettingsResponse.from_domain(use_cases.get_settings.execute())


@router.patch(
    "",
    response_model=RobotSettingsResponse,
    summary="Update robot settings",
    description="Updates robot behavior and safety settings. Requires an admin bearer token.",
    responses={
        400: {"description": "Invalid settings values."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can update settings."},
    },
)
def update_robot_settings(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    payload: UpdateRobotSettingsRequest,
) -> RobotSettingsResponse:
    current_settings = use_cases.get_settings.execute()
    try:
        updated_settings = use_cases.update_settings.execute(payload.apply_to(current_settings))
    except SettingsValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None
    return RobotSettingsResponse.from_domain(updated_settings)
