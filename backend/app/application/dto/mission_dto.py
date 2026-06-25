from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities import mission as domain

SupplyType = domain.SupplyType
AnnotatedPointType = domain.AnnotatedPointType
MissionStatus = domain.MissionStatus


class DomainDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AnnotatedPointCreateRequest(DomainDto):
    name: str = Field(min_length=1, max_length=160)
    type: domain.AnnotatedPointType
    x: float
    y: float
    yaw: float = 0.0
    is_active: bool = True


class AnnotatedPointUpdateRequest(DomainDto):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    type: domain.AnnotatedPointType | None = None
    x: float | None = None
    y: float | None = None
    yaw: float | None = None
    is_active: bool | None = None


class AnnotatedPointResponse(DomainDto):
    id: str
    name: str
    type: domain.AnnotatedPointType
    x: float
    y: float
    yaw: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, point: domain.AnnotatedPoint) -> Self:
        return cls.model_validate(asdict(point))


class StockPointSupplyRequest(DomainDto):
    supply_type: domain.SupplyType
    priority_order: int = Field(default=1, ge=1)
    is_active: bool = True


class StockPointSuppliesUpdateRequest(DomainDto):
    supplies: list[StockPointSupplyRequest] = Field(default_factory=list)


class StockPointSupplyResponse(DomainDto):
    stock_point_id: str
    supply_type: domain.SupplyType
    priority_order: int
    is_active: bool

    @classmethod
    def from_domain(cls, supply: domain.StockPointSupply) -> Self:
        return cls.model_validate(asdict(supply))


class MissionCreateRequest(DomainDto):
    supply_type: domain.SupplyType
    delivery_room_id: str = Field(min_length=1, max_length=64)


class MissionResponse(DomainDto):
    id: str
    status: domain.MissionStatus
    supply_type: domain.SupplyType
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
    created_at: datetime
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
    updated_at: datetime

    @classmethod
    def from_domain(cls, mission: domain.Mission) -> Self:
        return cls.model_validate(asdict(mission))


class RobotScreenMission(DomainDto):
    id: str
    status: domain.MissionStatus
    supply_label_fr: str
    destination_label_fr: str


class RobotScreenStatusResponse(DomainDto):
    robot_state: str
    screen_title_fr: str
    screen_message_fr: str
    current_mission: RobotScreenMission | None = None
    updated_at: datetime
