from __future__ import annotations

from typing import Protocol
from uuid import uuid4

from app.application.use_cases.user_management_errors import UserAlreadyExistsError
from app.domain.entities.user import User, UserRole, utc_now
from app.domain.repositories.user_repository import UserRepository


class PasswordHasher(Protocol):
    def hash(self, plain_password: str) -> str: ...


class CreateUserUseCase:
    def __init__(self, user_repository: UserRepository, password_hasher: PasswordHasher) -> None:
        self._user_repository = user_repository
        self._password_hasher = password_hasher

    def execute(self, email: str, name: str, role: UserRole, password: str) -> User:
        normalized_email = email.strip().lower()
        if self._user_repository.email_exists(normalized_email):
            raise UserAlreadyExistsError

        now = utc_now()
        user = User(
            id=str(uuid4()),
            email=normalized_email,
            name=name.strip(),
            role=role,
            password_hash=self._password_hasher.hash(password),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        return self._user_repository.create(user)
