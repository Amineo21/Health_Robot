from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Severity(str, Enum):
    info = "INFO"
    warning = "WARNING"
    critical = "CRITICAL"


class RobotMode(str, Enum):
    idle = "IDLE"
    navigating = "NAVIGATING"
    returning_to_base = "RETURNING_TO_BASE"
    charging = "CHARGING"
    emergency_stop = "EMERGENCY_STOP"


class BatteryStatus(str, Enum):
    normal = "NORMAL"
    low = "LOW"
    critical = "CRITICAL"
    charging = "CHARGING"


class EmergencySource(str, Enum):
    physical_button = "physical_button"
    ui = "ui"
    ros2 = "ros2"
    safety_node = "safety_node"
    admin = "admin"


class EtaSource(str, Enum):
    fallback = "FALLBACK"
    nav2_path = "NAV2_PATH"
    nav2_feedback = "NAV2_FEEDBACK"


class BatteryTelemetry(BaseModel):
    level: int = Field(ge=0, le=100)
    voltage: Optional[float] = None
    is_charging: bool = False
    distance_to_base_m: Optional[float] = Field(default=None, ge=0)
    path_distance_m: Optional[float] = Field(default=None, ge=0)
    distance_remaining_m: Optional[float] = Field(default=None, ge=0)
    eta_seconds: Optional[int] = Field(default=None, ge=0)
    eta_source: Optional[EtaSource] = None
    current_speed_mps: Optional[float] = Field(default=None, ge=0)
    mission_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=utc_now)


class BatteryEvent(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    battery_level: int = Field(ge=0, le=100)
    status: BatteryStatus
    severity: Severity
    action: Literal["NONE", "RETURNING_TO_BASE", "CHARGING"]
    eta_seconds: Optional[int] = Field(default=None, ge=0)
    eta_source: Optional[EtaSource] = None
    path_distance_m: Optional[float] = Field(default=None, ge=0)
    distance_remaining_m: Optional[float] = Field(default=None, ge=0)
    mission_id: Optional[str] = None
    details: Optional[str] = None


class NavigationEtaTelemetry(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    mission_id: Optional[str] = None
    path_distance_m: Optional[float] = Field(default=None, ge=0)
    distance_remaining_m: Optional[float] = Field(default=None, ge=0)
    eta_seconds: Optional[int] = Field(default=None, ge=0)
    current_speed_mps: Optional[float] = Field(default=None, ge=0)
    eta_source: EtaSource = EtaSource.nav2_feedback
    target_name: str = "base"


class EmergencyStopRequest(BaseModel):
    source: EmergencySource
    reason: str = Field(min_length=3, max_length=300)
    requires_admin_restart: bool = True


class EmergencyEvent(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    active: bool = True
    source: EmergencySource
    reason: str
    motor_cutoff_ms: int = Field(default=100, ge=0, le=100)
    requires_admin_restart: bool = True
    ui_state: Literal["RED_SCREEN"] = "RED_SCREEN"
    restart_procedure: Literal["ADMIN_ONLY"] = "ADMIN_ONLY"


class RobotStatus(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    mode: RobotMode = RobotMode.idle
    battery_level: int = Field(default=100, ge=0, le=100)
    battery_status: BatteryStatus = BatteryStatus.normal
    emergency_active: bool = False
    mission_id: Optional[str] = None
    eta_to_base_seconds: Optional[int] = Field(default=None, ge=0)
    eta_source: Optional[EtaSource] = None
    path_distance_m: Optional[float] = Field(default=None, ge=0)
    distance_remaining_m: Optional[float] = Field(default=None, ge=0)
    current_speed_mps: Optional[float] = Field(default=None, ge=0)
    last_battery_event: Optional[BatteryEvent] = None
    last_emergency_event: Optional[EmergencyEvent] = None
