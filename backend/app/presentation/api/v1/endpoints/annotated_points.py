from __future__ import annotations

from dataclasses import replace
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.application.dto.mission_dto import (
    AnnotatedPointCreateRequest,
    AnnotatedPointResponse,
    AnnotatedPointType,
    AnnotatedPointUpdateRequest,
    StockPointSuppliesUpdateRequest,
    StockPointSupplyResponse,
)
from app.domain.entities.mission import AnnotatedPoint, AnnotatedPointType as DomainPointType, StockPointSupply, utc_now
from app.presentation.api.dependencies import AdminUserDep, CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/annotated-points", tags=["annotated points"])


@router.get("", response_model=list[AnnotatedPointResponse])
def list_annotated_points(
    use_cases: UseCasesDep,
    _current_user: CaregiverOrAdminDep,
    point_type: Annotated[AnnotatedPointType | None, Query(alias="type")] = None,
    active_only: Annotated[bool, Query()] = False,
) -> list[AnnotatedPointResponse]:
    points = use_cases.annotated_points.list_points(point_type=point_type, active_only=active_only)
    return [AnnotatedPointResponse.from_domain(point) for point in points]


@router.post("", response_model=AnnotatedPointResponse, status_code=status.HTTP_201_CREATED)
def create_annotated_point(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    payload: AnnotatedPointCreateRequest,
) -> AnnotatedPointResponse:
    now = utc_now()
    point = AnnotatedPoint(
        id=f"pt-{uuid4()}",
        name=payload.name.strip(),
        type=payload.type,
        x=payload.x,
        y=payload.y,
        yaw=payload.yaw,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    return AnnotatedPointResponse.from_domain(use_cases.annotated_points.create_point(point))


@router.patch("/{point_id}", response_model=AnnotatedPointResponse)
def update_annotated_point(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    payload: AnnotatedPointUpdateRequest,
    point_id: Annotated[str, Path(min_length=1)],
) -> AnnotatedPointResponse:
    point = use_cases.annotated_points.get_point(point_id)
    if point is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotated point not found")

    updated = replace(
        point,
        name=payload.name.strip() if payload.name is not None else point.name,
        type=payload.type if payload.type is not None else point.type,
        x=payload.x if payload.x is not None else point.x,
        y=payload.y if payload.y is not None else point.y,
        yaw=payload.yaw if payload.yaw is not None else point.yaw,
        is_active=payload.is_active if payload.is_active is not None else point.is_active,
    )
    return AnnotatedPointResponse.from_domain(use_cases.annotated_points.update_point(updated))


@router.delete("/{point_id}", response_model=AnnotatedPointResponse)
def deactivate_annotated_point(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    point_id: Annotated[str, Path(min_length=1)],
) -> AnnotatedPointResponse:
    point = use_cases.annotated_points.deactivate_point(point_id)
    if point is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotated point not found")
    return AnnotatedPointResponse.from_domain(point)


@router.get("/{point_id}/supplies", response_model=list[StockPointSupplyResponse])
def list_stock_supplies(
    use_cases: UseCasesDep,
    _current_user: CaregiverOrAdminDep,
    point_id: Annotated[str, Path(min_length=1)],
) -> list[StockPointSupplyResponse]:
    point = use_cases.annotated_points.get_point(point_id)
    if point is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotated point not found")
    supplies = use_cases.annotated_points.list_stock_supplies(stock_point_id=point_id, active_only=True)
    return [StockPointSupplyResponse.from_domain(supply) for supply in supplies]


@router.put("/{point_id}/supplies", response_model=list[StockPointSupplyResponse])
def replace_stock_supplies(
    use_cases: UseCasesDep,
    _current_user: AdminUserDep,
    payload: StockPointSuppliesUpdateRequest,
    point_id: Annotated[str, Path(min_length=1)],
) -> list[StockPointSupplyResponse]:
    point = use_cases.annotated_points.get_point(point_id)
    if point is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotated point not found")
    if point.type != DomainPointType.stock:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplies can only be configured on STOCK points")

    seen_supply_types = set()
    supplies: list[StockPointSupply] = []
    for item in payload.supplies:
        if item.supply_type in seen_supply_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate supply type")
        seen_supply_types.add(item.supply_type)
        supplies.append(
            StockPointSupply(
                stock_point_id=point_id,
                supply_type=item.supply_type,
                priority_order=item.priority_order,
                is_active=item.is_active,
            )
        )

    updated = use_cases.annotated_points.replace_stock_supplies(point_id, supplies)
    return [StockPointSupplyResponse.from_domain(supply) for supply in updated]
