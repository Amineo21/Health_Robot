from __future__ import annotations

from dataclasses import replace

from app.application.use_cases.user_management_errors import LastActiveAdminError, UserNotFoundError
from app.domain.entities.user import User, UserRole
from app.domain.repositories.user_repository import UserRepository


class DeactivateUserUseCase:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def execute(self, user_id: str) -> User:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError

        if user.role == UserRole.admin and user.is_active:
            active_admins = [stored_user for stored_user in self._user_repository.list() if stored_user.role == UserRole.admin and stored_user.is_active]
            if len(active_admins) <= 1:
                raise LastActiveAdminError

        return self._user_repository.update(replace(user, is_active=False))
