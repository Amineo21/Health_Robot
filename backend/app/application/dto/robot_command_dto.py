from __future__ import annotations

from datetime import datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.robot_command import RobotCommand, RobotCommandType
from app.domain.entities.user import UserRole


class NavigateCommandRequest(BaseModel):
    x: float
    y: float
    yaw: float = 0.0
    label: str = Field(default="position libre", min_length=1, max_length=120)


class TeleopCommandRequest(BaseModel):
    linear_x: float
    angular_z: float
    duration_ms: int = Field(gt=0, le=1000)


class EmergencyStopCommandRequest(BaseModel):
    reason: str = Field(default="manual_ui_stop", min_length=3, max_length=300)


class RobotCommandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    command_id: str
    type: RobotCommandType
    requested_by: str
    requested_by_role: UserRole
    payload: dict[str, Any]
    timestamp: datetime
    status: str = "published"

    @classmethod
    def from_domain(cls, command: RobotCommand) -> Self:
        return cls.model_validate(
            {
                "command_id": command.command_id,
                "type": command.type,
                "requested_by": command.requested_by,
                "requested_by_role": command.requested_by_role,
                "payload": command.payload,
                "timestamp": command.timestamp,
                "status": "published",
            }
        )
