from __future__ import annotations

from app.application.use_cases.mission_orchestrator import MissionOrchestrator
from app.domain.entities.robot import RobotRuntimeTelemetry, RobotStatus
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ProcessRobotStatusTelemetryUseCase:
    def __init__(self, state_repository: RobotStateRepository, mission_orchestrator: MissionOrchestrator | None = None) -> None:
        self._state_repository = state_repository
        self._mission_orchestrator = mission_orchestrator

    def execute(self, telemetry: RobotRuntimeTelemetry) -> RobotStatus:
        status = self._state_repository.update_runtime(telemetry)
        if self._mission_orchestrator is None:
            return status

        if telemetry.emergency_active:
            self._mission_orchestrator.fail_active_mission("emergency_stop")
        elif telemetry.pose is not None:
            self._mission_orchestrator.handle_robot_pose_updated(telemetry.pose)
        return status
