"""
Tests unitaires pour la logique de parsing des tâches de navigation.
On teste la logique pure sans instancier de node ROS2.
"""
import json
import pytest


def parse_task(raw: str):
    """Extrait destination et room depuis un message JSON."""
    task = json.loads(raw)
    return {
        'room': task['room'],
        'x': task['destination']['x'],
        'y': task['destination']['y'],
    }


class TestTaskParsing:

    def test_parse_valid_task(self):
        msg = json.dumps({'room': '302', 'destination': {'x': 3.5, 'y': 1.2}})
        result = parse_task(msg)
        assert result['room'] == '302'
        assert result['x'] == 3.5
        assert result['y'] == 1.2

    def test_parse_missing_destination_raises(self):
        msg = json.dumps({'room': '302'})
        with pytest.raises(KeyError):
            parse_task(msg)

    def test_parse_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            parse_task('not_json')

    def test_parse_missing_room_raises(self):
        msg = json.dumps({'destination': {'x': 1.0, 'y': 2.0}})
        with pytest.raises(KeyError):
            parse_task(msg)
