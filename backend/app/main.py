from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.application.use_cases.clear_emergency import ClearEmergencyUseCase
from app.application.use_cases.container import ApplicationUseCases
from app.application.use_cases.get_robot_status import GetRobotStatusUseCase
from app.application.use_cases.handle_mqtt_message import HandleMqttMessageUseCase
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.trigger_emergency_stop import TriggerEmergencyStopUseCase
from app.core.config import settings
from app.infrastructure.mqtt.client import MQTTService
from app.infrastructure.repositories.in_memory_robot_state_repository import InMemoryRobotStateRepository
from app.presentation.api.health import router as health_router
from app.presentation.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    robot_state_repository = InMemoryRobotStateRepository()
    mqtt_service = MQTTService(settings=settings)
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
    trigger_emergency_stop = TriggerEmergencyStopUseCase(
        state_repository=robot_state_repository,
        message_publisher=mqtt_service,
    )
    clear_emergency = ClearEmergencyUseCase(
        state_repository=robot_state_repository,
        message_publisher=mqtt_service,
    )
    use_cases = ApplicationUseCases(
        get_robot_status=GetRobotStatusUseCase(robot_state_repository),
        process_battery_telemetry=process_battery_telemetry,
        process_navigation_eta=process_navigation_eta,
        trigger_emergency_stop=trigger_emergency_stop,
        clear_emergency=clear_emergency,
    )
    handle_mqtt_message = HandleMqttMessageUseCase(
        process_battery_telemetry=process_battery_telemetry,
        process_navigation_eta=process_navigation_eta,
        trigger_emergency_stop=trigger_emergency_stop,
    )
    mqtt_service.set_message_handler(handle_mqtt_message.execute)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        app.state.robot_state_repository = robot_state_repository
        app.state.mqtt_service = mqtt_service
        app.state.use_cases = use_cases
        mqtt_service.start()
        try:
            yield
        finally:
            mqtt_service.stop()

    app = FastAPI(
        title="Backend Health Robot",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(api_router)

    return app


app = create_app()
