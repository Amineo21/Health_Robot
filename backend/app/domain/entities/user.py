from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


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
