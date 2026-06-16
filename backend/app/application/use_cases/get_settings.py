from __future__ import annotations

from app.domain.entities.settings import RobotSettings
from app.domain.repositories.settings_repository import SettingsRepository


class GetSettingsUseCase:
    def __init__(self, settings_repository: SettingsRepository) -> None:
        self._settings_repository = settings_repository

    def execute(self) -> RobotSettings:
        return self._settings_repository.get_settings()
