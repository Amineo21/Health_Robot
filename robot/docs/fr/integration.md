---
title: Integration
parent: Francais
nav_order: 4
---

# Tout assembler
{: .no_toc }

Faire tourner cartographie, navigation, vision et bras comme un seul
systeme: cartographier une piece, rouler vers un objet, et le ramasser.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Le systeme complet

```text
            +-----------------------------------------------+
            |             Couche 3: applications            |
            |  SLAM   Nav2   detecteur objets   bras pick    |
            +-----------------------------------------------+
              ^         ^            ^               ^
        /scan_multi   /map        /camera/*     /teacher/detections
        /odom /tf    /goal_pose                 /arm6_joints
              |         |            |               |
            +-----------------------------------------------+
            |       Couche 2: bringup (materiel)             |
            |  state publisher  filtre IMU  fusion  EKF      |
            +-----------------------------------------------+
              ^         ^
        /scan0 /scan1  /odom_raw /imu_raw
              |
            +-----------------------------------------------+
            |   Couche 1: agent micro-ROS  <-->  STM32 MCU   |
            +-----------------------------------------------+
```

La regle d'or: **toujours demarrer par le bas**. La couche 2 avant la couche
3, a chaque fois.

## Ordre de demarrage

| Ordre | Quoi | Commande |
| --- | --- | --- |
| 1 | Bringup materiel (couche 2) | `ros2 launch slam_mapping bringup.launch.py` |
| 2 | Camera | `ros2 launch slam_mapping app_camera.launch.py` |
| 3 | SLAM + Nav2 | `ros2 launch m3pro_teacher_nav slam_and_nav.launch.py` |
| 4 | Vision + bras | `ros2 launch m3pro_teacher_vision detect_and_pick.launch.py` |

Chacun tourne dans son propre shell (`docker exec -it m3pro bash`, puis
sourcer l'environnement). Sur un robot prepare avec les scripts de
persistance, les etapes 1 et 2 tournent deja au boot.

## Parcours complet de bout en bout

L'objectif: le robot cartographie une piece, navigue vers une zone cible,
trouve un objet rouge la-bas, et le ramasse.

### Etape 1: Lancer le materiel

```bash
ros2 launch slam_mapping bringup.launch.py
# attendez: First IMU message received / Subscribing to topics 2
ros2 launch slam_mapping app_camera.launch.py
```

Verifiez que la couche 2 est saine:

```bash
ros2 run tf2_ros tf2_echo odom base_footprint     # doit afficher une transformation
ros2 topic hz /scan_multi                          # environ 8-10 Hz
```

### Etape 2: Cartographier la piece

```bash
ros2 launch m3pro_teacher_nav slam_online.launch.py
ros2 run teleop_twist_keyboard teleop_twist_keyboard   # second shell
```

Conduisez lentement, couvrez tous les murs, repassez par des endroits deja
vus. Quand la carte semble complete:

```bash
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/labo}}"
```

Arretez le SLAM (`Ctrl+C`).

### Etape 3: Naviguer sur la carte sauvegardee

```bash
ros2 launch m3pro_teacher_nav navigation.launch.py map:=/root/maps/labo.yaml
```

Reglez la pose de depart du robot (RViz **2D Pose Estimate** ou
`/initialpose`), puis envoyez-le vers la zone ou se trouve l'objet:

```bash
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"
```

Attendez que le robot arrive.

### Etape 4: Detecter et ramasser

```bash
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py
```

Le detecteur trouve l'objet rouge, le robot fait une courte approche finale,
et le bras deroule `APPROACH -> REACH -> GRASP -> LIFT`. Suivez la
progression sur `/teacher/detection_image` et l'etat du bras dans le log du
noeud.

> Reglez d'abord la couleur avec `detect_and_pick.launch.py pick:=false`,
> pour que le bras reste immobile pendant que vous verifiez les detections.
> Voir [Bras](bras.html).

## Un chemin tout-en-un plus rapide

Pour eviter le cycle sauvegarder/recharger, utilisez `slam_and_nav.launch.py`:
il cartographie **et** navigue en meme temps. Ajoutez ensuite la vision
par-dessus.

```bash
# Shell 1 - materiel (a sauter si autostart)
ros2 launch slam_mapping bringup.launch.py
ros2 launch slam_mapping app_camera.launch.py

# Shell 2 - cartographier et naviguer ensemble
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py

# Shell 3 - detecter et ramasser
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py
```

Envoyez des objectifs avec `/goal_pose`, et le robot navigue dans l'espace
deja cartographie pendant que la chaine vision cherche des objets.

## Comment les couches partagent les donnees

| Topic | Produit par | Consomme par |
| --- | --- | --- |
| `/scan_multi` | bringup (fusion scans) | SLAM, costmap Nav2 |
| `/odom`, `/tf` | bringup (EKF) | SLAM, Nav2, bras |
| `/map` | slam_toolbox | Nav2, tableau de bord |
| `/goal_pose` | vous, tableau de bord, explore | Nav2 |
| `/camera/color/image_raw` | camera | detecteur d'objets |
| `/teacher/detections` | detecteur d'objets | noeud de ramassage |
| `/teacher/camera_scan` | noeud obstacle depth | costmap Nav2 |
| `/cmd_vel` | Nav2, approche bras | agent micro-ROS -> roues |
| `/arm6_joints` | noeud de ramassage | pilote du bras |

Si une etape n'affiche rien, verifiez le topic qui l'alimente avec
`ros2 topic hz <topic>`.

## La suite

- [Tableau de bord](tableau-de-bord.html) - observer tout le systeme sur un
  seul ecran.
- [Depannage](depannage.html) - quand une etape reste silencieuse.
