from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SavedRobotMap(BaseModel):
    name: str
    parts: dict[str, str] = Field(default_factory=dict)
    mtime: int = 0
    size: int = Field(default=0, ge=0)
    loadable: bool = False


class SavedRobotMapsResponse(BaseModel):
    maps: list[SavedRobotMap]


class RobotMapSnapshot(BaseModel):
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    resolution: float = Field(gt=0)
    origin_x: float = 0.0
    origin_y: float = 0.0
    data: list[int]
    updated_at: float


class SaveRobotMapRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class SaveRobotMapResponse(BaseModel):
    ok: bool
    name: str
    base_path: str
    occupancy: dict[str, Any] | None = None
    pose_graph: dict[str, Any] | None = None


class RobotMapOperationResponse(BaseModel):
    ok: bool
    result: dict[str, Any] = Field(default_factory=dict)
