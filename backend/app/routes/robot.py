from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.events import RobotStatus

router = APIRouter(prefix="/api/robot", tags=["robot"])


@router.get("/status", response_model=RobotStatus)
async def get_robot_status(request: Request) -> RobotStatus:
    return request.app.state.robot_state.get_status()
