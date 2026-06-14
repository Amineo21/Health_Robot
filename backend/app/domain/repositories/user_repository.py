from __future__ import annotations

from typing import Protocol

from app.domain.entities.user import User


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> User | None: ...

    def get_by_id(self, user_id: str) -> User | None: ...
