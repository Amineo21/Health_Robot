from __future__ import annotations

from typing import Protocol

from app.domain.entities.settings import RobotSettings


class SettingsRepository(Protocol):
    def get_settings(self) -> RobotSettings: ...

    def update_settings(self, settings: RobotSettings) -> RobotSettings: ...
