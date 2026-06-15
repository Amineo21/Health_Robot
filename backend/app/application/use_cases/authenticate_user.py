from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository

class InvalidCredentialsError(Exception):
    pass


class InactiveUserError(Exception):
    pass


class PasswordHasher(Protocol):
    def verify(self, plain_password: str, password_hash: str) -> bool: ...


class TokenService(Protocol):
    def create_access_token(self, user: User) -> str: ...


@dataclass(frozen=True)
class AuthResult:
    access_token: str
    expires_in: int
    user: User


class AuthenticateUserUseCase:
    def __init__(
        self,
        user_repository: UserRepository,
        password_hasher: PasswordHasher,
        token_service: TokenService,
        expires_in_seconds: int,
    ) -> None:
        self._user_repository = user_repository
        self._password_hasher = password_hasher
        self._token_service = token_service
        self._expires_in_seconds = expires_in_seconds

    def execute(self, email: str, password: str) -> AuthResult:
        user = self._user_repository.get_by_email(email.strip().lower())
        if user is None or not self._password_hasher.verify(password, user.password_hash):
            raise InvalidCredentialsError

        if not user.is_active:
            raise InactiveUserError

        return AuthResult(
            access_token=self._token_service.create_access_token(user),
            expires_in=self._expires_in_seconds,
            user=user,
        )
