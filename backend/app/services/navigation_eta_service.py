from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Optional

from app.core.config import settings
from app.models.events import BatteryTelemetry, EtaSource, NavigationEtaTelemetry
from app.state.robot_state import RobotStateStore


@dataclass(frozen=True)
class NavigationEtaSnapshot:
    eta_seconds: Optional[int]
    eta_source: EtaSource
    path_distance_m: Optional[float]
    distance_remaining_m: Optional[float]
    current_speed_mps: Optional[float]


class NavigationEtaService:
    def __init__(self, state_store: RobotStateStore) -> None:
        self._state_store = state_store

    def process_nav2_telemetry(self, telemetry: NavigationEtaTelemetry) -> NavigationEtaTelemetry:
        normalized = self._normalize_telemetry(telemetry)
        self._state_store.update_navigation_eta(normalized)
        return normalized

    def build_eta_snapshot(self, telemetry: BatteryTelemetry) -> NavigationEtaSnapshot:
        if telemetry.distance_remaining_m is not None or telemetry.path_distance_m is not None:
            normalized = self._normalize_telemetry(
                NavigationEtaTelemetry(
                    mission_id=telemetry.mission_id,
                    path_distance_m=telemetry.path_distance_m,
                    distance_remaining_m=telemetry.distance_remaining_m,
                    eta_seconds=telemetry.eta_seconds,
                    current_speed_mps=telemetry.current_speed_mps,
                    eta_source=telemetry.eta_source or EtaSource.nav2_feedback,
                )
            )
            return self._snapshot_from_telemetry(normalized)

        latest = self._state_store.get_navigation_eta(mission_id=telemetry.mission_id)
        if latest is not None:
            return self._snapshot_from_telemetry(latest)

        fallback_distance = telemetry.distance_to_base_m
        if fallback_distance is None:
            fallback_distance = settings.base_eta_distance_m

        return NavigationEtaSnapshot(
            eta_seconds=self._estimate_eta_seconds(fallback_distance),
            eta_source=EtaSource.fallback,
            path_distance_m=fallback_distance,
            distance_remaining_m=fallback_distance,
            current_speed_mps=None,
        )

    def _normalize_telemetry(self, telemetry: NavigationEtaTelemetry) -> NavigationEtaTelemetry:
        distance_reference = telemetry.distance_remaining_m
        if distance_reference is None:
            distance_reference = telemetry.path_distance_m

        eta_seconds = telemetry.eta_seconds
        if eta_seconds is None and distance_reference is not None:
            speed_reference = self._resolve_speed_reference(telemetry.current_speed_mps)
            if speed_reference is not None:
                eta_seconds = ceil(distance_reference / speed_reference)

        return telemetry.model_copy(
            update={
                "eta_seconds": eta_seconds,
                "distance_remaining_m": distance_reference,
            }
        )

    @staticmethod
    def _snapshot_from_telemetry(telemetry: NavigationEtaTelemetry) -> NavigationEtaSnapshot:
        return NavigationEtaSnapshot(
            eta_seconds=telemetry.eta_seconds,
            eta_source=telemetry.eta_source,
            path_distance_m=telemetry.path_distance_m,
            distance_remaining_m=telemetry.distance_remaining_m,
            current_speed_mps=telemetry.current_speed_mps,
        )

    @staticmethod
    def _resolve_speed_reference(current_speed_mps: Optional[float]) -> Optional[float]:
        if current_speed_mps is not None and current_speed_mps > 0:
            return current_speed_mps
        if settings.nominal_return_speed_mps > 0:
            return settings.nominal_return_speed_mps
        return None

    @staticmethod
    def _estimate_eta_seconds(distance_m: Optional[float]) -> Optional[int]:
        if distance_m is None:
            return None
        speed_reference = NavigationEtaService._resolve_speed_reference(None)
        if speed_reference is None:
            return None
        return ceil(distance_m / speed_reference)
