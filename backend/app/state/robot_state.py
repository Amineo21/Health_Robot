from __future__ import annotations

from threading import Lock
from typing import Optional

from app.models.events import (
    BatteryEvent,
    BatteryStatus,
    EmergencyEvent,
    NavigationEtaTelemetry,
    RobotMode,
    RobotStatus,
)


class RobotStateStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._status = RobotStatus()

    def get_status(self) -> RobotStatus:
        with self._lock:
            return self._status.model_copy(deep=True)

    def update_battery(self, event: BatteryEvent) -> RobotStatus:
        with self._lock:
            mode = self._status.mode
            if event.action == "RETURNING_TO_BASE":
                mode = RobotMode.returning_to_base
            elif event.action == "CHARGING":
                mode = RobotMode.charging
            elif self._status.mode == RobotMode.returning_to_base and event.status == BatteryStatus.normal:
                mode = RobotMode.idle

            self._status = self._status.model_copy(
                update={
                    "battery_level": event.battery_level,
                    "battery_status": event.status,
                    "eta_to_base_seconds": event.eta_seconds,
                    "eta_source": event.eta_source,
                    "path_distance_m": event.path_distance_m,
                    "distance_remaining_m": event.distance_remaining_m,
                    "last_battery_event": event,
                    "mode": mode,
                }
            )
            return self._status.model_copy(deep=True)

    def set_mode(self, mode: RobotMode, mission_id: Optional[str] = None) -> RobotStatus:
        with self._lock:
            self._status = self._status.model_copy(
                update={
                    "mode": mode,
                    "mission_id": mission_id,
                }
            )
            return self._status.model_copy(deep=True)

    def update_navigation_eta(self, telemetry: NavigationEtaTelemetry) -> RobotStatus:
        with self._lock:
            update: dict[str, object] = {
                "eta_to_base_seconds": telemetry.eta_seconds,
                "eta_source": telemetry.eta_source,
                "path_distance_m": telemetry.path_distance_m,
                "distance_remaining_m": telemetry.distance_remaining_m,
                "current_speed_mps": telemetry.current_speed_mps,
            }
            if telemetry.mission_id is not None:
                update["mission_id"] = telemetry.mission_id
            self._status = self._status.model_copy(update=update)
            return self._status.model_copy(deep=True)

    def get_navigation_eta(self, mission_id: Optional[str] = None) -> Optional[NavigationEtaTelemetry]:
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
            self._status = self._status.model_copy(
                update={
                    "emergency_active": True,
                    "mode": RobotMode.emergency_stop,
                    "last_emergency_event": event,
                }
            )
            return self._status.model_copy(deep=True)

    def clear_emergency(self) -> RobotStatus:
        with self._lock:
            self._status = self._status.model_copy(
                update={
                    "emergency_active": False,
                    "mode": RobotMode.idle,
                }
            )
            return self._status.model_copy(deep=True)
