from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from threading import Lock

from app.domain.entities.robot import (
    BatteryEvent,
    BatteryStatus,
    EmergencyEvent,
    NavigationEtaTelemetry,
    RobotMode,
    RobotStatus,
)


class InMemoryRobotStateRepository:
    def __init__(self) -> None:
        self._lock = Lock()
        self._status = RobotStatus()

    def get_status(self) -> RobotStatus:
        with self._lock:
            return deepcopy(self._status)

    def update_battery(self, event: BatteryEvent) -> RobotStatus:
        with self._lock:
            mode = self._status.mode
            if event.action == "RETURNING_TO_BASE":
                mode = RobotMode.returning_to_base
            elif event.action == "CHARGING":
                mode = RobotMode.charging
            elif self._status.mode == RobotMode.returning_to_base and event.status == BatteryStatus.normal:
                mode = RobotMode.idle

            self._status = replace(
                self._status,
                battery_level=event.battery_level,
                battery_status=event.status,
                eta_to_base_seconds=event.eta_seconds,
                eta_source=event.eta_source,
                path_distance_m=event.path_distance_m,
                distance_remaining_m=event.distance_remaining_m,
                last_battery_event=event,
                mode=mode,
            )
            return deepcopy(self._status)

    def set_mode(self, mode: RobotMode, mission_id: str | None = None) -> RobotStatus:
        with self._lock:
            self._status = replace(self._status, mode=mode, mission_id=mission_id)
            return deepcopy(self._status)

    def update_navigation_eta(self, telemetry: NavigationEtaTelemetry) -> RobotStatus:
        with self._lock:
            update = {
                "eta_to_base_seconds": telemetry.eta_seconds,
                "eta_source": telemetry.eta_source,
                "path_distance_m": telemetry.path_distance_m,
                "distance_remaining_m": telemetry.distance_remaining_m,
                "current_speed_mps": telemetry.current_speed_mps,
            }
            if telemetry.mission_id is not None:
                update["mission_id"] = telemetry.mission_id

            self._status = replace(self._status, **update)
            return deepcopy(self._status)

    def get_navigation_eta(self, mission_id: str | None = None) -> NavigationEtaTelemetry | None:
        with self._lock:
            if mission_id is not None and self._status.mission_id not in {None, mission_id}:
                return None

            if (
                self._status.path_distance_m is None
                and self._status.distance_remaining_m is None
                and self._status.eta_to_base_seconds is None
            ):
                return None

            if self._status.eta_source is None:
                return None

            return NavigationEtaTelemetry(
                mission_id=self._status.mission_id,
                path_distance_m=self._status.path_distance_m,
                distance_remaining_m=self._status.distance_remaining_m,
                eta_seconds=self._status.eta_to_base_seconds,
                current_speed_mps=self._status.current_speed_mps,
                eta_source=self._status.eta_source,
            )

    def trigger_emergency(self, event: EmergencyEvent) -> RobotStatus:
        with self._lock:
            self._status = replace(
                self._status,
                emergency_active=True,
                mode=RobotMode.emergency_stop,
                last_emergency_event=event,
            )
            return deepcopy(self._status)

    def clear_emergency(self) -> RobotStatus:
        with self._lock:
            self._status = replace(
                self._status,
                emergency_active=False,
                mode=RobotMode.idle,
            )
            return deepcopy(self._status)
