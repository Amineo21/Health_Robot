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
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    admin_email: str = os.getenv("ADMIN_EMAIL", "admin@health-robot.local")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "admin")
    caregiver_email: str = os.getenv("CAREGIVER_EMAIL", "caregiver@health-robot.local")
    caregiver_password: str = os.getenv("CAREGIVER_PASSWORD", "caregiver")
    robot_api_key: Optional[str] = os.getenv("ROBOT_API_KEY")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./health_robot.db")
    user_repository_backend: str = os.getenv("USER_REPOSITORY_BACKEND", "memory")


settings = Settings()
