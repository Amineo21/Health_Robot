from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.application.dto.robot_command_dto import (
    EmergencyStopCommandRequest,
    NavigateCommandRequest,
    RobotCommandResponse,
    TeleopCommandRequest,
)
from app.application.use_cases.robot_command_errors import RobotCommandForbiddenError, RobotCommandRejectedError
from app.domain.entities.robot_command import RobotCommandType
from app.presentation.api.dependencies import AdminUserDep, CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/robot/command", tags=["robot commands"])


def _map_command_error(exc: Exception) -> HTTPException:
    if isinstance(exc, RobotCommandForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/navigate",
    response_model=RobotCommandResponse,
    summary="Navigate to a free position",
    description="Publishes a Nav2 goal command to MQTT. Requires admin or caregiver access.",
    responses={
        400: {"description": "Invalid or rejected navigation command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Authenticated user cannot send navigation commands."},
    },
)
def navigate_to_position(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    payload: NavigateCommandRequest,
) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.navigate, current_user, payload.model_dump())
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)


@router.post(
    "/teleop",
    response_model=RobotCommandResponse,
    summary="Send manual teleop command",
    description="Publishes a bounded /cmd_vel-style command to MQTT. Requires admin access.",
    responses={
        400: {"description": "Invalid or rejected teleop command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can send teleop commands."},
    },
)
def send_teleop_command(
    use_cases: UseCasesDep,
    current_user: AdminUserDep,
    payload: TeleopCommandRequest,
) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.teleop, current_user, payload.model_dump())
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)


@router.post(
    "/emergency-stop",
    response_model=RobotCommandResponse,
    summary="Publish emergency stop command",
    description="Publishes an emergency stop command to MQTT. Requires admin or caregiver access.",
    responses={
        400: {"description": "Invalid or rejected emergency stop command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Authenticated user cannot trigger emergency stop."},
    },
)
def send_emergency_stop_command(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    payload: EmergencyStopCommandRequest,
) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.emergency_stop, current_user, payload.model_dump())
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)


@router.post(
    "/return-base",
    response_model=RobotCommandResponse,
    summary="Return robot to base",
    description="Publishes a return-to-base command to MQTT. Requires admin access.",
    responses={
        400: {"description": "Invalid or rejected return-base command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can send return-base commands."},
    },
)
def return_to_base(use_cases: UseCasesDep, current_user: AdminUserDep) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.return_base, current_user)
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)


@router.post(
    "/set-pose-origin",
    response_model=RobotCommandResponse,
    summary="Set robot pose to map origin",
    description="Publishes /initialpose at (0, 0, 0) through rosbridge. Requires admin access.",
    responses={
        400: {"description": "Invalid or rejected set-pose-origin command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can set the robot pose origin."},
    },
)
def set_pose_origin(use_cases: UseCasesDep, current_user: AdminUserDep) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.set_pose_origin, current_user)
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)


@router.post(
    "/clear-costmaps",
    response_model=RobotCommandResponse,
    summary="Clear Nav2 costmaps",
    description="Publishes a clear-costmaps recovery command to MQTT. Requires admin access.",
    responses={
        400: {"description": "Invalid or rejected clear-costmaps command."},
        401: {"description": "Missing, invalid, or expired bearer token."},
        403: {"description": "Only admin users can clear costmaps."},
    },
)
def clear_costmaps(use_cases: UseCasesDep, current_user: AdminUserDep) -> RobotCommandResponse:
    try:
        command = use_cases.send_robot_command.execute(RobotCommandType.clear_costmaps, current_user)
    except (RobotCommandForbiddenError, RobotCommandRejectedError) as exc:
        raise _map_command_error(exc) from None
    return RobotCommandResponse.from_domain(command)
