from __future__ import annotations

from app.application.use_cases.mission_orchestrator import MissionOrchestrator
from app.domain.entities.mqtt_topics import ROBOT_ADMIN_TOPIC, ROBOT_EMERGENCY_TOPIC
from app.domain.repositories.message_publisher import MessagePublisher
from app.domain.repositories.robot_state_repository import RobotStateRepository


class ClearEmergencyUseCase:
    def __init__(
        self,
        state_repository: RobotStateRepository,
        message_publisher: MessagePublisher,
        mission_orchestrator: MissionOrchestrator | None = None,
    ) -> None:
        self._state_repository = state_repository
        self._message_publisher = message_publisher
        self._mission_orchestrator = mission_orchestrator

    def execute(self, actor: str) -> dict[str, str]:
        self._state_repository.clear_emergency()
        if self._mission_orchestrator is not None:
            self._mission_orchestrator.try_start_next_mission()
        self._message_publisher.publish_json(
            ROBOT_ADMIN_TOPIC,
            {
                "action": "admin_restart_procedure",
                "actor": actor,
                "step": "reset_emergency_latch",
                "message": "Procedure de redemarrage administrateur demandee.",
            },
            qos=1,
        )
        self._message_publisher.publish_json(
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
        return {
            "status": "cleared",
            "restart_procedure": "ADMIN_ONLY",
            "message": "Reinitialisation effectuee.",
        }
