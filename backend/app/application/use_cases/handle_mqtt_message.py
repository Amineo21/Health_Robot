from __future__ import annotations

import logging
from typing import Any

from app.application.dto.robot_dto import (
    BatteryTelemetry as BatteryTelemetryDto,
    EmergencyStopRequest as EmergencyStopRequestDto,
    NavigationEtaTelemetry as NavigationEtaTelemetryDto,
    RobotMapMetadata as RobotMapMetadataDto,
    RobotRuntimeTelemetry as RobotRuntimeTelemetryDto,
)
from app.application.use_cases.mission_orchestrator import MissionOrchestrator
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_emergency_telemetry import ProcessEmergencyTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.process_robot_status_telemetry import ProcessRobotStatusTelemetryUseCase
from app.domain.entities.mqtt_topics import (
    ROBOT_BATTERY_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_MISSION_RECOVERY_DONE_TOPIC,
    ROBOT_NAV2_FEEDBACK_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
    ROBOT_POSE_TOPIC,
    ROBOT_STATUS_TOPIC,
)

logger = logging.getLogger(__name__)


class HandleMqttMessageUseCase:
    def __init__(
        self,
        process_battery_telemetry: ProcessBatteryTelemetryUseCase,
        process_emergency_telemetry: ProcessEmergencyTelemetryUseCase,
        process_navigation_eta: ProcessNavigationEtaUseCase,
        process_robot_status_telemetry: ProcessRobotStatusTelemetryUseCase,
        mission_orchestrator: MissionOrchestrator | None = None,
    ) -> None:
        self._process_battery_telemetry = process_battery_telemetry
        self._process_emergency_telemetry = process_emergency_telemetry
        self._process_navigation_eta = process_navigation_eta
        self._process_robot_status_telemetry = process_robot_status_telemetry
        self._mission_orchestrator = mission_orchestrator

    def execute(self, topic: str, payload: dict[str, Any]) -> None:
        if topic == ROBOT_BATTERY_TOPIC:
            self._handle_battery_payload(payload)
            return

        if topic in {ROBOT_NAV2_PATH_TOPIC, ROBOT_NAV2_FEEDBACK_TOPIC}:
            self._handle_navigation_payload(topic, payload)
            return

        if topic == ROBOT_STATUS_TOPIC:
            self._handle_robot_status_payload(payload)
            return

        if topic == ROBOT_POSE_TOPIC:
            self._handle_robot_status_payload(payload if "pose" in payload else {"pose": payload})
            return

        if topic == ROBOT_EMERGENCY_TOPIC:
            self._handle_emergency_payload(payload)
            return

        if topic == ROBOT_MISSION_RECOVERY_DONE_TOPIC:
            self._handle_recovery_done_payload(payload)
            return

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

    def _handle_robot_status_payload(self, payload: dict[str, Any]) -> None:
        try:
            if payload.get("type") == "map":
                map_metadata = RobotMapMetadataDto.model_validate(payload)
                telemetry = RobotRuntimeTelemetryDto(map=map_metadata).to_domain()
            else:
                telemetry = RobotRuntimeTelemetryDto.model_validate(payload).to_domain()
        except Exception as exc:
            logger.warning("Payload statut robot invalide recu: %s", exc)
            return
        self._process_robot_status_telemetry.execute(telemetry)

    def _handle_emergency_payload(self, payload: dict[str, Any]) -> None:
        if payload.get("active") is False:
            self._process_emergency_telemetry.clear()
            return

        if not payload.get("active"):
            return

        try:
            emergency_request = EmergencyStopRequestDto(
                source=payload.get("source", "ros2"),
                reason=payload.get("reason", "Arret d'urgence declenche cote robot."),
                requires_admin_restart=payload.get("requires_admin_restart", True),
            ).to_domain()
        except Exception as exc:
            logger.warning("Payload d'urgence invalide recu: %s", exc)
            return
        self._process_emergency_telemetry.execute(emergency_request)

    def _handle_recovery_done_payload(self, payload: dict[str, Any]) -> None:
        if self._mission_orchestrator is None:
            return
        mission_id = payload.get("mission_id")
        if not mission_id:
            logger.warning("Payload recovery_done sans mission_id: %s", payload)
            return
        confirmed = self._mission_orchestrator.confirm_recovery_autonomous(str(mission_id))
        if confirmed is None:
            logger.info("recovery_done ignore (mission %s non en attente de recuperation)", mission_id)
