from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnnotatedPointModel(Base):
    __tablename__ = "annotated_points"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    yaw: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class StockPointSupplyModel(Base):
    __tablename__ = "stock_point_supplies"

    stock_point_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("annotated_points.id"),
        primary_key=True,
    )
    supply_type: Mapped[str] = mapped_column(String(64), primary_key=True)
    priority_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)


class MissionModel(Base):
    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    supply_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    delivery_room_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    delivery_room_name_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    delivery_x_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    delivery_y_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    delivery_yaw_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    stock_point_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    stock_point_name_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    stock_x_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    stock_y_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    stock_yaw_snapshot: Mapped[float] = mapped_column(Float, nullable=False)
    created_by_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_by_name_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at_stock_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recovery_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recovery_confirmed_by_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    arrived_at_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_by_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
