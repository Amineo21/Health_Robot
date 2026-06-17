from __future__ import annotations

from fastapi import APIRouter

from app.presentation.api.v1.endpoints import admin_settings, admin_users, auth, navigation, robot, robot_commands, robot_maps, safety

api_router = APIRouter(prefix="/api")
api_router.include_router(admin_settings.router)
api_router.include_router(admin_users.router)
api_router.include_router(auth.router)
api_router.include_router(navigation.router)
api_router.include_router(robot.router)
api_router.include_router(robot_commands.router)
api_router.include_router(robot_maps.router)
api_router.include_router(safety.router)
