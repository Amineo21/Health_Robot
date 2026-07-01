from __future__ import annotations

import math
from dataclasses import replace
from uuid import uuid4

from app.domain.entities.mission import (
    CANCELLABLE_MISSION_STATUSES,
    NAVIGATING_MISSION_STATUSES,
    AnnotatedPointType,
    Mission,
    MissionStatus,
    SupplyType,
    utc_now,
)
from app.domain.entities.mqtt_topics import (
    ROBOT_CMD_VEL_TOPIC,
    ROBOT_MISSION_RECOVERY_REQUEST_TOPIC,
    ROBOT_NAV_CANCEL_TOPIC,
)
from app.domain.entities.robot import RobotMode, RobotPose
from app.domain.entities.robot_command import RobotCommand, RobotCommandType
from app.domain.entities.user import User, UserRole
from app.domain.repositories.annotated_point_repository import AnnotatedPointRepository
from app.domain.repositories.message_publisher import MessagePublisher
from app.domain.repositories.mission_repository import MissionRepository
from app.domain.repositories.robot_command_publisher import RobotCommandPublisher
from app.domain.repositories.robot_state_repository import RobotStateRepository
from app.domain.repositories.settings_repository import SettingsRepository


class MissionError(Exception):
    pass


class MissionNotFoundError(MissionError):
    pass


class MissionValidationError(MissionError):
    pass


class MissionTransitionError(MissionError):
    pass


