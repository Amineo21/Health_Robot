from __future__ import annotations

import logging
from typing import Any

from app.application.dto.robot_dto import (
    BatteryTelemetry as BatteryTelemetryDto,
    EmergencyStopRequest as EmergencyStopRequestDto,
    NavigationEtaTelemetry as NavigationEtaTelemetryDto,
)
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.trigger_emergency_stop import TriggerEmergencyStopUseCase
from app.domain.entities.mqtt_topics import (
    ROBOT_BATTERY_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_NAV2_FEEDBACK_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
)

logger = logging.getLogger(__name__)


class HandleMqttMessageUseCase:
    def __init__(
        self,
        process_battery_telemetry: ProcessBatteryTelemetryUseCase,
        process_navigation_eta: ProcessNavigationEtaUseCase,
        trigger_emergency_stop: TriggerEmergencyStopUseCase,
    ) -> None:
        self._process_battery_telemetry = process_battery_telemetry
        self._process_navigation_eta = process_navigation_eta
        self._trigger_emergency_stop = trigger_emergency_stop

    def execute(self, topic: str, payload: dict[str, Any]) -> None:
        if topic == ROBOT_BATTERY_TOPIC:
            self._handle_battery_payload(payload)
            return

        if topic in {ROBOT_NAV2_PATH_TOPIC, ROBOT_NAV2_FEEDBACK_TOPIC}:
            self._handle_navigation_payload(topic, payload)
            return

        if topic == ROBOT_EMERGENCY_TOPIC and payload.get("active"):
            self._handle_emergency_payload(payload)

    def _handle_battery_payload(self, payload: dict[str, Any]) -> None:
        try:
            telemetry = BatteryTelemetryDto.model_validate(payload).to_domain()
        except Exception as exc:
            logger.warning("Payload batterie invalide recu: %s", exc)
            return
        self._process_battery_telemetry.execute(telemetry)

    def _handle_navigation_payload(self, topic: str, payload: dict[str, Any]) -> None:
        try:
            default_source = "NAV2_PATH" if topic == ROBOT_NAV2_PATH_TOPIC else "NAV2_FEEDBACK"
            telemetry = NavigationEtaTelemetryDto.model_validate(
                {
                    **payload,
                    "eta_source": payload.get("eta_source", default_source),
                }
            ).to_domain()
        except Exception as exc:
            logger.warning("Payload navigation ETA invalide recu: %s", exc)
            return
        self._process_navigation_eta.execute(telemetry)

    def _handle_emergency_payload(self, payload: dict[str, Any]) -> None:
        try:
            emergency_request = EmergencyStopRequestDto(
                source=payload.get("source", "ros2"),
                reason=payload.get("reason", "Arret d'urgence declenche cote robot."),
                requires_admin_restart=payload.get("requires_admin_restart", True),
            ).to_domain()
        except Exception as exc:
            logger.warning("Payload d'urgence invalide recu: %s", exc)
            return
        self._trigger_emergency_stop.execute(emergency_request)
