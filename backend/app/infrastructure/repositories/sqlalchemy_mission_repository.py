from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.entities.mission import (
    ACTIVE_MISSION_STATUSES,
    TERMINAL_MISSION_STATUSES,
    AnnotatedPoint,
    AnnotatedPointType,
    Mission,
    MissionStatus,
    StockPointSupply,
    SupplyType,
    utc_now,
)
from app.infrastructure.database.models.mission_model import AnnotatedPointModel, MissionModel, StockPointSupplyModel


class SqlAlchemyMissionRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_points(
        self,
        point_type: AnnotatedPointType | None = None,
        active_only: bool = False,
    ) -> list[AnnotatedPoint]:
        with self._session_factory() as session:
            query = select(AnnotatedPointModel)
            if point_type is not None:
                query = query.where(AnnotatedPointModel.type == point_type.value)
            if active_only:
                query = query.where(AnnotatedPointModel.is_active.is_(True))
            query = query.order_by(AnnotatedPointModel.type, AnnotatedPointModel.name, AnnotatedPointModel.created_at)
            return [self._point_to_domain(model) for model in session.scalars(query).all()]

    def get_point(self, point_id: str) -> AnnotatedPoint | None:
        with self._session_factory() as session:
            model = session.get(AnnotatedPointModel, point_id)
            return self._point_to_domain(model) if model is not None else None

    def create_point(self, point: AnnotatedPoint) -> AnnotatedPoint:
        with self._session_factory() as session:
            model = AnnotatedPointModel(
                id=point.id,
                name=point.name,
                type=point.type.value,
                x=point.x,
                y=point.y,
                yaw=point.yaw,
                is_active=point.is_active,
                created_at=point.created_at,
                updated_at=point.updated_at,
            )
            session.add(model)
            session.commit()
            session.refresh(model)
            return self._point_to_domain(model)

    def update_point(self, point: AnnotatedPoint) -> AnnotatedPoint:
        with self._session_factory() as session:
            model = session.get(AnnotatedPointModel, point.id)
            if model is None:
                raise ValueError("Cannot update missing annotated point")
            model.name = point.name
            model.type = point.type.value
            model.x = point.x
            model.y = point.y
            model.yaw = point.yaw
            model.is_active = point.is_active
            model.updated_at = utc_now()
            session.commit()
            session.refresh(model)
            return self._point_to_domain(model)

    def deactivate_point(self, point_id: str) -> AnnotatedPoint | None:
        with self._session_factory() as session:
            model = session.get(AnnotatedPointModel, point_id)
            if model is None:
                return None
            model.is_active = False
            model.updated_at = utc_now()
            session.commit()
            session.refresh(model)
            return self._point_to_domain(model)

    def replace_stock_supplies(
        self,
        stock_point_id: str,
        supplies: list[StockPointSupply],
    ) -> list[StockPointSupply]:
        with self._session_factory() as session:
            existing = session.scalars(
                select(StockPointSupplyModel).where(StockPointSupplyModel.stock_point_id == stock_point_id)
            ).all()
            existing_by_supply = {SupplyType(model.supply_type): model for model in existing}

            for model in existing:
                model.is_active = False

            for supply in supplies:
                model = existing_by_supply.get(supply.supply_type)
                if model is None:
                    model = StockPointSupplyModel(
                        stock_point_id=stock_point_id,
                        supply_type=supply.supply_type.value,
                        priority_order=supply.priority_order,
                        is_active=supply.is_active,
                    )
                    session.add(model)
                else:
                    model.priority_order = supply.priority_order
                    model.is_active = supply.is_active

            session.commit()
            return self.list_stock_supplies(stock_point_id=stock_point_id, active_only=True)

    def list_stock_supplies(
        self,
        stock_point_id: str | None = None,
        active_only: bool = True,
    ) -> list[StockPointSupply]:
        with self._session_factory() as session:
            query = select(StockPointSupplyModel)
            if stock_point_id is not None:
                query = query.where(StockPointSupplyModel.stock_point_id == stock_point_id)
            if active_only:
                query = query.where(StockPointSupplyModel.is_active.is_(True))
            query = query.order_by(
                StockPointSupplyModel.stock_point_id,
                StockPointSupplyModel.priority_order,
                StockPointSupplyModel.supply_type,
            )
            return [self._supply_to_domain(model) for model in session.scalars(query).all()]

    def get_active_stock_for_supply(self, supply_type: SupplyType) -> AnnotatedPoint | None:
        with self._session_factory() as session:
            query = (
                select(AnnotatedPointModel)
                .join(StockPointSupplyModel, StockPointSupplyModel.stock_point_id == AnnotatedPointModel.id)
                .where(
                    AnnotatedPointModel.type == AnnotatedPointType.stock.value,
                    AnnotatedPointModel.is_active.is_(True),
                    StockPointSupplyModel.supply_type == supply_type.value,
                    StockPointSupplyModel.is_active.is_(True),
                )
                .order_by(StockPointSupplyModel.priority_order, AnnotatedPointModel.name, AnnotatedPointModel.created_at)
                .limit(1)
            )
            model = session.scalars(query).one_or_none()
            return self._point_to_domain(model) if model is not None else None

    def create_mission(self, mission: Mission) -> Mission:
        with self._session_factory() as session:
            model = self._mission_to_model(mission)
            session.add(model)
            session.commit()
            session.refresh(model)
            return self._mission_to_domain(model)

    def update_mission(self, mission: Mission) -> Mission:
        with self._session_factory() as session:
            model = session.get(MissionModel, mission.id)
            if model is None:
                raise ValueError("Cannot update missing mission")
            updated = replace(mission, updated_at=utc_now())
            self._copy_mission_to_model(updated, model)
            session.commit()
            session.refresh(model)
            return self._mission_to_domain(model)

    def get_mission(self, mission_id: str) -> Mission | None:
        with self._session_factory() as session:
            model = session.get(MissionModel, mission_id)
            return self._mission_to_domain(model) if model is not None else None

    def list_missions(self, include_terminal: bool = False, limit: int = 100) -> list[Mission]:
        with self._session_factory() as session:
            query = select(MissionModel)
            if not include_terminal:
                query = query.where(MissionModel.status.not_in([status.value for status in TERMINAL_MISSION_STATUSES]))
            query = query.order_by(MissionModel.created_at).limit(limit)
            return [self._mission_to_domain(model) for model in session.scalars(query).all()]

    def get_active_mission(self) -> Mission | None:
        with self._session_factory() as session:
            query = (
                select(MissionModel)
                .where(MissionModel.status.in_([status.value for status in ACTIVE_MISSION_STATUSES]))
                .order_by(MissionModel.created_at)
                .limit(1)
            )
            model = session.scalars(query).one_or_none()
            return self._mission_to_domain(model) if model is not None else None

    def get_oldest_pending_mission(self) -> Mission | None:
        with self._session_factory() as session:
            query = (
                select(MissionModel)
                .where(MissionModel.status == MissionStatus.pending.value)
                .order_by(MissionModel.created_at)
                .limit(1)
            )
            model = session.scalars(query).one_or_none()
            return self._mission_to_domain(model) if model is not None else None

    @staticmethod
    def _point_to_domain(model: AnnotatedPointModel) -> AnnotatedPoint:
        return AnnotatedPoint(
            id=model.id,
            name=model.name,
            type=AnnotatedPointType(model.type),
            x=model.x,
            y=model.y,
            yaw=model.yaw,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _supply_to_domain(model: StockPointSupplyModel) -> StockPointSupply:
        return StockPointSupply(
            stock_point_id=model.stock_point_id,
            supply_type=SupplyType(model.supply_type),
            priority_order=model.priority_order,
            is_active=model.is_active,
        )

    @staticmethod
    def _mission_to_model(mission: Mission) -> MissionModel:
        model = MissionModel()
        SqlAlchemyMissionRepository._copy_mission_to_model(mission, model)
        return model

    @staticmethod
    def _copy_mission_to_model(mission: Mission, model: MissionModel) -> None:
        model.id = mission.id
        model.status = mission.status.value
        model.supply_type = mission.supply_type.value
        model.delivery_room_id = mission.delivery_room_id
        model.delivery_room_name_snapshot = mission.delivery_room_name_snapshot
        model.delivery_x_snapshot = mission.delivery_x_snapshot
        model.delivery_y_snapshot = mission.delivery_y_snapshot
        model.delivery_yaw_snapshot = mission.delivery_yaw_snapshot
        model.stock_point_id = mission.stock_point_id
        model.stock_point_name_snapshot = mission.stock_point_name_snapshot
        model.stock_x_snapshot = mission.stock_x_snapshot
        model.stock_y_snapshot = mission.stock_y_snapshot
        model.stock_yaw_snapshot = mission.stock_yaw_snapshot
        model.created_by_user_id = mission.created_by_user_id
        model.created_by_name_snapshot = mission.created_by_name_snapshot
        model.created_at = mission.created_at
        model.started_at = mission.started_at
        model.arrived_at_stock_at = mission.arrived_at_stock_at
        model.recovery_confirmed_at = mission.recovery_confirmed_at
        model.recovery_confirmed_by_user_id = mission.recovery_confirmed_by_user_id
        model.arrived_at_delivery_at = mission.arrived_at_delivery_at
        model.delivery_confirmed_at = mission.delivery_confirmed_at
        model.delivery_confirmed_by_user_id = mission.delivery_confirmed_by_user_id
        model.completed_at = mission.completed_at
        model.cancelled_at = mission.cancelled_at
        model.cancelled_by_user_id = mission.cancelled_by_user_id
        model.failure_reason = mission.failure_reason
        model.updated_at = mission.updated_at

    @staticmethod
    def _mission_to_domain(model: MissionModel) -> Mission:
        return Mission(
            id=model.id,
            status=MissionStatus(model.status),
            supply_type=SupplyType(model.supply_type),
            delivery_room_id=model.delivery_room_id,
            delivery_room_name_snapshot=model.delivery_room_name_snapshot,
            delivery_x_snapshot=model.delivery_x_snapshot,
            delivery_y_snapshot=model.delivery_y_snapshot,
            delivery_yaw_snapshot=model.delivery_yaw_snapshot,
            stock_point_id=model.stock_point_id,
            stock_point_name_snapshot=model.stock_point_name_snapshot,
            stock_x_snapshot=model.stock_x_snapshot,
            stock_y_snapshot=model.stock_y_snapshot,
            stock_yaw_snapshot=model.stock_yaw_snapshot,
            created_by_user_id=model.created_by_user_id,
            created_by_name_snapshot=model.created_by_name_snapshot,
            created_at=model.created_at,
            started_at=model.started_at,
            arrived_at_stock_at=model.arrived_at_stock_at,
            recovery_confirmed_at=model.recovery_confirmed_at,
            recovery_confirmed_by_user_id=model.recovery_confirmed_by_user_id,
            arrived_at_delivery_at=model.arrived_at_delivery_at,
            delivery_confirmed_at=model.delivery_confirmed_at,
            delivery_confirmed_by_user_id=model.delivery_confirmed_by_user_id,
            completed_at=model.completed_at,
            cancelled_at=model.cancelled_at,
            cancelled_by_user_id=model.cancelled_by_user_id,
            failure_reason=model.failure_reason,
            updated_at=model.updated_at,
        )
