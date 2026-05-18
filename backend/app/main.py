from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from app.models.events import BatteryTelemetry, EmergencyStopRequest, NavigationEtaTelemetry
from app.mqtt.client import MQTTService
from app.mqtt.topics import (
    ROBOT_BATTERY_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_NAV2_FEEDBACK_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
)
from app.routes.navigation import router as navigation_router
from app.routes.robot import router as robot_router
from app.routes.safety import router as safety_router
from app.services.navigation_eta_service import NavigationEtaService
from app.services.safety_service import SafetyService
from app.state.robot_state import RobotStateStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    robot_state = RobotStateStore()
    navigation_eta_service = NavigationEtaService(state_store=robot_state)

    def handle_mqtt_message(topic: str, payload: dict[str, Any]) -> None:
        if topic == ROBOT_BATTERY_TOPIC:
            try:
                telemetry = BatteryTelemetry.model_validate(payload)
            except Exception as exc:  
                logger.warning("Payload batterie invalide recu: %s", exc)
                return
            app.state.safety_service.process_battery_telemetry(telemetry)
            return

        if topic in {ROBOT_NAV2_PATH_TOPIC, ROBOT_NAV2_FEEDBACK_TOPIC}:
            try:
                default_source = "NAV2_PATH" if topic == ROBOT_NAV2_PATH_TOPIC else "NAV2_FEEDBACK"
                telemetry = NavigationEtaTelemetry.model_validate(
                    {
                        **payload,
                        "eta_source": payload.get("eta_source", default_source),
                    }
                )
            except Exception as exc:
                logger.warning("Payload navigation ETA invalide recu: %s", exc)
                return
            app.state.navigation_eta_service.process_nav2_telemetry(telemetry)
            return

        if topic == ROBOT_EMERGENCY_TOPIC and payload.get("active"):
            try:
                emergency_request = EmergencyStopRequest(
                    source=payload.get("source", "ros2"),
                    reason=payload.get("reason", "Arret d'urgence declenche cote robot."),
                    requires_admin_restart=payload.get("requires_admin_restart", True),
                )
            except Exception as exc:  
                logger.warning("Payload d'urgence invalide recu: %s", exc)
                return
            app.state.safety_service.trigger_emergency_stop(emergency_request)

    mqtt_service = MQTTService(on_message=handle_mqtt_message)
    safety_service = SafetyService(
        state_store=robot_state,
        mqtt_service=mqtt_service,
        navigation_eta_service=navigation_eta_service,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        app.state.robot_state = robot_state
        app.state.mqtt_service = mqtt_service
        app.state.navigation_eta_service = navigation_eta_service
        app.state.safety_service = safety_service
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
    app.include_router(navigation_router)
    app.include_router(robot_router)
    app.include_router(safety_router)

    @app.get("/")
    async def read_root() -> dict[str, str]:
        return {"status": "ok", "message": "API backend du robot operationnelle"}

    @app.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "healthy", "message": "Service en bonne sante"}

    return app


app = create_app()
