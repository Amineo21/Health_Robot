from __future__ import annotations

from typing import Protocol

from app.domain.entities.robot import (
    BatteryEvent,
    EmergencyEvent,
    NavigationEtaTelemetry,
    RobotMode,
    RobotStatus,
)


class RobotStateRepository(Protocol):
    def get_status(self) -> RobotStatus: ...

    def update_battery(self, event: BatteryEvent) -> RobotStatus: ...

    def set_mode(self, mode: RobotMode, mission_id: str | None = None) -> RobotStatus: ...

    def update_navigation_eta(self, telemetry: NavigationEtaTelemetry) -> RobotStatus: ...

    def get_navigation_eta(self, mission_id: str | None = None) -> NavigationEtaTelemetry | None: ...

    def trigger_emergency(self, event: EmergencyEvent) -> RobotStatus: ...

    def clear_emergency(self) -> RobotStatus: ...
