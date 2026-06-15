from __future__ import annotations

from typing import Self

from pydantic import BaseModel, Field

from app.domain.entities.user import User, UserRole


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")
    password: str


class AuthenticatedUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole

    @classmethod
    def from_domain(cls, user: User) -> Self:
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUserResponse
