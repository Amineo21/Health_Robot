from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SupplyType(str, Enum):
    serviettes = "serviettes"
    papier_toilette = "papier_toilette"
    gants = "gants"
    protections = "protections"
    linge = "linge"


class AnnotatedPointType(str, Enum):
    stock = "STOCK"
    delivery_room = "DELIVERY_ROOM"
    robot_base = "ROBOT_BASE"


class MissionStatus(str, Enum):
    pending = "PENDING"
    navigating_to_stock = "NAVIGATING_TO_STOCK"
    waiting_for_recovery_confirmation = "WAITING_FOR_RECOVERY_CONFIRMATION"
    navigating_to_delivery = "NAVIGATING_TO_DELIVERY"
    waiting_for_delivery_confirmation = "WAITING_FOR_DELIVERY_CONFIRMATION"
    completed = "COMPLETED"
    cancelled = "CANCELLED"
    failed = "FAILED"


TERMINAL_MISSION_STATUSES = {
    MissionStatus.completed,
    MissionStatus.cancelled,
    MissionStatus.failed,
}
ACTIVE_MISSION_STATUSES = {
    MissionStatus.navigating_to_stock,
    MissionStatus.waiting_for_recovery_confirmation,
    MissionStatus.navigating_to_delivery,
    MissionStatus.waiting_for_delivery_confirmation,
}
NAVIGATING_MISSION_STATUSES = {
    MissionStatus.navigating_to_stock,
    MissionStatus.navigating_to_delivery,
}
CANCELLABLE_MISSION_STATUSES = {MissionStatus.pending, *ACTIVE_MISSION_STATUSES}


@dataclass(frozen=True)
class AnnotatedPoint:
    id: str
    name: str
    type: AnnotatedPointType
    x: float
    y: float
    yaw: float
    is_active: bool = True
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class StockPointSupply:
    stock_point_id: str
    supply_type: SupplyType
    priority_order: int
    is_active: bool = True


@dataclass(frozen=True)
class Mission:
    id: str
    status: MissionStatus
    supply_type: SupplyType
    delivery_room_id: str
    delivery_room_name_snapshot: str
    delivery_x_snapshot: float
    delivery_y_snapshot: float
    delivery_yaw_snapshot: float
    stock_point_id: str
    stock_point_name_snapshot: str
    stock_x_snapshot: float
    stock_y_snapshot: float
    stock_yaw_snapshot: float
    created_by_user_id: str
    created_by_name_snapshot: str
    created_at: datetime = field(default_factory=utc_now)
    started_at: datetime | None = None
    arrived_at_stock_at: datetime | None = None
    recovery_confirmed_at: datetime | None = None
    recovery_confirmed_by_user_id: str | None = None
    arrived_at_delivery_at: datetime | None = None
    delivery_confirmed_at: datetime | None = None
    delivery_confirmed_by_user_id: str | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by_user_id: str | None = None
    failure_reason: str | None = None
    updated_at: datetime = field(default_factory=utc_now)
