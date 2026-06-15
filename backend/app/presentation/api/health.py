from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get(
    "/",
    summary="Backend root status",
    description="Returns a lightweight status payload confirming that the backend API is reachable.",
    response_description="Backend operational status.",
)
def read_root() -> dict[str, str]:
    return {"status": "ok", "message": "API backend du robot operationnelle"}


@router.get(
    "/health",
    summary="Health check",
    description="Used by humans, scripts, or orchestrators to verify that the backend process is healthy.",
    response_description="Service health status.",
)
def healthcheck() -> dict[str, str]:
    return {"status": "healthy", "message": "Service en bonne sante"}
