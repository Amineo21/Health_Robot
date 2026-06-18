from __future__ import annotations

from dataclasses import asdict, replace
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.settings import RobotSettings


class RobotSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    max_speed_mps: float
    meal_speed_mps: float
    low_battery_threshold: int
    auto_return_enabled: bool
    teleop_enabled: bool
    emergency_requires_admin_reset: bool
    updated_at: datetime

    @classmethod
    def from_domain(cls, settings: RobotSettings) -> Self:
        return cls.model_validate(asdict(settings))


class UpdateRobotSettingsRequest(BaseModel):
    max_speed_mps: float | None = Field(default=None, gt=0)
    meal_speed_mps: float | None = Field(default=None, gt=0)
    low_battery_threshold: int | None = Field(default=None, ge=5, le=50)
    auto_return_enabled: bool | None = None
    teleop_enabled: bool | None = None
    emergency_requires_admin_reset: bool | None = None

    def apply_to(self, settings: RobotSettings) -> RobotSettings:
        return replace(settings, **self.model_dump(exclude_unset=True, exclude_none=True))
