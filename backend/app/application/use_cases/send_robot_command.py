from __future__ import annotations

import math
from uuid import uuid4

from app.application.use_cases.robot_command_errors import RobotCommandForbiddenError, RobotCommandRejectedError
from app.domain.entities.robot import EmergencyEvent, EmergencySource, RobotMode
from app.domain.entities.robot_command import RobotCommand, RobotCommandType, utc_now
from app.domain.entities.user import User, UserRole
from app.domain.repositories.robot_command_publisher import RobotCommandPublisher
from app.domain.repositories.robot_state_repository import RobotStateRepository
from app.domain.repositories.settings_repository import SettingsRepository


class SendRobotCommandUseCase:
    def __init__(
        self,
        command_publisher: RobotCommandPublisher,
        state_repository: RobotStateRepository,
        settings_repository: SettingsRepository,
    ) -> None:
        self._command_publisher = command_publisher
        self._state_repository = state_repository
        self._settings_repository = settings_repository

    def execute(self, command_type: RobotCommandType, actor: User, payload: dict[str, object] | None = None) -> RobotCommand:
        payload = dict(payload or {})
        settings = self._settings_repository.get_settings()
        status = self._state_repository.get_status()

        if command_type != RobotCommandType.emergency_stop and status.emergency_active:
            raise RobotCommandRejectedError("Robot is in emergency stop")

        if command_type == RobotCommandType.navigate:
            self._require_role(actor, {UserRole.admin, UserRole.caregiver})
            self._validate_navigation_payload(payload)
            payload["max_speed_mps"] = settings.max_speed_mps
        elif command_type == RobotCommandType.teleop:
            self._require_role(actor, {UserRole.admin})
            if not settings.teleop_enabled:
                raise RobotCommandRejectedError("Teleop is disabled")
            self._validate_teleop_payload(payload, max_speed_mps=settings.max_speed_mps)
        elif command_type == RobotCommandType.emergency_stop:
            self._require_role(actor, {UserRole.admin, UserRole.caregiver})
        elif command_type == RobotCommandType.return_base:
            self._require_role(actor, {UserRole.admin})
        elif command_type == RobotCommandType.clear_costmaps:
            self._require_role(actor, {UserRole.admin})

        command = RobotCommand(
            command_id=f"cmd-{uuid4()}",
            type=command_type,
            requested_by=actor.id,
            requested_by_role=actor.role,
            payload=payload,
            timestamp=utc_now(),
        )
        self._command_publisher.publish(command)
        self._update_local_state(command)
        return command

    @staticmethod
    def _require_role(actor: User, allowed_roles: set[UserRole]) -> None:
        if actor.role not in allowed_roles:
            raise RobotCommandForbiddenError("Forbidden robot command")

    @staticmethod
    def _validate_navigation_payload(payload: dict[str, object]) -> None:
        for field_name in ("x", "y", "yaw"):
            value = payload.get(field_name)
            if not isinstance(value, int | float) or not math.isfinite(float(value)):
                raise RobotCommandRejectedError(f"{field_name} must be a finite number")

    @staticmethod
    def _validate_teleop_payload(payload: dict[str, object], max_speed_mps: float) -> None:
        linear_x = payload.get("linear_x")
        angular_z = payload.get("angular_z")
        duration_ms = payload.get("duration_ms")
        if not isinstance(linear_x, int | float) or not math.isfinite(float(linear_x)):
            raise RobotCommandRejectedError("linear_x must be a finite number")
        if abs(float(linear_x)) > max_speed_mps:
            raise RobotCommandRejectedError("linear_x exceeds max_speed_mps")
        if not isinstance(angular_z, int | float) or not math.isfinite(float(angular_z)):
            raise RobotCommandRejectedError("angular_z must be a finite number")
        if not isinstance(duration_ms, int) or duration_ms <= 0 or duration_ms > 1000:
            raise RobotCommandRejectedError("duration_ms must be between 1 and 1000")

    def _update_local_state(self, command: RobotCommand) -> None:
        if command.type == RobotCommandType.navigate:
            self._state_repository.set_mode(RobotMode.navigating, mission_id=command.command_id)
        elif command.type == RobotCommandType.return_base:
            self._state_repository.set_mode(RobotMode.returning_to_base, mission_id=command.command_id)
        elif command.type == RobotCommandType.emergency_stop:
            source = EmergencySource.admin if command.requested_by_role == UserRole.admin else EmergencySource.ui
            self._state_repository.trigger_emergency(
                EmergencyEvent(
                    source=source,
                    reason=str(command.payload.get("reason", "manual_ui_stop")),
                    requires_admin_restart=True,
                )
            )
