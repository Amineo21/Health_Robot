from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def _as_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "health-robot-backend")
    api_port: int = int(os.getenv("API_PORT", "4000"))
    mqtt_host: str = os.getenv("MQTT_HOST", "localhost")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_keepalive: int = int(os.getenv("MQTT_KEEPALIVE", "60"))
    mqtt_username: Optional[str] = os.getenv("MQTT_USERNAME")
    mqtt_password: Optional[str] = os.getenv("MQTT_PASSWORD")
    mqtt_client_id: str = os.getenv("MQTT_CLIENT_ID", "health-robot-backend")
    low_battery_threshold: int = int(os.getenv("LOW_BATTERY_THRESHOLD", "20"))
    base_eta_distance_m: float = float(os.getenv("BASE_ETA_DISTANCE_M", "25"))
    nominal_return_speed_mps: float = float(os.getenv("RETURN_SPEED_MPS", "0.35"))
    auto_return_enabled: bool = _as_bool(os.getenv("AUTO_RETURN_ENABLED"), True)


settings = Settings()
