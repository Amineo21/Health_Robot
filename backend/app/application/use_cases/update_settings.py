from __future__ import annotations

import math
from dataclasses import replace

from app.application.use_cases.settings_errors import SettingsValidationError
from app.domain.entities.settings import RobotSettings, utc_now
from app.domain.repositories.settings_repository import SettingsRepository


class UpdateSettingsUseCase:
    def __init__(self, settings_repository: SettingsRepository) -> None:
        self._settings_repository = settings_repository

    def execute(self, updated_settings: RobotSettings) -> RobotSettings:
        self._validate(updated_settings)
        return self._settings_repository.update_settings(replace(updated_settings, updated_at=utc_now()))

    @staticmethod
    def _validate(settings: RobotSettings) -> None:
        if not math.isfinite(settings.max_speed_mps) or settings.max_speed_mps <= 0:
            raise SettingsValidationError("max_speed_mps must be positive")
        if settings.max_speed_mps > 0.5:
            raise SettingsValidationError("max_speed_mps must be <= 0.5")
        if not math.isfinite(settings.meal_speed_mps) or settings.meal_speed_mps <= 0:
            raise SettingsValidationError("meal_speed_mps must be positive")
        if settings.meal_speed_mps > 0.3:
            raise SettingsValidationError("meal_speed_mps must be <= 0.3")
        if not 5 <= settings.low_battery_threshold <= 50:
            raise SettingsValidationError("low_battery_threshold must be between 5 and 50")
