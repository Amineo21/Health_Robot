from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pytest

BRIDGE_SRC = Path(__file__).resolve().parents[1] / 'src' / 'health_robot_bridge'
sys.path.insert(0, str(BRIDGE_SRC))

from health_robot_bridge.payloads import finite_float, parse_mqtt_command, voltage_to_percent, yaw_to_quaternion  # noqa: E402


def test_parse_mqtt_command() -> None:
    raw = json.dumps({
        'command_id': 'cmd-1',
        'type': 'navigate',
        'requested_by': 'admin-1',
        'requested_by_role': 'admin',
        'payload': {'x': 1.5, 'y': 2.3},
    })

    command = parse_mqtt_command(raw)

    assert command.command_id == 'cmd-1'
    assert command.command_type == 'navigate'
    assert command.payload == {'x': 1.5, 'y': 2.3}


def test_parse_mqtt_command_rejects_missing_type() -> None:
    with pytest.raises(ValueError):
        parse_mqtt_command(json.dumps({'command_id': 'cmd-1', 'payload': {}}))


def test_finite_float_rejects_nan() -> None:
    with pytest.raises(ValueError):
        finite_float(float('nan'), 'x')


def test_yaw_to_quaternion() -> None:
    _, _, z, w = yaw_to_quaternion(math.pi)

    assert z == pytest.approx(1.0)
    assert w == pytest.approx(0.0)


def test_voltage_to_percent_matches_m3pro_dashboard_formula() -> None:
    assert voltage_to_percent(12.6) == 100
    assert voltage_to_percent(9.9) == 0
    assert voltage_to_percent(11.25) == 50
