from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities import robot as domain


Severity = domain.Severity
RobotMode = domain.RobotMode
BatteryStatus = domain.BatteryStatus
EmergencySource = domain.EmergencySource
EtaSource = domain.EtaSource


class DomainDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BatteryTelemetry(DomainDto):
    level: int = Field(ge=0, le=100)
    voltage: float | None = None
    is_charging: bool = False
    distance_to_base_m: float | None = Field(default=None, ge=0)
    path_distance_m: float | None = Field(default=None, ge=0)
    distance_remaining_m: float | None = Field(default=None, ge=0)
    eta_seconds: int | None = Field(default=None, ge=0)
    eta_source: domain.EtaSource | None = None
    current_speed_mps: float | None = Field(default=None, ge=0)
    mission_id: str | None = None
    timestamp: datetime = Field(default_factory=domain.utc_now)

    def to_domain(self) -> domain.BatteryTelemetry:
        return domain.BatteryTelemetry(**self.model_dump())


class BatteryEvent(DomainDto):
    timestamp: datetime = Field(default_factory=domain.utc_now)
    battery_level: int = Field(ge=0, le=100)
    status: domain.BatteryStatus
    severity: domain.Severity
    action: Literal["NONE", "RETURNING_TO_BASE", "CHARGING"]
    eta_seconds: int | None = Field(default=None, ge=0)
    eta_source: domain.EtaSource | None = None
    path_distance_m: float | None = Field(default=None, ge=0)
    distance_remaining_m: float | None = Field(default=None, ge=0)
    mission_id: str | None = None
    details: str | None = None

    @classmethod
    def from_domain(cls, event: domain.BatteryEvent) -> Self:
        return cls.model_validate(asdict(event))


class NavigationEtaTelemetry(DomainDto):
    timestamp: datetime = Field(default_factory=domain.utc_now)
    mission_id: str | None = None
    path_distance_m: float | None = Field(default=None, ge=0)
    distance_remaining_m: float | None = Field(default=None, ge=0)
    eta_seconds: int | None = Field(default=None, ge=0)
    current_speed_mps: float | None = Field(default=None, ge=0)
    eta_source: domain.EtaSource = domain.EtaSource.nav2_feedback
    target_name: str = "base"

    def to_domain(self) -> domain.NavigationEtaTelemetry:
        return domain.NavigationEtaTelemetry(**self.model_dump())

    @classmethod
    def from_domain(cls, telemetry: domain.NavigationEtaTelemetry) -> Self:
        return cls.model_validate(asdict(telemetry))


class RobotPose(DomainDto):
    x: float
    y: float
    yaw: float | None = None

    def to_domain(self) -> domain.RobotPose:
        return domain.RobotPose(**self.model_dump())

    @classmethod
    def from_domain(cls, pose: domain.RobotPose) -> Self:
        return cls.model_validate(asdict(pose))


class RobotMapMetadata(DomainDto):
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    resolution: float = Field(gt=0)
    origin_x: float = 0.0
    origin_y: float = 0.0

    def to_domain(self) -> domain.RobotMapMetadata:
        return domain.RobotMapMetadata(**self.model_dump())

    @classmethod
    def from_domain(cls, map_metadata: domain.RobotMapMetadata) -> Self:
        return cls.model_validate(asdict(map_metadata))


class RobotRuntimeTelemetry(DomainDto):
    mode: domain.RobotMode | None = None
    battery_level: int | None = Field(default=None, ge=0, le=100)
    emergency_active: bool | None = None
    pose: RobotPose | None = None
    map: RobotMapMetadata | None = None
    min_obstacle_distance_m: float | None = Field(default=None, ge=0)
    current_speed_mps: float | None = Field(default=None, ge=0)

    def to_domain(self) -> domain.RobotRuntimeTelemetry:
        payload = self.model_dump()
        if self.pose is not None:
            payload["pose"] = self.pose.to_domain()
        if self.map is not None:
            payload["map"] = self.map.to_domain()
        return domain.RobotRuntimeTelemetry(**payload)


class EmergencyStopRequest(DomainDto):
    source: domain.EmergencySource
    reason: str = Field(min_length=3, max_length=300)
    requires_admin_restart: bool = True

    def to_domain(self) -> domain.EmergencyStopRequest:
        return domain.EmergencyStopRequest(**self.model_dump())


class EmergencyEvent(DomainDto):
    timestamp: datetime = Field(default_factory=domain.utc_now)
    active: bool = True
    source: domain.EmergencySource
    reason: str
    motor_cutoff_ms: int = Field(default=100, ge=0, le=100)
    requires_admin_restart: bool = True
    ui_state: Literal["RED_SCREEN"] = "RED_SCREEN"
    restart_procedure: Literal["ADMIN_ONLY"] = "ADMIN_ONLY"

    @classmethod
    def from_domain(cls, event: domain.EmergencyEvent) -> Self:
        return cls.model_validate(asdict(event))


class RobotStatus(DomainDto):
    timestamp: datetime = Field(default_factory=domain.utc_now)
    mode: domain.RobotMode = domain.RobotMode.idle
    battery_level: int = Field(default=100, ge=0, le=100)
    battery_status: domain.BatteryStatus = domain.BatteryStatus.normal
    emergency_active: bool = False
    mission_id: str | None = None
    eta_to_base_seconds: int | None = Field(default=None, ge=0)
    eta_source: domain.EtaSource | None = None
    path_distance_m: float | None = Field(default=None, ge=0)
    distance_remaining_m: float | None = Field(default=None, ge=0)
    current_speed_mps: float | None = Field(default=None, ge=0)
    pose: RobotPose | None = None
    map: RobotMapMetadata | None = None
    min_obstacle_distance_m: float | None = Field(default=None, ge=0)
    last_battery_event: BatteryEvent | None = None
    last_emergency_event: EmergencyEvent | None = None

    @classmethod
    def from_domain(cls, status: domain.RobotStatus) -> Self:
        return cls.model_validate(asdict(status))
