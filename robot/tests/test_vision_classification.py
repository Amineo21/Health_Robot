"""
Tests unitaires pour la logique de classification vision.
On teste le parsing des résultats sans instancier de node ROS2.
"""
import json
import pytest


def parse_classification(raw: str) -> dict:
    """Parse le message de classification depuis vision_node."""
    data = json.loads(raw)
    return {'type': data['type'], 'count': data['count']}


def is_person_detected(classification: dict) -> bool:
    return classification['type'] == 'PERSON' and classification['count'] > 0


class TestVisionClassification:

    def test_person_detected(self):
        msg = json.dumps({'type': 'PERSON', 'count': 2})
        result = parse_classification(msg)
        assert is_person_detected(result) is True

    def test_object_not_a_person(self):
        msg = json.dumps({'type': 'OBJECT', 'count': 0})
        result = parse_classification(msg)
        assert is_person_detected(result) is False

    def test_unknown_not_a_person(self):
        msg = json.dumps({'type': 'UNKNOWN', 'count': 0})
        result = parse_classification(msg)
        assert is_person_detected(result) is False

    def test_person_count_zero_not_detected(self):
        # count=0 même si type=PERSON → pas de détection réelle
        msg = json.dumps({'type': 'PERSON', 'count': 0})
        result = parse_classification(msg)
        assert is_person_detected(result) is False

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            parse_classification('invalid')
