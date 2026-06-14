from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt

from app.domain.entities.user import User


class JwtTokenService:
    def __init__(self, secret_key: str, algorithm: str, expires_in_seconds: int) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._expires_in_seconds = expires_in_seconds

    def create_access_token(self, user: User) -> str:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self._expires_in_seconds)
        payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
            "exp": expires_at,
        }
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)

    def decode_access_token(self, token: str) -> dict[str, Any]:
        return jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
