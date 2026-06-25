from __future__ import annotations

from app.application.use_cases.mission_orchestrator import MissionOrchestrator
from app.domain.entities.robot import EmergencyEvent, EmergencyStopRequest, RobotStatus
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ProcessEmergencyTelemetryUseCase:
    def __init__(self, state_repository: RobotStateRepository, mission_orchestrator: MissionOrchestrator | None = None) -> None:
        self._state_repository = state_repository
        self._mission_orchestrator = mission_orchestrator

    def execute(self, request: EmergencyStopRequest) -> EmergencyEvent:
        event = EmergencyEvent(
            source=request.source,
            reason=request.reason,
            requires_admin_restart=request.requires_admin_restart,
        )
        self._state_repository.trigger_emergency(event)
        if self._mission_orchestrator is not None:
            self._mission_orchestrator.fail_active_mission("emergency_stop")
        return event

    def clear(self) -> RobotStatus:
        status = self._state_repository.clear_emergency()
        if self._mission_orchestrator is not None:
            self._mission_orchestrator.try_start_next_mission()
        return status
