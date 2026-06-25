from __future__ import annotations

from fastapi import APIRouter

from app.application.dto.mission_dto import RobotScreenMission, RobotScreenStatusResponse
from app.domain.entities.mission import Mission, MissionStatus, SupplyType, utc_now
from app.presentation.api.dependencies import RobotScreenTokenDep, UseCasesDep

router = APIRouter(prefix="/robot-screen", tags=["robot screen"])

SUPPLY_LABELS_FR = {
    SupplyType.serviettes: "Serviettes",
    SupplyType.papier_toilette: "Papier toilette",
    SupplyType.gants: "Gants",
    SupplyType.protections: "Protections",
    SupplyType.linge: "Linge",
}

STATUS_TITLES_FR = {
    MissionStatus.pending: "Mission en attente",
    MissionStatus.navigating_to_stock: "En route vers le stock",
    MissionStatus.waiting_for_recovery_confirmation: "En attente de récupération",
    MissionStatus.navigating_to_delivery: "En route vers la chambre",
    MissionStatus.waiting_for_delivery_confirmation: "En attente de confirmation",
    MissionStatus.completed: "Livraison terminée",
    MissionStatus.cancelled: "Mission annulée",
    MissionStatus.failed: "Mission en échec",
}


@router.get("/status", response_model=RobotScreenStatusResponse)
def get_robot_screen_status(use_cases: UseCasesDep, _token: RobotScreenTokenDep) -> RobotScreenStatusResponse:
    robot_status = use_cases.get_robot_status.execute()
    if robot_status.emergency_active:
        return RobotScreenStatusResponse(
            robot_state="EMERGENCY_STOP",
            screen_title_fr="Arrêt d'urgence",
            screen_message_fr="CareBot est immobilisé. Un administrateur doit réinitialiser l'arrêt d'urgence.",
            current_mission=None,
            updated_at=robot_status.timestamp,
        )

    mission = use_cases.missions.get_active_mission() or use_cases.missions.get_oldest_pending_mission()
    if mission is None:
        return RobotScreenStatusResponse(
            robot_state="IDLE",
            screen_title_fr="CareBot",
            screen_message_fr="Prêt à aider l'équipe soignante",
            current_mission=None,
            updated_at=robot_status.timestamp or utc_now(),
        )

    return RobotScreenStatusResponse(
        robot_state="MISSION_ACTIVE" if mission.status != MissionStatus.pending else "MISSION_PENDING",
        screen_title_fr=STATUS_TITLES_FR[mission.status],
        screen_message_fr=_message_for(mission),
        current_mission=RobotScreenMission(
            id=mission.id,
            status=mission.status,
            supply_label_fr=SUPPLY_LABELS_FR[mission.supply_type],
            destination_label_fr=mission.delivery_room_name_snapshot,
        ),
        updated_at=robot_status.timestamp or utc_now(),
    )


def _message_for(mission: Mission) -> str:
    supply = SUPPLY_LABELS_FR[mission.supply_type].lower()
    if mission.status == MissionStatus.pending:
        return f"Mission planifiée pour livrer {supply} à {mission.delivery_room_name_snapshot}."
    if mission.status == MissionStatus.navigating_to_stock:
        return f"CareBot va récupérer {supply} au stock."
    if mission.status == MissionStatus.waiting_for_recovery_confirmation:
        return f"Merci de confirmer la récupération de {supply}."
    if mission.status == MissionStatus.navigating_to_delivery:
        return f"CareBot livre {supply} vers {mission.delivery_room_name_snapshot}."
    if mission.status == MissionStatus.waiting_for_delivery_confirmation:
        return f"Merci de confirmer la livraison à {mission.delivery_room_name_snapshot}."
    if mission.status == MissionStatus.failed:
        return "Mission interrompue. Une intervention est nécessaire."
    if mission.status == MissionStatus.cancelled:
        return "Mission annulée."
    return "Livraison terminée."
