from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    admin = "admin"
    caregiver = "caregiver"


@dataclass(frozen=True)
class User:
    id: str
    email: str
    name: str
    role: UserRole
    password_hash: str
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None
