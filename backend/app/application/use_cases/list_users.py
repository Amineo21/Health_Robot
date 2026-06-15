from __future__ import annotations

from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository


class ListUsersUseCase:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def execute(self) -> list[User]:
        return self._user_repository.list()
