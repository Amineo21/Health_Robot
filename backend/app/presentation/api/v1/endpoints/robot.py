from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.application.dto.robot_dto import RobotStatus
from app.domain.entities.mqtt_topics import ROBOT_CMD_VEL_TOPIC
from app.presentation.api.dependencies import UseCasesDep

router = APIRouter(prefix="/robot", tags=["robot"])

COMMAND_VELOCITIES: dict[str, dict[str, float]] = {
    "forward":  {"linear_x": 0.3,  "angular_z": 0.0},
    "backward": {"linear_x": -0.3, "angular_z": 0.0},
    "left":     {"linear_x": 0.0,  "angular_z": 0.5},
    "right":    {"linear_x": 0.0,  "angular_z": -0.5},
    "stop":     {"linear_x": 0.0,  "angular_z": 0.0},
}


class CmdVelRequest(BaseModel):
    command: Literal["forward", "backward", "left", "right", "stop"]


@router.get("/status", response_model=RobotStatus)
def get_robot_status(use_cases: UseCasesDep) -> RobotStatus:
    status = use_cases.get_robot_status.execute()
    return RobotStatus.from_domain(status)


@router.post("/cmd_vel")
def send_cmd_vel(request: Request, body: CmdVelRequest) -> dict[str, str]:
    vel = COMMAND_VELOCITIES[body.command]
    request.app.state.mqtt_service.publish_json(ROBOT_CMD_VEL_TOPIC, vel, qos=0)
    return {"status": "sent", "command": body.command}
