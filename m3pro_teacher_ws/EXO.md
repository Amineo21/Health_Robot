# Exercice : TF2, URDF, RViz et fusion de capteurs sans scripts automatiques

Objectif: comprendre comment lancer et vérifier une démo ROS2 complète sans
utiliser les scripts `.sh` fournis par l'enseignant.

Vous allez:

1. vous connecter au robot;
2. trouver le conteneur Docker ROS2;
3. entrer dans Docker avec les bonnes variables d'environnement;
4. sourcer les workspaces ROS2;
5. vérifier les topics capteurs;
6. lancer la caméra si nécessaire;
7. afficher le robot dans RViz;
8. observer TF2 et URDF;
9. lancer la fusion lidar + caméra;
10. modifier un paramètre de comportement.

Important: le buzzer doit rester désactivé. On utilise la LED RGB, pas les bips.

## Matériel

- Robot Yahboom ROSMASTER M3 Pro allumé.
- Ordinateur connecté au même réseau.
- Accès SSH au robot.
- VNC ou écran sur le Jetson pour voir RViz.

Dans cet exercice, on utilise:

```text
Robot: jetson@192.168.50.102
ROS2: dans Docker
Workspace démo: /root/m3pro_teacher_ws
```

## Partie 1: Se connecter au robot

Depuis votre ordinateur: (à adapter)

```bash
ssh jetson@192.168.50.102 
```

Question:

```text
Sur quelle machine êtes-vous maintenant: votre ordinateur ou le Jetson du robot ?
```

Commande à tester:

```bash
hostname
whoami
```

Résultat attendu:

```text
hostname doit indiquer le Jetson.
whoami doit indiquer jetson.
```

## Partie 2: Trouver le conteneur Docker ROS2

Sur le Jetson:

```bash
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
```

Résultat attendu:

Vous devez trouver un conteneur dont l'image ressemble à:

```text
rosmaster-m3pro-nano
```

Notez le nom du conteneur:

```text
Nom de mon conteneur: __________________________
```

Exemple possible:

```text
vibrant_lehmann
```

Dans les commandes suivantes, remplacez `NOM_CONTENEUR` par le nom réel.

## Partie 3: Entrer dans Docker avec le bon environnement

Toujours sur le Jetson:

```bash
docker exec -it \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -e DISPLAY=:0 \
  NOM_CONTENEUR \
  bash
```

Pourquoi ces variables sont importantes:

```text
ROS_DOMAIN_ID=30
```

permet d'être sur le même domaine ROS que le robot.

```text
FASTDDS_BUILTIN_TRANSPORTS=UDPv4
```

évite un problème courant avec FastDDS et Docker: parfois les noeuds se voient,
mais les messages ne passent pas correctement.

```text
DISPLAY=:0
```

permet de lancer RViz sur l'écran du Jetson.

## Partie 4: Sourcer les workspaces ROS2

Dans le conteneur Docker:

```bash
source /opt/ros/humble/setup.bash
```

Puis:

```bash
source /root/yahboomcar_ws/install/setup.bash 2>/dev/null || true
source /root/M3Pro_ws/install/setup.bash 2>/dev/null || true
source /root/m3pro_teacher_ws/install/setup.bash
```

Vérifiez que ROS2 répond:

```bash
ros2 pkg list | grep m3pro_teacher
```

Résultat attendu:

```text
m3pro_teacher_demos
m3pro_teacher_description
```

## Partie 5: Vérifier les topics capteurs

Dans Docker:

```bash
ros2 topic list -t | sort
```

Cherchez au minimum:

```text
/scan0 [sensor_msgs/msg/LaserScan]
/scan1 [sensor_msgs/msg/LaserScan]
/rgb [std_msgs/msg/ColorRGBA]
/beep [std_msgs/msg/UInt16]
```

Si la caméra est déjà lancée, vous devez aussi voir:

```text
/camera/color/image_raw [sensor_msgs/msg/Image]
/camera/depth/image_raw [sensor_msgs/msg/Image]
/camera/depth/points [sensor_msgs/msg/PointCloud2]
```

Vérifiez la fréquence des lidars:

```bash
ros2 topic hz /scan0
```

Arrêtez avec `Ctrl-C`, puis:

```bash
ros2 topic hz /scan1
```

Question:

```text
Quel type de message utilise un lidar 2D dans ROS2 ?
```

Réponse attendue:

```text
sensor_msgs/msg/LaserScan
```

## Partie 6: Lancer la caméra manuellement si nécessaire

Si `/camera/color/image_raw` n'apparaît pas, ouvrez un deuxième terminal SSH.

Dans ce deuxième terminal:

```bash
ssh jetson@192.168.50.102
```

