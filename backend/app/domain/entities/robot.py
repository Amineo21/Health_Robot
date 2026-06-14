from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Literal


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


@dataclass(frozen=True)
class BatteryTelemetry:
    level: int
    voltage: float | None = None
    is_charging: bool = False
    distance_to_base_m: float | None = None
    path_distance_m: float | None = None
    distance_remaining_m: float | None = None
    eta_seconds: int | None = None
    eta_source: EtaSource | None = None
    current_speed_mps: float | None = None
    mission_id: str | None = None
    timestamp: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class BatteryEvent:
    battery_level: int
    status: BatteryStatus
    severity: Severity
    action: Literal["NONE", "RETURNING_TO_BASE", "CHARGING"]
    timestamp: datetime = field(default_factory=utc_now)
    eta_seconds: int | None = None
    eta_source: EtaSource | None = None
    path_distance_m: float | None = None
    distance_remaining_m: float | None = None
    mission_id: str | None = None
    details: str | None = None


@dataclass(frozen=True)
class NavigationEtaTelemetry:
    timestamp: datetime = field(default_factory=utc_now)
    mission_id: str | None = None
    path_distance_m: float | None = None
    distance_remaining_m: float | None = None
    eta_seconds: int | None = None
    current_speed_mps: float | None = None
    eta_source: EtaSource = EtaSource.nav2_feedback
    target_name: str = "base"


@dataclass(frozen=True)
class EmergencyStopRequest:
    source: EmergencySource
    reason: str
    requires_admin_restart: bool = True


@dataclass(frozen=True)
class EmergencyEvent:
    source: EmergencySource
    reason: str
    timestamp: datetime = field(default_factory=utc_now)
    active: bool = True
    motor_cutoff_ms: int = 100
    requires_admin_restart: bool = True
    ui_state: Literal["RED_SCREEN"] = "RED_SCREEN"
    restart_procedure: Literal["ADMIN_ONLY"] = "ADMIN_ONLY"


@dataclass(frozen=True)
class RobotStatus:
    timestamp: datetime = field(default_factory=utc_now)
    mode: RobotMode = RobotMode.idle
    battery_level: int = 100
    battery_status: BatteryStatus = BatteryStatus.normal
    emergency_active: bool = False
    mission_id: str | None = None
    eta_to_base_seconds: int | None = None
    eta_source: EtaSource | None = None
    path_distance_m: float | None = None
    distance_remaining_m: float | None = None
    current_speed_mps: float | None = None
    last_battery_event: BatteryEvent | None = None
    last_emergency_event: EmergencyEvent | None = None
