#!/bin/bash
# Copie la carte sauvegardée depuis le robot vers le backend
ROBOT_IP="10.10.220.180"
MAP_REMOTE="/root/M3Pro_ws/install/M3Pro_navigation/share/M3Pro_navigation/map/yahboom_map"
MAP_LOCAL="$(dirname "$0")/map"

echo "Récupération de la carte depuis le robot..."
ssh jetson@$ROBOT_IP "docker exec rosmaster-m3pro cat ${MAP_REMOTE}.pgm" > "$MAP_LOCAL/yahboom_map.pgm"
ssh jetson@$ROBOT_IP "docker exec rosmaster-m3pro cat ${MAP_REMOTE}.yaml" > "$MAP_LOCAL/yahboom_map.yaml"
echo "Carte sauvegardée dans $MAP_LOCAL"
