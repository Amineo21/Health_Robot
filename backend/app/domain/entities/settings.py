from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class RobotSettings:
    id: str = "default"
    max_speed_mps: float = 0.5
    meal_speed_mps: float = 0.3
    low_battery_threshold: int = 20
    auto_return_enabled: bool = True
    teleop_enabled: bool = True
    emergency_requires_admin_reset: bool = True
    updated_at: datetime = field(default_factory=utc_now)
