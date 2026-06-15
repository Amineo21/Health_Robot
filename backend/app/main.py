from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.models.events import BatteryTelemetry, EmergencyStopRequest, NavigationEtaTelemetry
from app.mqtt.client import MQTTService
from app.mqtt.topics import (
    ROBOT_BATTERY_TOPIC,
    ROBOT_EMERGENCY_TOPIC,
    ROBOT_NAV2_FEEDBACK_TOPIC,
    ROBOT_NAV2_PATH_TOPIC,
    ROBOT_NAV_PATH_DISPLAY_TOPIC,
    ROBOT_STATUS_TOPIC,
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
    robot_pose: dict[str, float] = {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}
    nav_path: list[dict[str, float]] = []

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

        if topic == "robot/pose":
            robot_pose.update(payload)
            return

        if topic == ROBOT_NAV_PATH_DISPLAY_TOPIC:
            nonlocal nav_path
            nav_path = payload.get("poses", [])
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

    ws_clients: list[WebSocket] = []

    async def broadcast_status() -> None:
        while True:
            await asyncio.sleep(2)
            if not ws_clients:
                continue
            status = robot_state.get_status().model_dump(mode="json")
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
        app.state.robot_state = robot_state
        app.state.mqtt_service = mqtt_service
        app.state.navigation_eta_service = navigation_eta_service
        app.state.safety_service = safety_service
        app.state.ws_clients = ws_clients
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
    app.include_router(navigation_router)
    app.include_router(robot_router)
    app.include_router(safety_router)

    @app.get("/")
    async def read_root() -> dict[str, str]:
        return {"status": "ok", "message": "API backend du robot operationnelle"}

    @app.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "healthy", "message": "Service en bonne sante"}

    @app.get("/api/map/image")
    async def get_map_image():
        from fastapi import HTTPException
        from fastapi.responses import Response
        from PIL import Image as PilImage
        import io
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
