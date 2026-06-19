from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.application.dto.mission_dto import MissionCreateRequest, MissionResponse
from app.application.use_cases.mission_orchestrator import MissionNotFoundError, MissionTransitionError, MissionValidationError
from app.presentation.api.dependencies import CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/missions", tags=["missions"])


def _mission_error_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, MissionNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, MissionTransitionError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=list[MissionResponse])
def list_missions(
    use_cases: UseCasesDep,
    _current_user: CaregiverOrAdminDep,
    include_terminal: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[MissionResponse]:
    missions = use_cases.missions.list_missions(include_terminal=include_terminal, limit=limit)
    return [MissionResponse.from_domain(mission) for mission in missions]


@router.post("", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
def create_mission(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    payload: MissionCreateRequest,
) -> MissionResponse:
    try:
        mission = use_cases.mission_orchestrator.create_mission(payload.supply_type, payload.delivery_room_id, current_user)
    except (MissionValidationError, MissionTransitionError, MissionNotFoundError) as exc:
        raise _mission_error_to_http(exc) from None
    return MissionResponse.from_domain(mission)


@router.post("/{mission_id}/confirm-recovery", response_model=MissionResponse)
def confirm_recovery(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    mission_id: Annotated[str, Path(min_length=1)],
) -> MissionResponse:
    try:
        mission = use_cases.mission_orchestrator.confirm_recovery(mission_id, current_user)
    except (MissionValidationError, MissionTransitionError, MissionNotFoundError) as exc:
        raise _mission_error_to_http(exc) from None
    return MissionResponse.from_domain(mission)


@router.post("/{mission_id}/confirm-delivery", response_model=MissionResponse)
def confirm_delivery(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    mission_id: Annotated[str, Path(min_length=1)],
) -> MissionResponse:
    try:
        mission = use_cases.mission_orchestrator.confirm_delivery(mission_id, current_user)
    except (MissionValidationError, MissionTransitionError, MissionNotFoundError) as exc:
        raise _mission_error_to_http(exc) from None
    return MissionResponse.from_domain(mission)


@router.post("/{mission_id}/cancel", response_model=MissionResponse)
def cancel_mission(
    use_cases: UseCasesDep,
    current_user: CaregiverOrAdminDep,
    mission_id: Annotated[str, Path(min_length=1)],
) -> MissionResponse:
    try:
        mission = use_cases.mission_orchestrator.cancel_mission(mission_id, current_user)
    except (MissionValidationError, MissionTransitionError, MissionNotFoundError) as exc:
        raise _mission_error_to_http(exc) from None
    return MissionResponse.from_domain(mission)
