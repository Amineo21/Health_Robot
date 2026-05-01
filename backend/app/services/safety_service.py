from __future__ import annotations

from app.core.config import settings
from app.models.events import (
    BatteryEvent,
    BatteryStatus,
    BatteryTelemetry,
    EmergencyEvent,
    EmergencyStopRequest,
    RobotMode,
    Severity,
)
from app.mqtt.client import MQTTService
from app.mqtt.topics import (
    ROBOT_ADMIN_TOPIC,
    ROBOT_COMMAND_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_PUSH_NOTIFICATIONS_TOPIC,
    ROBOT_UI_ALERTS_TOPIC,
)
from app.services.navigation_eta_service import NavigationEtaService
from app.state.robot_state import RobotStateStore


class SafetyService:
    def __init__(
        self,
        state_store: RobotStateStore,
        mqtt_service: MQTTService,
        navigation_eta_service: NavigationEtaService,
    ) -> None:
        self._state_store = state_store
        self._mqtt_service = mqtt_service
        self._navigation_eta_service = navigation_eta_service

    def process_battery_telemetry(self, telemetry: BatteryTelemetry) -> BatteryEvent:
        status = self._resolve_battery_status(telemetry)
        eta_snapshot = self._navigation_eta_service.build_eta_snapshot(telemetry)

        action = "NONE"
        details = None
        if status == BatteryStatus.critical and settings.auto_return_enabled:
            action = "RETURNING_TO_BASE"
            details = "Batterie sous le seuil critique, retour autonome a la base declenche."
            self._state_store.set_mode(RobotMode.returning_to_base, mission_id=telemetry.mission_id)
            self._mqtt_service.publish_json(
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
            self._mqtt_service.publish_json(
                ROBOT_PUSH_NOTIFICATIONS_TOPIC,
                {
                    "title": "Batterie faible",
                    "body": f"Le robot est a {telemetry.level}% et retourne automatiquement a la base.",
                    "severity": Severity.critical.value,
                },
            )
            self._mqtt_service.publish_json(
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
        self._state_store.update_battery(event)
        return event

    def trigger_emergency_stop(self, request: EmergencyStopRequest) -> EmergencyEvent:
        event = EmergencyEvent(
            source=request.source,
            reason=request.reason,
            requires_admin_restart=request.requires_admin_restart,
        )
        self._state_store.trigger_emergency(event)
        self._mqtt_service.publish_json(
            ROBOT_COMMAND_TOPIC,
            {
                "action": "emergency_stop",
                "reason": request.reason,
                "source": request.source.value,
                "motor_cutoff_ms": event.motor_cutoff_ms,
            },
        )
        self._mqtt_service.publish_json(
            ROBOT_EMERGENCY_TOPIC,
            event.model_dump(mode="json"),
            qos=1,
            retain=True,
        )
        self._mqtt_service.publish_json(
            ROBOT_UI_ALERTS_TOPIC,
            {
                "type": "EMERGENCY_STOP",
                "severity": Severity.critical.value,
                "screen": event.ui_state,
                    "message": "ARRET D'URGENCE ACTIVE",
            },
            qos=1,
        )
        return event

    def clear_emergency(self, actor: str) -> dict[str, str]:
        self._state_store.clear_emergency()
        self._mqtt_service.publish_json(
            ROBOT_ADMIN_TOPIC,
            {
                "action": "admin_restart_procedure",
                "actor": actor,
                "step": "reset_emergency_latch",
                "message": "Procedure de redemarrage administrateur demandee.",
            },
            qos=1,
        )
        self._mqtt_service.publish_json(
            ROBOT_EMERGENCY_TOPIC,
            {
                "active": False,
                "cleared_by": actor,
                "restart_procedure": "ADMIN_ONLY",
                "message": "Arret d'urgence reinitialise par un administrateur.",
            },
            qos=1,
            retain=True,
        )
        return {"status": "cleared", "restart_procedure": "ADMIN_ONLY", "message": "Reinitialisation effectuee."}

    @staticmethod
    def _resolve_battery_status(telemetry: BatteryTelemetry) -> BatteryStatus:
        if telemetry.is_charging:
            return BatteryStatus.charging
        if telemetry.level < settings.low_battery_threshold:
            return BatteryStatus.critical
        if telemetry.level <= settings.low_battery_threshold + 10:
            return BatteryStatus.low
        return BatteryStatus.normal
