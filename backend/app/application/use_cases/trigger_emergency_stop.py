from __future__ import annotations

from app.domain.entities.mqtt_topics import ROBOT_COMMAND_TOPIC, ROBOT_EMERGENCY_TOPIC, ROBOT_UI_ALERTS_TOPIC
from app.domain.entities.robot import EmergencyEvent, EmergencyStopRequest, Severity
from app.domain.repositories.message_publisher import MessagePublisher
from app.domain.repositories.robot_state_repository import RobotStateRepository


class TriggerEmergencyStopUseCase:
    def __init__(self, state_repository: RobotStateRepository, message_publisher: MessagePublisher) -> None:
        self._state_repository = state_repository
        self._message_publisher = message_publisher

    def execute(self, request: EmergencyStopRequest) -> EmergencyEvent:
        event = EmergencyEvent(
            source=request.source,
            reason=request.reason,
            requires_admin_restart=request.requires_admin_restart,
        )
        self._state_repository.trigger_emergency(event)
        self._message_publisher.publish_json(
            ROBOT_COMMAND_TOPIC,
            {
                "action": "emergency_stop",
                "reason": request.reason,
                "source": request.source.value,
                "motor_cutoff_ms": event.motor_cutoff_ms,
            },
        )
        self._message_publisher.publish_json(
            ROBOT_EMERGENCY_TOPIC,
            {
                "timestamp": event.timestamp.isoformat(),
                "active": event.active,
                "source": event.source.value,
                "reason": event.reason,
                "motor_cutoff_ms": event.motor_cutoff_ms,
                "requires_admin_restart": event.requires_admin_restart,
                "ui_state": event.ui_state,
                "restart_procedure": event.restart_procedure,
            },
            qos=1,
            retain=True,
        )
        self._message_publisher.publish_json(
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
