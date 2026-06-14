from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.entities.user import User, UserRole
from app.infrastructure.database.models.user_model import UserModel
from app.infrastructure.security.password_hasher import PasswordHasher


class SqlAlchemyUserRepository:
    def __init__(
        self,
        session_factory: Callable[[], Session],
        password_hasher: PasswordHasher,
        admin_email: str,
        admin_password: str,
        caregiver_email: str,
        caregiver_password: str,
    ) -> None:
        self._session_factory = session_factory
        self._password_hasher = password_hasher
        self._seed_default_users(
            admin_email=admin_email,
            admin_password=admin_password,
            caregiver_email=caregiver_email,
            caregiver_password=caregiver_password,
        )

    def get_by_email(self, email: str) -> User | None:
        with self._session_factory() as session:
            model = session.scalars(select(UserModel).where(UserModel.email == email.strip().lower())).one_or_none()
            return self._to_domain(model) if model is not None else None

    def get_by_id(self, user_id: str) -> User | None:
        with self._session_factory() as session:
            model = session.get(UserModel, user_id)
            return self._to_domain(model) if model is not None else None

    def _seed_default_users(
        self,
        admin_email: str,
        admin_password: str,
        caregiver_email: str,
        caregiver_password: str,
    ) -> None:
        with self._session_factory() as session:
            self._ensure_user(
                session=session,
                user_id="admin-1",
                email=admin_email,
                name="Admin",
                role=UserRole.admin,
                password=admin_password,
            )
            self._ensure_user(
                session=session,
                user_id="caregiver-1",
                email=caregiver_email,
                name="Caregiver",
                role=UserRole.caregiver,
                password=caregiver_password,
            )
            session.commit()

    def _ensure_user(
        self,
        session: Session,
        user_id: str,
        email: str,
        name: str,
        role: UserRole,
        password: str,
    ) -> None:
        normalized_email = email.strip().lower()
        existing = session.get(UserModel, user_id)
        if existing is not None:
            existing.email = normalized_email
            existing.name = name
            existing.role = role.value
            return

        session.add(
            UserModel(
                id=user_id,
                email=normalized_email,
                name=name,
                role=role.value,
                password_hash=self._password_hasher.hash(password),
                is_active=True,
            )
        )

    @staticmethod
    def _to_domain(model: UserModel) -> User:
        return User(
            id=model.id,
            email=model.email,
            name=model.name,
            role=UserRole(model.role),
            password_hash=model.password_hash,
            is_active=model.is_active,
        )
