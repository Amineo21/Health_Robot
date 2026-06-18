from __future__ import annotations

from typing import Protocol

from app.domain.entities.robot_command import RobotCommand


class RobotCommandPublisher(Protocol):
    def publish(self, command: RobotCommand) -> None: ...
