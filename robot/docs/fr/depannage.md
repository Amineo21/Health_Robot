---
title: Depannage
parent: Francais
nav_order: 7
---

# Depannage
{: .no_toc }

Les erreurs les plus probables, et le correctif de chacune.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## SLAM et navigation

| Symptome | Cause | Correctif |
| --- | --- | --- |
| RViz n'affiche aucune carte, aucun robot. slam_toolbox journalise `Message Filter dropping message ... the timestamp on the message is earlier than all the data in the transform cache`. | Le bringup materiel ne tourne pas, donc la transformation `odom -> base_footprint` manque. Le SLAM rejette chaque scan. | Lancez d'abord la couche 2: `ros2 launch slam_mapping bringup.launch.py`. Voir [Demarrage](demarrage.html). |
| `Invalid frame ID "odom" passed to canTransform`. | Meme cause: l'EKF du bringup ne publie pas `odom`. | Lancez le bringup. Verifiez avec `ros2 run tf2_ros tf2_echo odom base_footprint`. |
| Le panneau RViz dit `Fixed Frame [map] does not exist`. | Aucun noeud ne publie encore le repere `map`. | Avant le SLAM, mettez **Fixed Frame** sur `odom`. Une fois le SLAM lance, remettez-le sur `map`. |
| `ros2 topic hz /scan_multi` n'affiche rien. | Le fusionneur de scans (partie du bringup) ne tourne pas, ou un lidar est debranche. | Lancez le bringup. Verifiez `/scan0` et `/scan1` separement. |
| Nav2 ignore les objectifs envoyes sur `/goal_pose`. | Les noeuds lifecycle de Nav2 ne sont pas actifs, ou il n'y a pas de carte. | `ros2 lifecycle get /bt_navigator` doit dire `active`. Assurez-vous qu'une carte existe. |
| Le robot planifie un chemin mais ne bouge jamais. | L'agent micro-ROS est tombe, donc `/cmd_vel` n'atteint jamais les roues. | Demandez au formateur de lancer `setup/restart_microros_agent.sh <robot-ip>`. |
| La carte derive puis saute brusquement. | Saturation du CPU: les scans sont traites en retard. | C'est attendu sur le Jetson. Le `slam_toolbox_params.yaml` du cours augmente deja les seuils pour limiter cet effet. |

## Vision et bras

| Symptome | Cause | Correctif |
| --- | --- | --- |
| Pas de topic `/camera/color/image_raw`. | Le noeud camera n'est pas lance. | Lancez la camera (le bringup ou `container_autostart.sh` le fait sur un robot prepare). |
| `object_detector_node` ne detecte rien. | La plage HSV ne correspond pas a l'objet, ou l'objet est trop loin ou trop petit. | Ajustez `hsv_*` et `min_contour_area` dans `detection_params.yaml`. Voir [Bras](bras.html). |
| Le log du bras dit `[DRY RUN] Would send arm: [...]`. | Le paquet `arm_msgs` n'est pas installe, les commandes sont seulement simulees. | C'est sans danger. Installez `arm_msgs` pour piloter les vrais servos, ou gardez le dry-run pour tester la logique. |
| Le bras bouge mais rate l'objet. | La profondeur de detection est fausse, ou la transformation camera vers bras est decalee. | Verifiez la valeur de profondeur et la TF statique `base_link -> camera_color_optical_frame`. |

## Reseau et outils

| Symptome | Cause | Correctif |
| --- | --- | --- |
| `ros2 topic list` depuis votre ordinateur n'affiche rien. | Mauvais `ROS_DOMAIN_ID`, ou vous n'etes pas sur le reseau du robot. | Utilisez `ROS_DOMAIN_ID=30` et le meme `FASTDDS_BUILTIN_TRANSPORTS=UDPv4`. Le plus simple est de lancer les commandes dans le conteneur. |
| Foxglove ne se connecte pas. | rosbridge ne tourne pas, ou l'URL WebSocket est fausse. | Lancez une stack qui demarre rosbridge (port 9090). Connectez-vous a `ws://<robot-ip>:9090`. |
| La page du tableau de bord se charge mais reste `DISCONNECTED`. | Le serveur HTTP (8080) tourne mais rosbridge (9090) non. | Les deux ports sont necessaires. Relancez `web_dashboard.launch.py`. |
| Beaucoup d'avertissements d'horodatage, les recherches TF echouent par intermittence. | L'horloge systeme du robot a derive. | Synchronisez l'horloge: `sudo timedatectl set-ntp true` sur le Jetson. |

## Une remise a zero fiable

Quand plusieurs choses sont cassees a la fois, redemarrez proprement du bas
vers le haut:

```bash
# 1. Couche materielle
ros2 launch slam_mapping bringup.launch.py
# attendez "Subscribing to topics 2"

# 2. Votre exercice (SLAM, Nav2, vision ...) dans un second shell
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py
```

Lancez toujours la couche 2 avant la couche 3. La plupart des situations
"rien ne marche" sont un bringup manquant.
