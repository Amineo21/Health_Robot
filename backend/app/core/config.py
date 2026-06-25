from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


def _as_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_csv(value: Optional[str], default: tuple[str, ...]) -> tuple[str, ...]:
    if value is None:
        return default
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(
            f"Environment variable {key} is required. "
            "Set it in your .env file or environment before starting the server."
        )
    return value


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "health-robot-backend")
    api_port: int = int(os.getenv("API_PORT", "4000"))
    cors_allow_origins: tuple[str, ...] = _as_csv(
        os.getenv("CORS_ALLOW_ORIGINS"),
        ("http://localhost:3000", "http://127.0.0.1:3000"),
    )
    mqtt_host: str = os.getenv("MQTT_HOST", "localhost")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_keepalive: int = int(os.getenv("MQTT_KEEPALIVE", "60"))
    mqtt_enabled: bool = _as_bool(os.getenv("MQTT_ENABLED"), True)
    mqtt_username: Optional[str] = os.getenv("MQTT_USERNAME")
    mqtt_password: Optional[str] = os.getenv("MQTT_PASSWORD")
    mqtt_client_id: str = os.getenv("MQTT_CLIENT_ID", "health-robot-backend")
    robot_rosbridge_enabled: bool = _as_bool(os.getenv("ROBOT_ROSBRIDGE_ENABLED"), False)
    robot_rosbridge_url: str = os.getenv("ROBOT_ROSBRIDGE_URL", "ws://10.10.220.180:9090")
    robot_rosbridge_client_id: str = os.getenv("ROBOT_ROSBRIDGE_CLIENT_ID", "health-robot-rosbridge")
    robot_dashboard_url: str = os.getenv("ROBOT_DASHBOARD_URL", "http://10.10.220.180:8080")
    robot_maps_directory: str = os.getenv("ROBOT_MAPS_DIRECTORY", "/root/maps")
    robot_base_x: float = float(os.getenv("ROBOT_BASE_X", "0.0"))
    robot_base_y: float = float(os.getenv("ROBOT_BASE_Y", "0.0"))
    robot_base_yaw: float = float(os.getenv("ROBOT_BASE_YAW", "0.0"))
    low_battery_threshold: int = int(os.getenv("LOW_BATTERY_THRESHOLD", "20"))
    max_speed_mps: float = float(os.getenv("MAX_SPEED_MPS", "0.5"))
    meal_speed_mps: float = float(os.getenv("MEAL_SPEED_MPS", "0.3"))
    base_eta_distance_m: float = float(os.getenv("BASE_ETA_DISTANCE_M", "25"))
    nominal_return_speed_mps: float = float(os.getenv("RETURN_SPEED_MPS", "0.35"))
    auto_return_enabled: bool = _as_bool(os.getenv("AUTO_RETURN_ENABLED"), True)
    teleop_enabled: bool = _as_bool(os.getenv("TELEOP_ENABLED"), True)
    emergency_requires_admin_reset: bool = _as_bool(os.getenv("EMERGENCY_REQUIRES_ADMIN_RESET"), True)
    jwt_secret_key: str = field(default_factory=lambda: _require_env("JWT_SECRET_KEY"))
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    initial_admin_email: str = os.getenv("INITIAL_ADMIN_EMAIL", os.getenv("ADMIN_EMAIL", "admin@health-robot.local"))
    initial_admin_password: str = field(default_factory=lambda: _require_env("INITIAL_ADMIN_PASSWORD"))
    initial_admin_name: str = os.getenv("INITIAL_ADMIN_NAME", "Admin")
    robot_api_key: Optional[str] = os.getenv("ROBOT_API_KEY")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./health_robot.db")
    user_repository_backend: str = os.getenv("USER_REPOSITORY_BACKEND", "memory")
    settings_repository_backend: str = os.getenv(
        "SETTINGS_REPOSITORY_BACKEND",
        os.getenv("USER_REPOSITORY_BACKEND", "memory"),
    )
    mission_repository_backend: str = os.getenv("MISSION_REPOSITORY_BACKEND", "database")
    mission_arrival_radius_m: float = float(os.getenv("MISSION_ARRIVAL_RADIUS_M", "0.60"))
    robot_screen_token: Optional[str] = os.getenv("ROBOT_SCREEN_TOKEN")


settings = Settings()
