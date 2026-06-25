from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from threading import Lock

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


class InMemoryMissionRepository:
    def __init__(self) -> None:
        self._lock = Lock()
        self._points: dict[str, AnnotatedPoint] = {}
        self._supplies: dict[tuple[str, SupplyType], StockPointSupply] = {}
        self._missions: dict[str, Mission] = {}

    def list_points(
        self,
        point_type: AnnotatedPointType | None = None,
        active_only: bool = False,
    ) -> list[AnnotatedPoint]:
        with self._lock:
            points = list(self._points.values())
            if point_type is not None:
                points = [point for point in points if point.type == point_type]
            if active_only:
                points = [point for point in points if point.is_active]
            points.sort(key=lambda point: (point.type.value, point.name.lower(), point.created_at))
            return deepcopy(points)

    def get_point(self, point_id: str) -> AnnotatedPoint | None:
        with self._lock:
            point = self._points.get(point_id)
            return deepcopy(point) if point is not None else None

    def create_point(self, point: AnnotatedPoint) -> AnnotatedPoint:
        with self._lock:
            self._points[point.id] = point
            return deepcopy(point)

    def update_point(self, point: AnnotatedPoint) -> AnnotatedPoint:
        with self._lock:
            updated = replace(point, updated_at=utc_now())
            self._points[point.id] = updated
            return deepcopy(updated)

    def deactivate_point(self, point_id: str) -> AnnotatedPoint | None:
        with self._lock:
            point = self._points.get(point_id)
            if point is None:
                return None
            deactivated = replace(point, is_active=False, updated_at=utc_now())
            self._points[point_id] = deactivated
            return deepcopy(deactivated)

    def replace_stock_supplies(
        self,
        stock_point_id: str,
        supplies: list[StockPointSupply],
    ) -> list[StockPointSupply]:
        with self._lock:
            for key, existing in list(self._supplies.items()):
                if key[0] == stock_point_id:
                    self._supplies[key] = replace(existing, is_active=False)

            for supply in supplies:
                self._supplies[(stock_point_id, supply.supply_type)] = supply

            active = [supply for supply in self._supplies.values() if supply.stock_point_id == stock_point_id and supply.is_active]
            active.sort(key=lambda supply: (supply.priority_order, supply.supply_type.value))
            return deepcopy(active)

    def list_stock_supplies(
        self,
        stock_point_id: str | None = None,
        active_only: bool = True,
    ) -> list[StockPointSupply]:
        with self._lock:
            supplies = list(self._supplies.values())
            if stock_point_id is not None:
                supplies = [supply for supply in supplies if supply.stock_point_id == stock_point_id]
            if active_only:
                supplies = [supply for supply in supplies if supply.is_active]
            supplies.sort(key=lambda supply: (supply.stock_point_id, supply.priority_order, supply.supply_type.value))
            return deepcopy(supplies)

    def get_active_stock_for_supply(self, supply_type: SupplyType) -> AnnotatedPoint | None:
        with self._lock:
            candidates: list[tuple[int, str, AnnotatedPoint]] = []
            for supply in self._supplies.values():
                if supply.supply_type != supply_type or not supply.is_active:
                    continue
                point = self._points.get(supply.stock_point_id)
                if point is None or point.type != AnnotatedPointType.stock or not point.is_active:
                    continue
                candidates.append((supply.priority_order, point.name.lower(), point))
            if not candidates:
                return None
            candidates.sort(key=lambda item: (item[0], item[1]))
            return deepcopy(candidates[0][2])

    def create_mission(self, mission: Mission) -> Mission:
        with self._lock:
            self._missions[mission.id] = mission
            return deepcopy(mission)

    def update_mission(self, mission: Mission) -> Mission:
        with self._lock:
            updated = replace(mission, updated_at=utc_now())
            self._missions[mission.id] = updated
            return deepcopy(updated)

    def get_mission(self, mission_id: str) -> Mission | None:
        with self._lock:
            mission = self._missions.get(mission_id)
            return deepcopy(mission) if mission is not None else None

    def list_missions(self, include_terminal: bool = False, limit: int = 100) -> list[Mission]:
        with self._lock:
            missions = list(self._missions.values())
            if not include_terminal:
                missions = [mission for mission in missions if mission.status not in TERMINAL_MISSION_STATUSES]
            missions.sort(key=lambda mission: mission.created_at)
            return deepcopy(missions[:limit])

    def get_active_mission(self) -> Mission | None:
        with self._lock:
            missions = [mission for mission in self._missions.values() if mission.status in ACTIVE_MISSION_STATUSES]
            missions.sort(key=lambda mission: mission.created_at)
            return deepcopy(missions[0]) if missions else None

    def get_oldest_pending_mission(self) -> Mission | None:
        with self._lock:
            missions = [mission for mission in self._missions.values() if mission.status == MissionStatus.pending]
            missions.sort(key=lambda mission: mission.created_at)
            return deepcopy(missions[0]) if missions else None
