from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RobotSettingsModel(Base):
    __tablename__ = "robot_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    max_speed_mps: Mapped[float] = mapped_column(Float, nullable=False)
    meal_speed_mps: Mapped[float] = mapped_column(Float, nullable=False)
    low_battery_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    auto_return_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    teleop_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    emergency_requires_admin_reset: Mapped[bool] = mapped_column(Boolean, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
