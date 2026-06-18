from __future__ import annotations

from dataclasses import replace

from app.domain.entities.settings import RobotSettings, utc_now


class InMemorySettingsRepository:
    def __init__(self, initial_settings: RobotSettings | None = None) -> None:
        self._settings = initial_settings or RobotSettings()

    def get_settings(self) -> RobotSettings:
        return self._settings

    def update_settings(self, settings: RobotSettings) -> RobotSettings:
        self._settings = replace(settings, updated_at=settings.updated_at or utc_now())
        return self._settings
