from __future__ import annotations

from app.domain.entities.robot import RobotStatus
from app.domain.repositories.robot_state_repository import RobotStateRepository


class GetRobotStatusUseCase:
    def __init__(self, state_repository: RobotStateRepository) -> None:
        self._state_repository = state_repository

    def execute(self) -> RobotStatus:
        return self._state_repository.get_status()
