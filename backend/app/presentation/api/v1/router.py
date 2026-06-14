from __future__ import annotations

from fastapi import APIRouter

from app.presentation.api.v1.endpoints import admin_users, auth, navigation, robot, safety

api_router = APIRouter(prefix="/api")
api_router.include_router(admin_users.router)
api_router.include_router(auth.router)
api_router.include_router(navigation.router)
api_router.include_router(robot.router)
api_router.include_router(safety.router)
