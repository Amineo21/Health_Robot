from __future__ import annotations

from typing import Any

from app.domain.entities.mqtt_topics import (
    ROBOT_COMMAND_NAVIGATION_TOPIC,
    ROBOT_COMMAND_SAFETY_TOPIC,
    ROBOT_COMMAND_TELEOP_TOPIC,
    ROBOT_COMMAND_TOPIC,
)
from app.domain.entities.robot_command import RobotCommand, RobotCommandType
from app.domain.repositories.message_publisher import MessagePublisher


class MqttRobotCommandPublisher:
    def __init__(self, message_publisher: MessagePublisher) -> None:
        self._message_publisher = message_publisher

    def publish(self, command: RobotCommand) -> None:
        self._message_publisher.publish_json(
            self._topic_for(command.type),
            self._payload_for(command),
            qos=1,
        )

    @staticmethod
    def _topic_for(command_type: RobotCommandType) -> str:
        if command_type == RobotCommandType.navigate:
            return ROBOT_COMMAND_NAVIGATION_TOPIC
        if command_type == RobotCommandType.teleop:
            return ROBOT_COMMAND_TELEOP_TOPIC
        if command_type == RobotCommandType.emergency_stop:
            return ROBOT_COMMAND_SAFETY_TOPIC
        return ROBOT_COMMAND_TOPIC

    @staticmethod
    def _payload_for(command: RobotCommand) -> dict[str, Any]:
        return {
            "command_id": command.command_id,
            "type": command.type.value,
            "requested_by": command.requested_by,
            "requested_by_role": command.requested_by_role.value,
            "payload": command.payload,
            "timestamp": command.timestamp.isoformat(),
        }
