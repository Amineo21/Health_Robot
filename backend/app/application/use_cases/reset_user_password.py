from __future__ import annotations

from dataclasses import replace
from typing import Protocol

from app.application.use_cases.user_management_errors import UserNotFoundError
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository


class PasswordHasher(Protocol):
    def hash(self, plain_password: str) -> str: ...


class ResetUserPasswordUseCase:
    def __init__(self, user_repository: UserRepository, password_hasher: PasswordHasher) -> None:
        self._user_repository = user_repository
        self._password_hasher = password_hasher

    def execute(self, user_id: str, password: str) -> User:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError

        return self._user_repository.update(replace(user, password_hash=self._password_hasher.hash(password)))
