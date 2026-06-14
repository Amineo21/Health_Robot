from __future__ import annotations

from dataclasses import replace

from app.domain.entities.user import User, UserRole, utc_now
from app.infrastructure.security.password_hasher import PasswordHasher


class InMemoryUserRepository:
    def __init__(
        self,
        password_hasher: PasswordHasher,
        initial_admin_email: str,
        initial_admin_password: str,
        initial_admin_name: str,
    ) -> None:
        now = utc_now()
        admin = User(
            id="admin-1",
            email=initial_admin_email.strip().lower(),
            name=initial_admin_name,
            role=UserRole.admin,
            password_hash=password_hasher.hash(initial_admin_password),
            created_at=now,
            updated_at=now,
        )
        self._users_by_id = {admin.id: admin}
        self._users_by_email = {admin.email: admin}

    def get_by_email(self, email: str) -> User | None:
        return self._users_by_email.get(email.strip().lower())

    def get_by_id(self, user_id: str) -> User | None:
        return self._users_by_id.get(user_id)

    def list(self) -> list[User]:
        return sorted(self._users_by_id.values(), key=lambda user: user.created_at or utc_now())

    def create(self, user: User) -> User:
        now = utc_now()
        created = replace(
            user,
            email=user.email.strip().lower(),
            created_at=user.created_at or now,
            updated_at=user.updated_at or now,
        )
        self._users_by_id[created.id] = created
        self._users_by_email[created.email] = created
        return created

    def update(self, user: User) -> User:
        existing = self._users_by_id[user.id]
        updated = replace(user, email=user.email.strip().lower(), created_at=existing.created_at, updated_at=utc_now())
        if existing.email != updated.email:
            self._users_by_email.pop(existing.email, None)
        self._users_by_id[updated.id] = updated
        self._users_by_email[updated.email] = updated
        return updated

    def email_exists(self, email: str, exclude_user_id: str | None = None) -> bool:
        user = self.get_by_email(email)
        return user is not None and user.id != exclude_user_id

    def has_role(self, role: UserRole) -> bool:
        return any(user.role == role for user in self._users_by_id.values())