Entrez dans Docker avec le même conteneur:

```bash
docker exec -it \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -e DISPLAY=:0 \
  NOM_CONTENEUR \
  bash
```

Sourcez ROS2:

```bash
source /opt/ros/humble/setup.bash
source /root/yahboomcar_ws/install/setup.bash 2>/dev/null || true
source /root/M3Pro_ws/install/setup.bash 2>/dev/null || true
```

Lancez la caméra:

```bash
ros2 launch slam_mapping app_camera.launch.py
```

Laissez ce terminal ouvert.

Dans le premier terminal Docker, vérifiez:

```bash
ros2 topic list -t | grep camera
```

Résultat attendu:

```text
/camera/color/image_raw [sensor_msgs/msg/Image]
/camera/depth/image_raw [sensor_msgs/msg/Image]
/camera/depth/points [sensor_msgs/msg/PointCloud2]
```

Question:

```text
Pourquoi doit-on laisser le terminal caméra ouvert ?
```

Réponse attendue:

```text
Parce que le launch démarre des noeuds. Si on arrête le launch, les topics de
caméra disparaissent.
```

## Partie 7: Observer TF2

Dans un terminal Docker où les workspaces sont sourcés:

```bash
ros2 run tf2_ros tf2_echo base_link scan0_frame
```

Résultat attendu:

Vous devez voir une translation et une rotation entre `base_link` et
`scan0_frame`.

Arrêtez avec `Ctrl-C`, puis testez:

```bash
ros2 run tf2_ros tf2_echo base_link scan1_frame
```

Puis:

```bash
ros2 run tf2_ros tf2_echo base_link camera_color_optical_frame
```

Questions:

```text
Que représente base_link ?
```

```text
Pourquoi scan1_frame est-il orienté différemment de scan0_frame ?
```

Réponses attendues:

```text
base_link est le repère principal du robot.
```

```text
scan1_frame correspond au lidar arrière. Il doit être tourné pour que ses
mesures soient comprises correctement dans le repère du robot.
```

## Partie 8: Ouvrir et comprendre l'URDF

Dans Docker:

```bash
cd /root/m3pro_teacher_ws
sed -n '1,220p' src/m3pro_teacher_description/urdf/m3pro_teacher.urdf.xacro
```

Cherchez:

```text
base_link
scan0_frame
scan1_frame
camera_link
camera_color_optical_frame
base_yaw_joint
shoulder_joint
elbow_joint
left_finger_joint
right_finger_joint
```

Question:

```text
Quelle est la différence entre un link et un joint en URDF ?
```

Réponse attendue:

```text
Un link est une pièce rigide du robot. Un joint est la connexion entre deux
links.
```

Question:

```text
Est-ce que l'URDF contrôle directement les moteurs ?
```

Réponse attendue:

```text
Non. L'URDF décrit le robot. Il ne commande pas les moteurs.
```

## Partie 9: Lancer RViz avec le modèle URDF

Assurez-vous que VNC est ouvert sur votre ordinateur:

```text
vnc://192.168.50.102:5900
```

Dans Docker:

```bash
ros2 launch m3pro_teacher_description urdf_rviz_demo.launch.py rviz:=true gui:=true
```

Ce que vous devez voir:

- RViz s'ouvre sur l'écran du Jetson.
- Un modèle simplifié du robot apparaît.
- Des axes TF apparaissent.
- Une fenêtre de sliders `joint_state_publisher_gui` peut apparaître.

Essayez de bouger les sliders.

Question:

```text
Quel noeud transforme les valeurs d'articulations en TF ?
```

Réponse attendue:

```text
robot_state_publisher
```

Question:

```text
Pourquoi RViz est utile ici ?
```

Réponse attendue:

```text
RViz permet de vérifier visuellement le modèle, les repères TF et les données
capteurs.
```

Arrêtez ce launch avec `Ctrl-C` avant de passer à la suite.

## Partie 10: Comprendre le pont /arm6_joints vers /teacher/joint_states

Affichez le code:

```bash
sed -n '1,180p' src/m3pro_teacher_demos/m3pro_teacher_demos/arm_joint_state_bridge_demo.py
```

Cherchez:

```text
/arm6_joints
/teacher/joint_states
deg_to_rad_centered
```

Question:

```text
Pourquoi a-t-on besoin d'un pont entre /arm6_joints et /teacher/joint_states ?
```

Réponse attendue:

```text
/arm6_joints est un topic spécifique Yahboom. /teacher/joint_states est un
format standard pour visualiser les articulations avec robot_state_publisher.
```

Optionnel, si l'enseignant autorise le mouvement:

```bash
ros2 topic pub --once /arm6_joints arm_msgs/msg/ArmJoints \
"{joint1: 90, joint2: 120, joint3: 10, joint4: 20, joint5: 90, joint6: 30, time: 700}"
```

Puis:

```bash
ros2 topic pub --once /arm6_joints arm_msgs/msg/ArmJoints \
"{joint1: 90, joint2: 120, joint3: 10, joint4: 20, joint5: 90, joint6: 90, time: 700}"
```

Ce que vous devez voir:

- La pince s'ouvre puis se ferme.
- Si RViz est lancé avec la démo live, les doigts doivent aussi bouger dans RViz.

## Partie 11: Lancer la fusion de capteurs manuellement

Ouvrez un terminal Docker propre avec les workspaces sourcés.

Lancez la démo live:

```bash
ros2 launch m3pro_teacher_demos live_showcase.launch.py \
  rviz:=true \
  camera_topic:=/camera/color/image_raw
```

Ce que vous devez voir:

- RViz s'ouvre.
- Le robot apparaît.
- Le scan fusionné `/teacher/scan_merged` apparaît.
- Les données viennent des vrais topics `/scan0`, `/scan1` et
  `/camera/color/image_raw`.
- La LED RGB change selon la situation.
- Le robot ne doit pas biper.

Dans un autre terminal Docker, observez l'état de fusion:

```bash
ros2 topic echo /teacher/fusion_state
```

Approchez un objet du lidar avant ou arrière.

Résultat attendu:

```text
nearest=0.27m; camera=balanced; rgb=lidar danger
```

ou:

```text
nearest=0.72m; camera=green dominant; rgb=lidar caution
```

Question:

```text
Pourquoi le lidar gagne sur la caméra quand un obstacle est proche ?
```

Réponse attendue:

```text
Parce que la distance obstacle est une information de sécurité. La couleur de
la caméra est moins importante qu'un obstacle proche.
```

## Partie 12: Lire le code de fusion

Dans Docker:

```bash
sed -n '1,340p' src/m3pro_teacher_demos/m3pro_teacher_demos/sensor_fusion_rgb_demo.py
```

Cherchez:

```text
front_scan_topic
rear_scan_topic
camera_topic
danger_distance_m
caution_distance_m
enable_beep
merge_scans
analyze_camera
choose_reaction
publish_rgb
```

Questions:

```text
Quel topic est publié pour visualiser le scan fusionné ?
```

Réponse:

```text
/teacher/scan_merged
```

```text
Quel topic est publié pour expliquer la décision ?
```

Réponse:

```text
/teacher/fusion_state
```

```text
Quel topic commande la LED RGB du robot ?
```

Réponse:

```text
/rgb
```

## Partie 13: Modifier un paramètre de fusion

Arrêtez le launch live avec `Ctrl-C`.

Relancez avec un seuil de danger plus grand:

```bash
ros2 launch m3pro_teacher_demos live_showcase.launch.py \
  rviz:=true \
  camera_topic:=/camera/color/image_raw \
  danger_distance_m:=0.60
```

Pour comprendre pourquoi cette commande fonctionne, ouvrez le fichier launch:

```bash
sed -n '1,120p' src/m3pro_teacher_demos/launch/live_showcase.launch.py
```

Cherchez où `danger_distance_m` est déclaré, puis où il est transmis au noeud
`sensor_fusion_rgb_demo`.

Observation attendue:

```text
Le robot passe plus tôt en état danger parce que le seuil est plus grand.
```


## Partie 14: Vérifier que le buzzer reste désactivé

Dans un terminal Docker:

```bash
ros2 topic info /beep
```

La démo peut créer un publisher `/beep`, mais elle ne doit pas envoyer de bips
tant que:

```text
enable_beep = false
```

Si le robot bipe, forcez l'arrêt:

```bash
ros2 topic pub --once -w 0 /beep std_msgs/msg/UInt16 "{data: 0}"
```

## Partie 15: Nettoyage

Arrêtez les launches avec `Ctrl-C` dans les terminaux correspondants.

Vérifiez les processus restants:

```bash
ps -ef | grep -E 'm3pro_teacher|rviz2|sensor_fusion' | grep -v grep
```

S'il reste un RViz lancé par votre groupe:

```bash
pkill -TERM -x rviz2
```

## Défi bonus

Choisissez une amélioration:

1. Ajouter une règle: si la caméra voit une image sombre, mettre la LED en bleu.
2. Ajouter `/camera/depth/points` dans RViz.
3. Changer `caution_distance_m` et observer l'effet.
4. Ajouter un nouveau message dans `/teacher/fusion_state`.
5. Expliquer ce qui se passe si `scan1_frame` est orienté dans le mauvais sens.