class MissionOrchestrator:
    def __init__(
        self,
        annotated_points: AnnotatedPointRepository,
        missions: MissionRepository,
        command_publisher: RobotCommandPublisher,
        message_publisher: MessagePublisher,
        state_repository: RobotStateRepository,
        settings_repository: SettingsRepository,
        arrival_radius_m: float,
    ) -> None:
        self._annotated_points = annotated_points
        self._missions = missions
        self._command_publisher = command_publisher
        self._message_publisher = message_publisher
        self._state_repository = state_repository
        self._settings_repository = settings_repository
        self._arrival_radius_m = arrival_radius_m

    def create_mission(self, supply_type: SupplyType, delivery_room_id: str, actor: User) -> Mission:
        delivery_room = self._annotated_points.get_point(delivery_room_id)
        if (
            delivery_room is None
            or delivery_room.type != AnnotatedPointType.delivery_room
            or not delivery_room.is_active
        ):
            raise MissionValidationError("Delivery room must be an active annotated delivery point")

        stock_point = self._annotated_points.get_active_stock_for_supply(supply_type)
        if stock_point is None:
            raise MissionValidationError(f"No active stock can provide {supply_type.value}")

        now = utc_now()
        mission = Mission(
            id=f"mis-{uuid4()}",
            status=MissionStatus.pending,
            supply_type=supply_type,
            delivery_room_id=delivery_room.id,
            delivery_room_name_snapshot=delivery_room.name,
            delivery_x_snapshot=delivery_room.x,
            delivery_y_snapshot=delivery_room.y,
            delivery_yaw_snapshot=delivery_room.yaw,
            stock_point_id=stock_point.id,
            stock_point_name_snapshot=stock_point.name,
            stock_x_snapshot=stock_point.x,
            stock_y_snapshot=stock_point.y,
            stock_yaw_snapshot=stock_point.yaw,
            created_by_user_id=actor.id,
            created_by_name_snapshot=actor.name,
            created_at=now,
            updated_at=now,
        )
        saved = self._missions.create_mission(mission)
        self.try_start_next_mission()
        return self._missions.get_mission(saved.id) or saved

    def try_start_next_mission(self) -> Mission | None:
        status = self._state_repository.get_status()
        if status.emergency_active:
            return None
        if self._missions.get_active_mission() is not None:
            return None

        mission = self._missions.get_oldest_pending_mission()
        if mission is None:
            return None

        started = replace(
            mission,
            status=MissionStatus.navigating_to_stock,
            started_at=mission.started_at or utc_now(),
        )
        saved = self._missions.update_mission(started)
        self._publish_navigation(saved, target="stock")
        self._state_repository.set_mode(RobotMode.navigating, mission_id=saved.id)
        return saved

    def handle_robot_pose_updated(self, pose: RobotPose) -> Mission | None:
        mission = self._missions.get_active_mission()
        if mission is None:
            return None
        if mission.status == MissionStatus.navigating_to_stock:
            if self._distance(pose.x, pose.y, mission.stock_x_snapshot, mission.stock_y_snapshot) <= self._arrival_radius_m:
                arrived = self._missions.update_mission(
                    replace(
                        mission,
                        status=MissionStatus.waiting_for_recovery_confirmation,
                        arrived_at_stock_at=utc_now(),
                    )
                )
                self._state_repository.set_mode(RobotMode.idle, mission_id=arrived.id)
                self._request_robot_recovery(arrived)
                return arrived
        elif mission.status == MissionStatus.navigating_to_delivery:
            if self._distance(pose.x, pose.y, mission.delivery_x_snapshot, mission.delivery_y_snapshot) <= self._arrival_radius_m:
                arrived = self._missions.update_mission(
                    replace(
                        mission,
                        status=MissionStatus.waiting_for_delivery_confirmation,
                        arrived_at_delivery_at=utc_now(),
                    )
                )
                self._state_repository.set_mode(RobotMode.idle, mission_id=arrived.id)
                return arrived
        return None

    def confirm_recovery(self, mission_id: str, actor: User) -> Mission:
        mission = self._get_mission_or_raise(mission_id)
        if mission.status != MissionStatus.waiting_for_recovery_confirmation:
            raise MissionTransitionError("Mission is not waiting for recovery confirmation")
        return self._apply_recovery_confirmation(mission, confirmed_by_user_id=actor.id)

    def confirm_recovery_autonomous(self, mission_id: str) -> Mission | None:
        """Recuperation confirmee par le robot lui-meme (scan + bras au point de stock).

        Appele depuis la reception MQTT de robot/mission/recovery_done. Tolerant :
        si la mission n'existe plus ou n'attend pas de recuperation, on ignore
        silencieusement (message en retard, mission annulee entre-temps...).
        """
        mission = self._missions.get_mission(mission_id)
        if mission is None or mission.status != MissionStatus.waiting_for_recovery_confirmation:
            return None
        return self._apply_recovery_confirmation(mission, confirmed_by_user_id=None)

    def _apply_recovery_confirmation(self, mission: Mission, confirmed_by_user_id: str | None) -> Mission:
        confirmed = self._missions.update_mission(
            replace(
                mission,
                status=MissionStatus.navigating_to_delivery,
                recovery_confirmed_at=utc_now(),
                recovery_confirmed_by_user_id=confirmed_by_user_id,
            )
        )
        self._publish_navigation(confirmed, target="delivery")
        self._state_repository.set_mode(RobotMode.navigating, mission_id=confirmed.id)
        return confirmed

    def confirm_delivery(self, mission_id: str, actor: User) -> Mission:
        mission = self._get_mission_or_raise(mission_id)
        if mission.status != MissionStatus.waiting_for_delivery_confirmation:
            raise MissionTransitionError("Mission is not waiting for delivery confirmation")

        completed = self._missions.update_mission(
            replace(
                mission,
                status=MissionStatus.completed,
                delivery_confirmed_at=utc_now(),
                delivery_confirmed_by_user_id=actor.id,
                completed_at=utc_now(),
            )
        )
        self._state_repository.set_mode(RobotMode.idle, mission_id=None)
        self.try_start_next_mission()
        return completed

    def cancel_mission(self, mission_id: str, actor: User) -> Mission:
        mission = self._get_mission_or_raise(mission_id)
        if mission.status not in CANCELLABLE_MISSION_STATUSES:
            raise MissionTransitionError("Mission cannot be cancelled in its current state")

        if mission.status in NAVIGATING_MISSION_STATUSES:
            self._cancel_robot_navigation(mission.id)

        cancelled = self._missions.update_mission(
            replace(
                mission,
                status=MissionStatus.cancelled,
                cancelled_at=utc_now(),
                cancelled_by_user_id=actor.id,
            )
        )
        active = self._missions.get_active_mission()
        if active is None:
            self._state_repository.set_mode(RobotMode.idle, mission_id=None)
            self.try_start_next_mission()
        return cancelled

    def fail_active_mission(self, reason: str) -> Mission | None:
        mission = self._missions.get_active_mission()
        if mission is None or mission.status not in NAVIGATING_MISSION_STATUSES:
            return None
        self._cancel_robot_navigation(mission.id)
        failed = self._missions.update_mission(
            replace(
                mission,
                status=MissionStatus.failed,
                failure_reason=reason,
            )
        )
        self._state_repository.set_mode(RobotMode.emergency_stop, mission_id=None)
        return failed

    def _get_mission_or_raise(self, mission_id: str) -> Mission:
        mission = self._missions.get_mission(mission_id)
        if mission is None:
            raise MissionNotFoundError("Mission not found")
        return mission

    def _publish_navigation(self, mission: Mission, target: str) -> None:
        settings = self._settings_repository.get_settings()
        if target == "stock":
            x = mission.stock_x_snapshot
            y = mission.stock_y_snapshot
            yaw = mission.stock_yaw_snapshot
            label = mission.stock_point_name_snapshot
        else:
            x = mission.delivery_x_snapshot
            y = mission.delivery_y_snapshot
            yaw = mission.delivery_yaw_snapshot
            label = mission.delivery_room_name_snapshot

        command = RobotCommand(
            command_id=f"cmd-{uuid4()}",
            type=RobotCommandType.navigate,
            requested_by="mission-orchestrator",
            requested_by_role=UserRole.admin,
            payload={
                "x": x,
                "y": y,
                "yaw": yaw,
                "label": label,
                "mission_id": mission.id,
                "mission_target": target,
                "max_speed_mps": settings.max_speed_mps,
            },
            timestamp=utc_now(),
        )
        self._command_publisher.publish(command)

    def _cancel_robot_navigation(self, mission_id: str) -> None:
        self._message_publisher.publish_json(ROBOT_NAV_CANCEL_TOPIC, {"mission_id": mission_id, "reason": "mission_cancelled"}, qos=1)
        self._message_publisher.publish_json(ROBOT_CMD_VEL_TOPIC, {"linear_x": 0, "angular_z": 0, "mission_id": mission_id}, qos=1)

    def _request_robot_recovery(self, mission: Mission) -> None:
        """Demande au robot d'executer la recuperation autonome au point de stock.

        Le robot scanne la fourniture, la saisit avec le bras, puis repond sur
        robot/mission/recovery_done -> confirm_recovery_autonomous().
        """
        self._message_publisher.publish_json(
            ROBOT_MISSION_RECOVERY_REQUEST_TOPIC,
            {
                "mission_id": mission.id,
                "supply_type": mission.supply_type.value,
                "stock_point": mission.stock_point_name_snapshot,
            },
            qos=1,
        )

    @staticmethod
    def _distance(x1: float, y1: float, x2: float, y2: float) -> float:
        return math.hypot(x1 - x2, y1 - y2)
