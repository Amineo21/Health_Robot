from __future__ import annotations

from typing import Protocol

from app.domain.entities.mission import AnnotatedPoint, AnnotatedPointType, StockPointSupply, SupplyType


class AnnotatedPointRepository(Protocol):
    def list_points(
        self,
        point_type: AnnotatedPointType | None = None,
        active_only: bool = False,
    ) -> list[AnnotatedPoint]: ...

    def get_point(self, point_id: str) -> AnnotatedPoint | None: ...

    def create_point(self, point: AnnotatedPoint) -> AnnotatedPoint: ...

    def update_point(self, point: AnnotatedPoint) -> AnnotatedPoint: ...

    def deactivate_point(self, point_id: str) -> AnnotatedPoint | None: ...

    def replace_stock_supplies(
        self,
        stock_point_id: str,
        supplies: list[StockPointSupply],
    ) -> list[StockPointSupply]: ...

    def list_stock_supplies(
        self,
        stock_point_id: str | None = None,
        active_only: bool = True,
    ) -> list[StockPointSupply]: ...

    def get_active_stock_for_supply(self, supply_type: SupplyType) -> AnnotatedPoint | None: ...
