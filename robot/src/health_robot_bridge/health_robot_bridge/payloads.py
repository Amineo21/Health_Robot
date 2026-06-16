from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ParsedCommand:
    command_id: str
    command_type: str
    requested_by: str | None
    requested_by_role: str | None
    payload: dict[str, Any]


def parse_mqtt_command(raw_payload: bytes | str) -> ParsedCommand:
    if isinstance(raw_payload, bytes):
        raw_payload = raw_payload.decode('utf-8')

    message = json.loads(raw_payload)
    payload = message.get('payload') or {}
    if not isinstance(payload, dict):
        raise ValueError('payload must be an object')

    command_id = message.get('command_id')
    command_type = message.get('type')
    if not isinstance(command_id, str) or not command_id:
        raise ValueError('command_id is required')
    if not isinstance(command_type, str) or not command_type:
        raise ValueError('type is required')

    return ParsedCommand(
        command_id=command_id,
        command_type=command_type,
        requested_by=_optional_string(message.get('requested_by')),
        requested_by_role=_optional_string(message.get('requested_by_role')),
        payload=payload,
    )


def yaw_to_quaternion(yaw: float) -> tuple[float, float, float, float]:
    half_yaw = yaw / 2.0
    return 0.0, 0.0, math.sin(half_yaw), math.cos(half_yaw)


def finite_float(value: Any, field_name: str) -> float:
    if not isinstance(value, int | float):
        raise ValueError(f'{field_name} must be a number')
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f'{field_name} must be finite')
    return result


def optional_finite_float(value: Any, field_name: str, default: float) -> float:
    if value is None:
        return default
    return finite_float(value, field_name)


def duration_to_seconds(duration_msg: Any) -> float | None:
    if duration_msg is None:
        return None
    sec = getattr(duration_msg, 'sec', None)
    nanosec = getattr(duration_msg, 'nanosec', None)
    if sec is None or nanosec is None:
        return None
    return float(sec) + (float(nanosec) / 1_000_000_000.0)


def voltage_to_percent(voltage: float, empty_voltage: float = 9.9, full_voltage: float = 12.6) -> int:
    if not math.isfinite(voltage):
        return 0
    if full_voltage <= empty_voltage:
        raise ValueError('full_voltage must be greater than empty_voltage')
    percentage = ((voltage - empty_voltage) / (full_voltage - empty_voltage)) * 100.0
    return max(0, min(100, round(percentage)))


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None
