from __future__ import annotations

from threading import Lock
from typing import Optional

from app.models.events import BatteryEvent, BatteryStatus, EmergencyEvent, RobotMode, RobotStatus


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
