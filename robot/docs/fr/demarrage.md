---
title: Demarrage
parent: Francais
nav_order: 1
---

# Demarrage
{: .no_toc }

Se connecter au robot, comprendre ses couches, et lancer le materiel avant
tout exercice.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Ce qu'il vous faut

- Un **ROSMASTER M3 Pro**, allume, sur le meme reseau que votre ordinateur.
- L'**adresse IP du robot**. Demandez-la a votre formateur. Dans ce guide
  elle est notee `<robot-ip>` (une valeur typique en salle est
  `192.168.50.102`).
- Un **client SSH**. Integre a macOS, Linux et Windows recent.

## Les trois couches

Le logiciel du robot est construit en trois couches. Chaque couche depend de
celle du dessous.

```text
Couche 3   Applications   SLAM, Nav2, vision, bras, tableau de bord
              |           (les paquets que vous lancez dans les exercices)
Couche 2   Bringup        state publisher, filtre IMU, fusion scans, EKF
              |           (produit /odom, /scan_multi, /tf)
Couche 1   micro-ROS      relie le microcontroleur STM32 a ROS 2
              |           (roues brutes, /odom_raw, /imu_raw, /battery)
           STM32 MCU      moteurs, encodeurs, IMU, batterie, LED, buzzer
```

Si un noeud SLAM ou navigation n'affiche aucune carte et aucun robot, la
cause est presque toujours que **la couche 2 (bringup) ne tourne pas**. Voir
[Depannage](depannage.html).

## Se connecter au robot

ROS 2 Humble tourne dans un conteneur Docker nomme `m3pro` sur le Jetson du
robot. Ouvrez une session SSH, puis entrez dans le conteneur:

```bash
ssh jetson@<robot-ip>
docker exec -it m3pro bash
```

Sur un robot prepare avec les scripts du dossier `setup/`, le conteneur
demarre automatiquement au boot. Vous ne le lancez a la main que s'il a ete
arrete.

## Sourcer l'environnement ROS 2

Chaque nouveau shell dans le conteneur doit sourcer ROS 2 et l'espace de
travail du cours:

```bash
source /opt/ros/humble/setup.bash
source /root/m3pro_teacher_ws/install/setup.bash
```

Ce robot utilise une configuration reseau ROS fixe:

```bash
export ROS_DOMAIN_ID=30
export FASTDDS_BUILTIN_TRANSPORTS=UDPv4
```

Un robot prepare regle deja tout cela dans le `.bashrc` du conteneur, donc
un nouveau `docker exec -it m3pro bash` est pret a l'emploi.

## Lancer la couche materielle (bringup)

Avant de lancer tout noeud SLAM, navigation ou vision, **la couche 2 doit
tourner**. Le bringup demarre:

| Noeud | Role |
| --- | --- |
| `robot_state_publisher` | Publie l'URDF du robot et son arbre TF statique. |
| `imu_filter_madgwick` | Produit une `/imu` propre et filtree. |
| `laserscan_multi_merger` | Fusionne `/scan0` + `/scan1` en un `/scan_multi` a 360 degres. |
| `ekf_node` | Fusionne l'odometrie roues et l'IMU en `/odom` et la transformation `odom -> base_footprint`. |

Lancez-le:

```bash
ros2 launch slam_mapping bringup.launch.py
```

Attendez les lignes de log `First IMU message received` et
`Subscribing to topics 2`. Sur un robot prepare avec les scripts de
persistance, le bringup est lance automatiquement au boot.

## Verifier que le robot est vivant

```bash
ros2 topic list                                 # /odom /scan_multi /imu /battery /tf ...
ros2 topic echo /battery --once                 # tension de la batterie
ros2 topic hz /scan_multi                        # cadence du lidar, environ 8-10 Hz
ros2 run tf2_ros tf2_echo odom base_footprint     # doit afficher une transformation
```

Si `tf2_echo` affiche `Invalid frame ID "odom"`, le bringup ne tourne
**pas**. Lancez-le avant de continuer.

## Conduire le robot a la main

Le robot ecoute les commandes de vitesse sur `/cmd_vel`.

```bash
# Controle clavier interactif
ros2 run teleop_twist_keyboard teleop_twist_keyboard

# Ou une seule impulsion vers l'avant
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"
```

Le M3 Pro a des roues mecanum, donc `linear.y` fonctionne aussi: le robot
peut se deplacer lateralement sans tourner.

> **Securite.** Gardez un espace degage autour du robot. Arretez-le a tout
> moment avec `Ctrl+C` sur le teleop, ou publiez un `Twist` nul. Le buzzer
> reste desactive pendant le cours. Le bras n'est alimente qu'avec
> l'autorisation du formateur.

## La suite

- [Navigation](navigation.html) - construire une carte et naviguer en autonomie.
- [Tableau de bord](tableau-de-bord.html) - observer le robot depuis un
  navigateur, Foxglove ou RViz.
