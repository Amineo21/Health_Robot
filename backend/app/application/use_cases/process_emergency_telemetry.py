from __future__ import annotations

from app.domain.entities.robot import EmergencyEvent, EmergencyStopRequest, RobotStatus
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ProcessEmergencyTelemetryUseCase:
    def __init__(self, state_repository: RobotStateRepository) -> None:
        self._state_repository = state_repository

    def execute(self, request: EmergencyStopRequest) -> EmergencyEvent:
        event = EmergencyEvent(
            source=request.source,
            reason=request.reason,
            requires_admin_restart=request.requires_admin_restart,
        )
        self._state_repository.trigger_emergency(event)
        return event

    def clear(self) -> RobotStatus:
        return self._state_repository.clear_emergency()
