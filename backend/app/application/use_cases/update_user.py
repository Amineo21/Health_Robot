from __future__ import annotations

from dataclasses import replace

from app.application.use_cases.user_management_errors import (
    LastActiveAdminError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.domain.entities.user import User, UserRole
from app.domain.repositories.user_repository import UserRepository


class UpdateUserUseCase:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def execute(
        self,
        user_id: str,
        email: str | None = None,
        name: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
    ) -> User:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError

        normalized_email = email.strip().lower() if email is not None else user.email
        if self._user_repository.email_exists(normalized_email, exclude_user_id=user_id):
            raise UserAlreadyExistsError

        updated = replace(
            user,
            email=normalized_email,
            name=name.strip() if name is not None else user.name,
            role=role or user.role,
            is_active=user.is_active if is_active is None else is_active,
        )
        if self._removes_last_active_admin(user, updated):
            raise LastActiveAdminError

        return self._user_repository.update(updated)

    def _removes_last_active_admin(self, current: User, updated: User) -> bool:
        if current.role != UserRole.admin or not current.is_active:
            return False
        if updated.role == UserRole.admin and updated.is_active:
            return False
        active_admins = [user for user in self._user_repository.list() if user.role == UserRole.admin and user.is_active]
        return len(active_admins) <= 1
