from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import io
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from app.application.use_cases.authenticate_user import AuthenticateUserUseCase
from app.application.use_cases.clear_emergency import ClearEmergencyUseCase
from app.application.use_cases.container import ApplicationUseCases
from app.application.use_cases.create_user import CreateUserUseCase
from app.application.use_cases.deactivate_user import DeactivateUserUseCase
from app.application.use_cases.get_authenticated_user import GetAuthenticatedUserUseCase
from app.application.use_cases.get_robot_status import GetRobotStatusUseCase
from app.application.use_cases.get_settings import GetSettingsUseCase
from app.application.use_cases.handle_mqtt_message import HandleMqttMessageUseCase
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
from app.core.config import settings
from app.domain.entities.settings import RobotSettings
from app.domain.repositories.settings_repository import SettingsRepository
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.session import SessionLocal, engine as database_engine
from app.infrastructure.mqtt.client import MQTTService
from app.infrastructure.mqtt.robot_command_publisher import MqttRobotCommandPublisher
from app.infrastructure.robot_maps.dashboard_client import RobotDashboardClient
from app.infrastructure.rosbridge.mqtt_rosbridge_bridge import MqttRosbridgeBridge
from app.infrastructure.repositories.in_memory_settings_repository import InMemorySettingsRepository
from app.infrastructure.repositories.in_memory_user_repository import InMemoryUserRepository
from app.infrastructure.repositories.in_memory_robot_state_repository import InMemoryRobotStateRepository
from app.infrastructure.repositories.in_memory_mission_repository import InMemoryMissionRepository
from app.infrastructure.repositories.sqlalchemy_mission_repository import SqlAlchemyMissionRepository
from app.infrastructure.repositories.sqlalchemy_settings_repository import SqlAlchemySettingsRepository
from app.infrastructure.repositories.sqlalchemy_user_repository import SqlAlchemyUserRepository
from app.infrastructure.security.jwt_token_service import JwtTokenService
from app.infrastructure.security.password_hasher import PasswordHasher
from app.presentation.api.health import router as health_router
from app.presentation.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)

OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Service availability and basic backend status checks.",
    },
    {
        "name": "auth",
        "description": "Human authentication with JWT for admin and caregiver users.",
    },
    {
        "name": "admin users",
        "description": "Admin-only account management for caregivers and other human users.",
    },
    {
        "name": "admin settings",
        "description": "Admin-only robot behavior and safety settings.",
    },
    {
        "name": "robot",
        "description": "Authenticated human access to the current robot state.",
    },
    {
        "name": "robot commands",
        "description": "Authenticated robot commands published to MQTT for the robot rosbridge adapter.",
    },
    {
        "name": "annotated points",
        "description": "Admin-managed reusable map points for stock, delivery rooms, and robot base.",
    },
    {
        "name": "missions",
        "description": "CareBot delivery mission creation, queueing, confirmations, and cancellation.",
    },
    {
        "name": "robot screen",
        "description": "Read-only robot onboard screen status protected by a dedicated token.",
    },
    {
        "name": "navigation",
        "description": "Navigation ETA telemetry and authenticated ETA/status reads.",
    },
    {
        "name": "securite",
        "description": "Battery safety, emergency stop, and admin-only emergency reset.",
    },
]


def create_user_repository(password_hasher: PasswordHasher) -> UserRepository:
    if settings.user_repository_backend == "memory":
        return InMemoryUserRepository(
            password_hasher=password_hasher,
            initial_admin_email=settings.initial_admin_email,
            initial_admin_password=settings.initial_admin_password,
            initial_admin_name=settings.initial_admin_name,
        )

    if settings.user_repository_backend == "database":
        return SqlAlchemyUserRepository(
            session_factory=SessionLocal,
            password_hasher=password_hasher,
            initial_admin_email=settings.initial_admin_email,
            initial_admin_password=settings.initial_admin_password,
            initial_admin_name=settings.initial_admin_name,
        )

    raise ValueError("USER_REPOSITORY_BACKEND must be 'memory' or 'database'")


def create_default_robot_settings() -> RobotSettings:
    return RobotSettings(
        max_speed_mps=settings.max_speed_mps,
        meal_speed_mps=settings.meal_speed_mps,
        low_battery_threshold=settings.low_battery_threshold,
        auto_return_enabled=settings.auto_return_enabled,
        teleop_enabled=settings.teleop_enabled,
        emergency_requires_admin_reset=settings.emergency_requires_admin_reset,
    )


def create_settings_repository(default_settings: RobotSettings) -> SettingsRepository:
    if settings.settings_repository_backend == "memory":
        return InMemorySettingsRepository(default_settings)

    if settings.settings_repository_backend == "database":
        return SqlAlchemySettingsRepository(session_factory=SessionLocal, default_settings=default_settings)

    raise ValueError("SETTINGS_REPOSITORY_BACKEND must be 'memory' or 'database'")


def create_mission_repository():
    if settings.mission_repository_backend == "memory":
        return InMemoryMissionRepository()

    if settings.mission_repository_backend == "database":
        return SqlAlchemyMissionRepository(session_factory=SessionLocal)

    raise ValueError("MISSION_REPOSITORY_BACKEND must be 'memory' or 'database'")


