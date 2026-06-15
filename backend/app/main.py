from __future__ import annotations

import asyncio
import io
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.application.dto.robot_dto import RobotStatus as RobotStatusDto
from app.application.use_cases.clear_emergency import ClearEmergencyUseCase
from app.application.use_cases.container import ApplicationUseCases
from app.application.use_cases.get_robot_status import GetRobotStatusUseCase
from app.application.use_cases.handle_mqtt_message import HandleMqttMessageUseCase
from app.application.use_cases.process_battery_telemetry import ProcessBatteryTelemetryUseCase
from app.application.use_cases.process_navigation_eta import ProcessNavigationEtaUseCase
from app.application.use_cases.trigger_emergency_stop import TriggerEmergencyStopUseCase
from app.core.config import settings
from app.domain.entities.mqtt_topics import ROBOT_NAV_PATH_DISPLAY_TOPIC, ROBOT_POSE_TOPIC
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

    # Etat temps reel pour l'affichage de la carte cote frontend.
    robot_pose: dict[str, float] = {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}
    nav_path: list[dict[str, float]] = []

    def on_mqtt_message(topic: str, payload: dict[str, Any]) -> None:
        if topic == ROBOT_POSE_TOPIC:
            robot_pose.update(payload)
            return
        if topic == ROBOT_NAV_PATH_DISPLAY_TOPIC:
            nonlocal nav_path
            nav_path = payload.get("poses", [])
            return
        handle_mqtt_message.execute(topic, payload)

    mqtt_service.set_message_handler(on_mqtt_message)

    ws_clients: list[WebSocket] = []

    async def broadcast_status() -> None:
        while True:
            await asyncio.sleep(2)
            if not ws_clients:
                continue
            domain_status = use_cases.get_robot_status.execute()
            status = RobotStatusDto.from_domain(domain_status).model_dump(mode="json")
            status["pose"] = dict(robot_pose)
            status["nav_path"] = list(nav_path)
            dead = []
            for ws in ws_clients:
                try:
                    await ws.send_text(json.dumps(status))
                except Exception:
                    dead.append(ws)
            for ws in dead:
                ws_clients.remove(ws)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        app.state.robot_state_repository = robot_state_repository
        app.state.mqtt_service = mqtt_service
        app.state.use_cases = use_cases
        mqtt_service.start()
        task = asyncio.create_task(broadcast_status())
        try:
            yield
        finally:
            task.cancel()
            mqtt_service.stop()

    app = FastAPI(
        title="Backend Health Robot",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(api_router)

    @app.get("/api/map/image")
    async def get_map_image():
        from PIL import Image as PilImage

        map_path = Path("/app/map/yahboom_map.pgm")
        if not map_path.exists():
            raise HTTPException(status_code=404, detail="Carte non disponible")
        img = PilImage.open(map_path).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

    @app.get("/api/map/metadata")
    async def get_map_metadata() -> dict:
        import yaml

        yaml_path = Path("/app/map/yahboom_map.yaml")
        if not yaml_path.exists():
            return {"resolution": 0.05, "origin": [0.0, 0.0, 0.0], "width": 0, "height": 0}
        with open(yaml_path) as f:
            data = yaml.safe_load(f)
        return data

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        ws_clients.append(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_clients.remove(websocket)

    return app


app = create_app()
