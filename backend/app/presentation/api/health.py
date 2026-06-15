from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok", "message": "API backend du robot operationnelle"}


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "healthy", "message": "Service en bonne sante"}
