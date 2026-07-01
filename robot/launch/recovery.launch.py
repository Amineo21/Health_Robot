"""Lancement de la recuperation autonome de fourniture (scan + bras M3 Pro).

Demarre les deux briques de l'etape "recuperation de fourniture" :
  - object_detector_node  : scanne la fourniture, publie /teacher/detections
  - mission_recovery_node : sur requete du backend, saisit la fourniture au bras
                            puis signale /robot/mission/recovery_done

A lancer en plus de la navigation et du rosbridge_server (deja lance pour la
nav) : c'est le pont rosbridge du backend qui relaie /robot/mission/recovery_*
entre le robot et le backend. Aucun node MQTT supplementaire n'est requis.
"""
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    object_detector_node = Node(
        package='m3pro_teacher_vision',
        executable='object_detector_node',
        name='object_detector_node',
        output='screen',
    )

    mission_recovery_node = Node(
        package='mission_recovery',
        executable='mission_recovery_node',
        name='mission_recovery_node',
        output='screen',
    )

    return LaunchDescription([
        object_detector_node,
        mission_recovery_node,
    ])
