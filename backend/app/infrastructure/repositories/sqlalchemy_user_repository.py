from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone

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
        initial_admin_email: str,
        initial_admin_password: str,
        initial_admin_name: str,
    ) -> None:
        self._session_factory = session_factory
        self._password_hasher = password_hasher
        self._seed_initial_admin(
            initial_admin_email=initial_admin_email,
            initial_admin_password=initial_admin_password,
            initial_admin_name=initial_admin_name,
        )

    def get_by_email(self, email: str) -> User | None:
        with self._session_factory() as session:
            model = session.scalars(select(UserModel).where(UserModel.email == email.strip().lower())).one_or_none()
            return self._to_domain(model) if model is not None else None

    def get_by_id(self, user_id: str) -> User | None:
        with self._session_factory() as session:
            model = session.get(UserModel, user_id)
            return self._to_domain(model) if model is not None else None

    def list(self) -> list[User]:
        with self._session_factory() as session:
            models = session.scalars(select(UserModel).order_by(UserModel.created_at, UserModel.email)).all()
            return [self._to_domain(model) for model in models]

    def create(self, user: User) -> User:
        with self._session_factory() as session:
            model = UserModel(
                id=user.id,
                email=user.email.strip().lower(),
                name=user.name,
                role=user.role.value,
                password_hash=user.password_hash,
                is_active=user.is_active,
                created_at=user.created_at or self._utc_now(),
                updated_at=user.updated_at or self._utc_now(),
            )
            session.add(model)
            session.commit()
            session.refresh(model)
            return self._to_domain(model)

    def update(self, user: User) -> User:
        with self._session_factory() as session:
            model = session.get(UserModel, user.id)
            if model is None:
                raise ValueError("Cannot update missing user")
            model.email = user.email.strip().lower()
            model.name = user.name
            model.role = user.role.value
            model.password_hash = user.password_hash
            model.is_active = user.is_active
            model.updated_at = self._utc_now()
            session.commit()
            session.refresh(model)
            return self._to_domain(model)

    def email_exists(self, email: str, exclude_user_id: str | None = None) -> bool:
        with self._session_factory() as session:
            query = select(UserModel).where(UserModel.email == email.strip().lower())
            if exclude_user_id is not None:
                query = query.where(UserModel.id != exclude_user_id)
            return session.scalars(query).first() is not None

    def has_role(self, role: UserRole) -> bool:
        with self._session_factory() as session:
            return session.scalars(select(UserModel).where(UserModel.role == role.value).limit(1)).first() is not None

    def _seed_initial_admin(
        self,
        initial_admin_email: str,
        initial_admin_password: str,
        initial_admin_name: str,
    ) -> None:
        with self._session_factory() as session:
            admin_exists = session.scalars(select(UserModel).where(UserModel.role == UserRole.admin.value).limit(1)).first()
            if admin_exists is not None:
                return

            self._ensure_user(
                session=session,
                user_id="admin-1",
                email=initial_admin_email,
                name=initial_admin_name,
                role=UserRole.admin,
                password=initial_admin_password,
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
            existing.updated_at = self._utc_now()
            return

        now = self._utc_now()
        session.add(
            UserModel(
                id=user_id,
                email=normalized_email,
                name=name,
                role=role.value,
                password_hash=self._password_hasher.hash(password),
                is_active=True,
                created_at=now,
                updated_at=now,
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
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)
