from __future__ import annotations

from dataclasses import dataclass

from app.application.use_cases.authenticate_user import AuthenticateUserUseCase
from app.application.use_cases.clear_emergency import ClearEmergencyUseCase
from app.application.use_cases.create_user import CreateUserUseCase
from app.application.use_cases.deactivate_user import DeactivateUserUseCase
from app.application.use_cases.get_authenticated_user import GetAuthenticatedUserUseCase
from app.application.use_cases.get_robot_status import GetRobotStatusUseCase
from app.application.use_cases.get_settings import GetSettingsUseCase
from app.application.use_cases.list_users import ListUsersUseCase
from app.application.use_cases.mission_orchestrator import MissionOrchestrator
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_emergency_telemetry import ProcessEmergencyTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.process_robot_status_telemetry import ProcessRobotStatusTelemetryUseCase
from app.application.use_cases.reset_user_password import ResetUserPasswordUseCase
from app.application.use_cases.send_robot_command import SendRobotCommandUseCase
from app.application.use_cases.trigger_emergency_stop import TriggerEmergencyStopUseCase
from app.application.use_cases.update_settings import UpdateSettingsUseCase
from app.application.use_cases.update_user import UpdateUserUseCase
from app.domain.repositories.annotated_point_repository import AnnotatedPointRepository
from app.domain.repositories.mission_repository import MissionRepository


@dataclass(frozen=True)
class ApplicationUseCases:
    get_robot_status: GetRobotStatusUseCase
    process_battery_telemetry: ProcessBatteryTelemetryUseCase
    process_emergency_telemetry: ProcessEmergencyTelemetryUseCase
    process_navigation_eta: ProcessNavigationEtaUseCase
    process_robot_status_telemetry: ProcessRobotStatusTelemetryUseCase
    trigger_emergency_stop: TriggerEmergencyStopUseCase
    clear_emergency: ClearEmergencyUseCase
    authenticate_user: AuthenticateUserUseCase
    get_authenticated_user: GetAuthenticatedUserUseCase
    create_user: CreateUserUseCase
    list_users: ListUsersUseCase
    update_user: UpdateUserUseCase
    deactivate_user: DeactivateUserUseCase
    reset_user_password: ResetUserPasswordUseCase
    get_settings: GetSettingsUseCase
    update_settings: UpdateSettingsUseCase
    send_robot_command: SendRobotCommandUseCase
    annotated_points: AnnotatedPointRepository
    missions: MissionRepository
    mission_orchestrator: MissionOrchestrator
