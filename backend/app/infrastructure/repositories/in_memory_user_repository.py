from __future__ import annotations

from app.domain.entities.user import User, UserRole
from app.infrastructure.security.password_hasher import PasswordHasher


class InMemoryUserRepository:
    def __init__(
        self,
        password_hasher: PasswordHasher,
        admin_email: str,
        admin_password: str,
        caregiver_email: str,
        caregiver_password: str,
    ) -> None:
        admin = User(
            id="admin-1",
            email=admin_email.strip().lower(),
            name="Admin",
            role=UserRole.admin,
            password_hash=password_hasher.hash(admin_password),
        )
        caregiver = User(
            id="caregiver-1",
            email=caregiver_email.strip().lower(),
            name="Caregiver",
            role=UserRole.caregiver,
            password_hash=password_hasher.hash(caregiver_password),
        )
        self._users_by_id = {
            admin.id: admin,
            caregiver.id: caregiver,
        }
        self._users_by_email = {
            admin.email: admin,
            caregiver.email: caregiver,
        }

    def get_by_email(self, email: str) -> User | None:
        return self._users_by_email.get(email.strip().lower())

    def get_by_id(self, user_id: str) -> User | None:
        return self._users_by_id.get(user_id)
