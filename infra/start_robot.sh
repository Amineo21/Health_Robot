#!/usr/bin/env bash
# Procédure de démarrage complet du robot Health Robot
# Lancer sur le Jetson : bash ~/start_robot.sh
#
# IP de la machine dev (broker MQTT) — mettre à jour si elle change
MQTT_IP="10.10.220.121"
CONTAINER="rosmaster-m3pro"
S="source /opt/ros/humble/setup.bash && source /root/yahboomcar_ws/install/setup.bash 2>/dev/null || true && source /root/M3Pro_ws/install/setup.bash 2>/dev/null || true"

echo "================================================================"
echo "  HEALTH ROBOT — Procédure de démarrage"
echo "  MQTT broker : $MQTT_IP"
echo "================================================================"
echo ""

echo "--- Mise à jour IP dans le bridge ---"
docker exec $CONTAINER sed -i "s/MQTT_HOST = \"10\.10\.[0-9]*\.[0-9]*\"/MQTT_HOST = \"$MQTT_IP\"/" /tmp/bridge_clean.py 2>/dev/null && echo "OK : bridge_clean.py mis à jour -> $MQTT_IP" || echo "ATTENTION : bridge_clean.py introuvable dans le container"
echo ""

echo "================================================================"
echo " ORDRE EXACT DE LANCEMENT — un terminal SSH par étape"
echo " Attendre que chaque étape soit prête avant de continuer"
echo "================================================================"
echo ""

echo "[ ÉTAPE 0 ] Démarrer le container (si pas déjà fait)"
echo "  bash ~/start_agent.sh"
echo "  cd ~/M3Pro_ws && docker-compose up -d"
echo ""

echo "[ TERMINAL 1 ] Bringup — IMU + Lidar + EKF"
echo "  ⏳ Attendre : 'First IMU message received' avant de continuer"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && ros2 launch slam_mapping bringup.launch.py\""
echo ""

echo "[ TERMINAL 2 ] Navigation Nav2"
echo "  ⏳ Attendre : bt_navigator et amcl démarrés avant de continuer"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && ros2 launch M3Pro_navigation navigation2.launch.py\""
echo ""

echo "[ TERMINAL 3 ] Pose initiale — à envoyer UNE SEULE FOIS après Nav2 prêt"
echo "  (place le robot à l'origine de la carte)"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped '{header: {frame_id: map}, pose: {pose: {position: {x: 0.0, y: 0.0, z: 0.0}, orientation: {w: 1.0}}, covariance: [0.25,0,0,0,0,0,0,0.25,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.07]}}'\""
echo ""

echo "[ TERMINAL 4 ] Caméra ROS2 — node orbbec"
echo "  ⏳ Attendre : 'Device DaBai DCW2 connected' avant de lancer T5"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && ros2 launch orbbec_camera astra.launch.py enable_depth:=false enable_ir:=false\""
echo ""

echo "[ TERMINAL 5 ] Stream caméra Flask — port 8080"
echo "  (lancer seulement après 'Device DaBai DCW2 connected' dans T4)"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && python3 /tmp/camera_stream.py\""
echo ""

echo "[ TERMINAL 6 ] MQTT Bridge — lancer EN DERNIER après Nav2 prêt"
echo "  ⚠️  Ne pas lancer avant que Nav2 soit complètement démarré"
echo ""
echo "  docker exec -it -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 $CONTAINER bash -c \"$S && python3 /tmp/bridge_clean.py\""
echo ""

echo "================================================================"
echo " Frontend : http://localhost:3000 (depuis la machine dev)"
echo " Caméra   : http://10.10.220.180:8080/stream"
echo "================================================================"
