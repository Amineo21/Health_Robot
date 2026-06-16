from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict

from sqlalchemy.orm import Session

from app.domain.entities.settings import RobotSettings, utc_now
from app.infrastructure.database.models.settings_model import RobotSettingsModel


class SqlAlchemySettingsRepository:
    def __init__(self, session_factory: Callable[[], Session], default_settings: RobotSettings | None = None) -> None:
        self._session_factory = session_factory
        self._default_settings = default_settings or RobotSettings()
        self._seed_default_settings()

    def get_settings(self) -> RobotSettings:
        with self._session_factory() as session:
            model = session.get(RobotSettingsModel, self._default_settings.id)
            if model is None:
                model = self._create_default_model(session)
                session.commit()
                session.refresh(model)
            return self._to_domain(model)

    def update_settings(self, settings: RobotSettings) -> RobotSettings:
        with self._session_factory() as session:
            model = session.get(RobotSettingsModel, settings.id)
            if model is None:
                model = RobotSettingsModel(**asdict(settings))
                session.add(model)
            else:
                model.max_speed_mps = settings.max_speed_mps
                model.meal_speed_mps = settings.meal_speed_mps
                model.low_battery_threshold = settings.low_battery_threshold
                model.auto_return_enabled = settings.auto_return_enabled
                model.teleop_enabled = settings.teleop_enabled
                model.emergency_requires_admin_reset = settings.emergency_requires_admin_reset
                model.updated_at = settings.updated_at
            session.commit()
            session.refresh(model)
            return self._to_domain(model)

    def _seed_default_settings(self) -> None:
        with self._session_factory() as session:
            if session.get(RobotSettingsModel, self._default_settings.id) is not None:
                return
            self._create_default_model(session)
            session.commit()

    def _create_default_model(self, session: Session) -> RobotSettingsModel:
        settings = self._default_settings
        model = RobotSettingsModel(
            id=settings.id,
            max_speed_mps=settings.max_speed_mps,
            meal_speed_mps=settings.meal_speed_mps,
            low_battery_threshold=settings.low_battery_threshold,
            auto_return_enabled=settings.auto_return_enabled,
            teleop_enabled=settings.teleop_enabled,
            emergency_requires_admin_reset=settings.emergency_requires_admin_reset,
            updated_at=settings.updated_at or utc_now(),
        )
        session.add(model)
        return model

    @staticmethod
    def _to_domain(model: RobotSettingsModel) -> RobotSettings:
        return RobotSettings(
            id=model.id,
            max_speed_mps=model.max_speed_mps,
            meal_speed_mps=model.meal_speed_mps,
            low_battery_threshold=model.low_battery_threshold,
            auto_return_enabled=model.auto_return_enabled,
            teleop_enabled=model.teleop_enabled,
            emergency_requires_admin_reset=model.emergency_requires_admin_reset,
            updated_at=model.updated_at,
        )
