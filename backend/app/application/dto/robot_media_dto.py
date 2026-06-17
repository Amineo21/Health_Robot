from __future__ import annotations

from pydantic import BaseModel, Field


class RobotSound(BaseModel):
    name: str
    size: int = Field(ge=0)
    modified: int = 0


class RobotSoundsResponse(BaseModel):
    sounds: list[RobotSound]


class RobotSoundOperationResponse(BaseModel):
    ok: bool
    name: str | None = None
    size: int | None = Field(default=None, ge=0)


class RobotArmState(BaseModel):
    joints: list[int] = Field(default_factory=lambda: [90, 90, 90, 90, 90, 90], min_length=6, max_length=6)


class RobotArmCommandRequest(BaseModel):
    joint1: int = Field(ge=0, le=180)
    joint2: int = Field(ge=0, le=180)
    joint3: int = Field(ge=0, le=180)
    joint4: int = Field(ge=0, le=180)
    joint5: int = Field(ge=0, le=180)
    joint6: int = Field(ge=0, le=180)
    time_ms: int = Field(default=800, ge=100, le=5000)

    def joints(self) -> list[int]:
        return [self.joint1, self.joint2, self.joint3, self.joint4, self.joint5, self.joint6]
