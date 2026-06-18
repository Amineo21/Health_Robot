from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from app.domain.entities.user import UserRole


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RobotCommandType(str, Enum):
    navigate = "navigate"
    teleop = "teleop"
    emergency_stop = "emergency_stop"
    return_base = "return_base"
    clear_costmaps = "clear_costmaps"
    set_pose_origin = "set_pose_origin"


@dataclass(frozen=True)
class RobotCommand:
    command_id: str
    type: RobotCommandType
    requested_by: str
    requested_by_role: UserRole
    payload: dict[str, Any]
    timestamp: datetime = field(default_factory=utc_now)
