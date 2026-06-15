from __future__ import annotations

from app.application.use_cases.authenticate_user import InactiveUserError
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository


class AuthenticatedUserNotFoundError(Exception):
    pass


class GetAuthenticatedUserUseCase:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def execute(self, user_id: str) -> User:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise AuthenticatedUserNotFoundError
        if not user.is_active:
            raise InactiveUserError
        return user
