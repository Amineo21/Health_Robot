from __future__ import annotations

from dataclasses import dataclass

from app.application.use_cases.clear_emergency import ClearEmergencyUseCase
from app.application.use_cases.get_robot_status import GetRobotStatusUseCase
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.trigger_emergency_stop import TriggerEmergencyStopUseCase


@dataclass(frozen=True)
class ApplicationUseCases:
    get_robot_status: GetRobotStatusUseCase
    process_battery_telemetry: ProcessBatteryTelemetryUseCase
    process_navigation_eta: ProcessNavigationEtaUseCase
    trigger_emergency_stop: TriggerEmergencyStopUseCase
    clear_emergency: ClearEmergencyUseCase
