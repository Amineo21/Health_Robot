from __future__ import annotations

from fastapi import APIRouter
from app.application.dto.robot_dto import RobotStatus
from app.presentation.api.dependencies import CaregiverOrAdminDep, UseCasesDep

router = APIRouter(prefix="/robot", tags=["robot"])


@router.get("/status", response_model=RobotStatus)
def get_robot_status(use_cases: UseCasesDep, _current_user: CaregiverOrAdminDep) -> RobotStatus:
    status = use_cases.get_robot_status.execute()
    return RobotStatus.from_domain(status)