def create_app() -> FastAPI:
    robot_state_repository = InMemoryRobotStateRepository()
    password_hasher = PasswordHasher()
    token_expires_in_seconds = settings.access_token_expire_minutes * 60
    token_service = JwtTokenService(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        expires_in_seconds=token_expires_in_seconds,
    )
    user_repository = create_user_repository(password_hasher)
    settings_repository = create_settings_repository(create_default_robot_settings())
    mission_repository = create_mission_repository()
    mqtt_service = MQTTService(settings=settings)
    robot_rosbridge_bridge = MqttRosbridgeBridge(settings=settings)
    robot_dashboard_client = RobotDashboardClient(settings.robot_dashboard_url)
    robot_command_publisher = MqttRobotCommandPublisher(mqtt_service)
    process_navigation_eta = ProcessNavigationEtaUseCase(
        state_repository=robot_state_repository,
        base_eta_distance_m=settings.base_eta_distance_m,
        nominal_return_speed_mps=settings.nominal_return_speed_mps,
    )
    process_battery_telemetry = ProcessBatteryTelemetryUseCase(
        state_repository=robot_state_repository,
        message_publisher=mqtt_service,
        navigation_eta_use_case=process_navigation_eta,
        low_battery_threshold=settings.low_battery_threshold,
        auto_return_enabled=settings.auto_return_enabled,
    )
    mission_orchestrator = MissionOrchestrator(
        annotated_points=mission_repository,
        missions=mission_repository,
        command_publisher=robot_command_publisher,
        message_publisher=mqtt_service,
        state_repository=robot_state_repository,
        settings_repository=settings_repository,
        arrival_radius_m=settings.mission_arrival_radius_m,
    )
    process_emergency_telemetry = ProcessEmergencyTelemetryUseCase(robot_state_repository, mission_orchestrator)
    process_robot_status_telemetry = ProcessRobotStatusTelemetryUseCase(robot_state_repository, mission_orchestrator)
    trigger_emergency_stop = TriggerEmergencyStopUseCase(
        state_repository=robot_state_repository,
        message_publisher=mqtt_service,
        mission_orchestrator=mission_orchestrator,
    )
    clear_emergency = ClearEmergencyUseCase(
        state_repository=robot_state_repository,
        message_publisher=mqtt_service,
        mission_orchestrator=mission_orchestrator,
    )
    use_cases = ApplicationUseCases(
        get_robot_status=GetRobotStatusUseCase(robot_state_repository),
        process_battery_telemetry=process_battery_telemetry,
        process_emergency_telemetry=process_emergency_telemetry,
        process_navigation_eta=process_navigation_eta,
        process_robot_status_telemetry=process_robot_status_telemetry,
        trigger_emergency_stop=trigger_emergency_stop,
        clear_emergency=clear_emergency,
        authenticate_user=AuthenticateUserUseCase(
            user_repository=user_repository,
            password_hasher=password_hasher,
            token_service=token_service,
            expires_in_seconds=token_expires_in_seconds,
        ),
        get_authenticated_user=GetAuthenticatedUserUseCase(user_repository),
        create_user=CreateUserUseCase(user_repository=user_repository, password_hasher=password_hasher),
        list_users=ListUsersUseCase(user_repository),
        update_user=UpdateUserUseCase(user_repository),
        deactivate_user=DeactivateUserUseCase(user_repository),
        reset_user_password=ResetUserPasswordUseCase(user_repository=user_repository, password_hasher=password_hasher),
        get_settings=GetSettingsUseCase(settings_repository),
        update_settings=UpdateSettingsUseCase(settings_repository),
        send_robot_command=SendRobotCommandUseCase(
            command_publisher=robot_command_publisher,
            state_repository=robot_state_repository,
            settings_repository=settings_repository,
        ),
        annotated_points=mission_repository,
        missions=mission_repository,
        mission_orchestrator=mission_orchestrator,
    )
    handle_mqtt_message = HandleMqttMessageUseCase(
        process_battery_telemetry=process_battery_telemetry,
        process_emergency_telemetry=process_emergency_telemetry,
        process_navigation_eta=process_navigation_eta,
        process_robot_status_telemetry=process_robot_status_telemetry,
        mission_orchestrator=mission_orchestrator,
    )
    mqtt_service.set_message_handler(handle_mqtt_message.execute)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        app.state.robot_state_repository = robot_state_repository
        app.state.database_engine = database_engine
        app.state.mqtt_service = mqtt_service
        app.state.robot_rosbridge_bridge = robot_rosbridge_bridge
        app.state.robot_dashboard_client = robot_dashboard_client
        app.state.token_service = token_service
        app.state.use_cases = use_cases
        mqtt_service.start()
        robot_rosbridge_bridge.start()
        try:
            yield
        finally:
            robot_rosbridge_bridge.stop()
            mqtt_service.stop()

    app = FastAPI(
        title="Backend Health Robot",
        description=(
            "Backend API for the Health Robot system. Human users authenticate with JWT. "
            "Robot-only telemetry ingestion endpoints remain public in development for the MVP."
        ),
        version="0.1.0",
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allow_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(api_router)

    return app


app = create_app()
