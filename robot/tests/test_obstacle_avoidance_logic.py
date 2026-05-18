"""
Tests unitaires pour la logique de détection d'obstacles.
On teste les seuils et les décisions sans instancier de node ROS2.
"""
import pytest

STOP_DISTANCE = 0.5
WARNING_DISTANCE = 1.0


def get_obstacle_status(min_distance: float) -> str:
    """Détermine le statut selon la distance minimale détectée par le Lidar."""
    if min_distance < STOP_DISTANCE:
        return 'STOP'
    elif min_distance < WARNING_DISTANCE:
        return 'WARNING'
    return 'CLEAR'


def get_min_distance(ranges: list, range_min: float, range_max: float):
    """Filtre les mesures invalides et retourne la distance minimale."""
    valid = [r for r in ranges if range_min < r < range_max]
    return min(valid) if valid else None


class TestObstacleStatus:

    def test_stop_when_very_close(self):
        assert get_obstacle_status(0.3) == 'STOP'

    def test_stop_at_exact_threshold(self):
        assert get_obstacle_status(0.49) == 'STOP'

    def test_warning_between_thresholds(self):
        assert get_obstacle_status(0.6) == 'WARNING'
        assert get_obstacle_status(0.99) == 'WARNING'

    def test_clear_when_far(self):
        assert get_obstacle_status(1.5) == 'CLEAR'
        assert get_obstacle_status(10.0) == 'CLEAR'


class TestMinDistance:

    def test_filters_invalid_ranges(self):
        # Le Lidar retourne inf ou 0 pour les mesures hors portée
        ranges = [float('inf'), 0.0, 2.5, 1.2]
        result = get_min_distance(ranges, range_min=0.1, range_max=12.0)
        assert result == 1.2

    def test_returns_none_if_all_invalid(self):
        ranges = [float('inf'), 0.0, 15.0]
        result = get_min_distance(ranges, range_min=0.1, range_max=12.0)
        assert result is None

    def test_returns_minimum(self):
        ranges = [3.0, 1.5, 0.8, 2.2]
        result = get_min_distance(ranges, range_min=0.1, range_max=12.0)
        assert result == 0.8
