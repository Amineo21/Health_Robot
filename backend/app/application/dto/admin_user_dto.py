from __future__ import annotations

from datetime import datetime
from typing import Self

from pydantic import BaseModel, Field

from app.domain.entities.user import User, UserRole


class CreateUserRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")
    name: str = Field(min_length=1, max_length=120)
    role: UserRole = UserRole.caregiver
    password: str = Field(min_length=3, max_length=128)


class UpdateUserRequest(BaseModel):
    email: str | None = Field(default=None, min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: UserRole | None = None
    is_active: bool | None = None


class ResetUserPasswordRequest(BaseModel):
    password: str = Field(min_length=3, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_domain(cls, user: User) -> Self:
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
