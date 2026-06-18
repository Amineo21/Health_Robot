from __future__ import annotations

from app.domain.entities.robot import RobotRuntimeTelemetry, RobotStatus
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ProcessRobotStatusTelemetryUseCase:
    def __init__(self, state_repository: RobotStateRepository) -> None:
        self._state_repository = state_repository

    def execute(self, telemetry: RobotRuntimeTelemetry) -> RobotStatus:
        return self._state_repository.update_runtime(telemetry)
