from __future__ import annotations

from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.domain.entities.mqtt_topics import (
    ROBOT_COMMAND_TOPIC,
    ROBOT_PUSH_NOTIFICATIONS_TOPIC,
    ROBOT_UI_ALERTS_TOPIC,
)
from app.domain.entities.robot import BatteryEvent, BatteryStatus, BatteryTelemetry, RobotMode, Severity
from app.domain.repositories.message_publisher import MessagePublisher
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ProcessBatteryTelemetryUseCase:
    def __init__(
        self,
        state_repository: RobotStateRepository,
        message_publisher: MessagePublisher,
        navigation_eta_use_case: ProcessNavigationEtaUseCase,
        low_battery_threshold: int,
        auto_return_enabled: bool,
    ) -> None:
        self._state_repository = state_repository
        self._message_publisher = message_publisher
        self._navigation_eta_use_case = navigation_eta_use_case
        self._low_battery_threshold = low_battery_threshold
        self._auto_return_enabled = auto_return_enabled

    def execute(self, telemetry: BatteryTelemetry) -> BatteryEvent:
        status = self._resolve_battery_status(telemetry)
        eta_snapshot = self._navigation_eta_use_case.build_eta_snapshot(telemetry)

        action = "NONE"
        details = None
        if status == BatteryStatus.critical and self._auto_return_enabled:
            action = "RETURNING_TO_BASE"
            details = "Batterie sous le seuil critique, retour autonome a la base declenche."
            self._state_repository.set_mode(RobotMode.returning_to_base, mission_id=telemetry.mission_id)
            self._message_publisher.publish_json(
                ROBOT_COMMAND_TOPIC,
                {
                    "action": "return_to_base",
                    "reason": "battery_critical",
                    "mission_id": telemetry.mission_id,
                    "eta_seconds": eta_snapshot.eta_seconds,
                    "eta_source": eta_snapshot.eta_source.value,
                    "path_distance_m": eta_snapshot.path_distance_m,
                    "distance_remaining_m": eta_snapshot.distance_remaining_m,
                },
            )
            self._message_publisher.publish_json(
                ROBOT_PUSH_NOTIFICATIONS_TOPIC,
                {
                    "title": "Batterie faible",
                    "body": f"Le robot est a {telemetry.level}% et retourne automatiquement a la base.",
                    "severity": Severity.critical.value,
                },
            )
            self._message_publisher.publish_json(
                ROBOT_UI_ALERTS_TOPIC,
                {
                    "type": "LOW_BATTERY",
                    "severity": Severity.critical.value,
                    "screen": "BATTERY_RED_ALERT",
                },
            )
        elif status == BatteryStatus.charging:
            action = "CHARGING"

        event = BatteryEvent(
            battery_level=telemetry.level,
            status=status,
            severity=Severity.critical if status == BatteryStatus.critical else Severity.info,
            action=action,
            eta_seconds=eta_snapshot.eta_seconds,
            eta_source=eta_snapshot.eta_source,
            path_distance_m=eta_snapshot.path_distance_m,
            distance_remaining_m=eta_snapshot.distance_remaining_m,
            mission_id=telemetry.mission_id,
            details=details,
        )
        self._state_repository.update_battery(event)
        return event

    def _resolve_battery_status(self, telemetry: BatteryTelemetry) -> BatteryStatus:
        if telemetry.is_charging:
            return BatteryStatus.charging
        if telemetry.level < self._low_battery_threshold:
            return BatteryStatus.critical
        if telemetry.level <= self._low_battery_threshold + 10:
            return BatteryStatus.low
        return BatteryStatus.normal
