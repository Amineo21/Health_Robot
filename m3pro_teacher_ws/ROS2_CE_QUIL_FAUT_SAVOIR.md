# ROS 2 — Ce qu'il faut savoir

Document de référence couvrant l'ensemble du cours : qu'est-ce que ROS,
philosophie, vocabulaire, outils, et la configuration spécifique du robot
Yahboom M3 Pro utilisé en TP.

---

## Partie 1 — Qu'est-ce que ROS ?

### 1.1 Petite histoire

| Année  | Évènement                                                                  |
|--------|----------------------------------------------------------------------------|
| 2007   | Naissance à **Stanford** puis **Willow Garage**.                           |
| 2010   | ROS 1 "Box Turtle" — première version stable.                              |
| 2017   | Début de **ROS 2** (réécriture complète, basée sur **DDS**).               |
| 2022   | **ROS 2 Humble** — version **LTS** utilisée dans ce cours.                 |
| 2024   | ROS 1 est **en fin de vie** (End of Life). Tout le monde passe à ROS 2.   |

### 1.2 Ce que ROS **EST**

1. Un **middleware** — une couche logicielle entre le système
   d'exploitation et les programmes, qui leur permet de communiquer.
2. Un **framework** avec des outils prêts à l'emploi (RViz, rqt, rosbag…).
3. Un **standard d'interfaces** : tout le monde utilise les mêmes types
   de messages (`LaserScan`, `Image`, `Twist`…) → les composants sont
   interchangeables.
4. Un **écosystème de paquets** open-source (Nav2, MoveIt, slam_toolbox,
   Foxglove, etc.).
5. Une **communauté** (ROS Discourse, ROS Wiki, ROSCon…).

### 1.3 Ce que ROS **N'EST PAS**

- Ce **n'est pas un système d'exploitation** malgré son nom (*Robot
  Operating System*). ROS tourne **au-dessus** de Linux, typiquement
  Ubuntu.
- Ce **n'est pas un langage de programmation**. On écrit du C++ ou du
  Python qui utilise les bibliothèques `rclcpp` / `rclpy`.
- Ce **n'est pas un simulateur**. Gazebo en est un, complémentaire.
- Ce **n'est pas un framework temps réel dur** (ROS 2 s'en approche mais
  ne le garantit pas par défaut).

### 1.4 ROS 1 vs ROS 2 — l'essentiel

| Aspect              | ROS 1                             | ROS 2                                   |
|---------------------|-----------------------------------|-----------------------------------------|
| Communication       | `roscore` central (master)        | **DDS** décentralisé (Fast DDS, Cyclone)|
| Tolérance au réseau | Fragile                           | Solide, temps-réel partiel              |
| Plateformes         | Ubuntu surtout                    | Ubuntu, macOS, Windows, temps-réel      |
| QoS (fiabilité)     | Absent                            | Présent                                 |
| Lifecycle           | Absent                            | Présent (nodes gérés)                   |
| Sécurité            | Absente                           | Support DDS Security                    |

---

## Partie 2 — Philosophie de ROS

Cinq principes à avoir en tête :

### 2.1 Un robot = un **graphe de nodes**

Un robot n'est pas **un** programme, c'est **des dizaines** de petits
programmes (*nodes*) qui tournent en parallèle et se parlent. Chacun
fait **une seule chose**.

### 2.2 Couplage **faible** (loose coupling)

Les nodes **ne se connaissent pas directement**. Ils publient et
souscrivent à des *topics* — un peu comme une radio : l'émetteur ignore
qui l'écoute.

**Conséquence pratique :** changer de lidar = changer un driver. Le reste
du système ne bouge pas tant que le topic `sensor_msgs/LaserScan` est
respecté.

### 2.3 Langage **agnostique**

ROS 2 supporte officiellement :
- **C++** (bibliothèque `rclcpp`) — pour les nodes critiques en perf.
- **Python** (bibliothèque `rclpy`) — pour prototyper et scripter.

Un node Python peut parler à un node C++ sans aucun effort : les
messages sont sérialisés de la même manière.

### 2.4 **Distribué** par défaut

Plusieurs machines sur le même réseau peuvent former **un seul graphe**.
Votre ordinateur peut lancer RViz pendant que le robot fait tourner le
SLAM — tant qu'ils ont le même `ROS_DOMAIN_ID` et peuvent s'atteindre
sur le réseau.

### 2.5 **Open-source** et standardisé

La grande majorité des paquets sont sur GitHub sous licence BSD/Apache.
`apt install ros-humble-nav2-bringup` et on a toute une pile de
navigation professionnelle en 30 secondes.

---

## Partie 3 — Vocabulaire

Ce sont les mots à maîtriser avant d'aller plus loin.

### 3.1 Communication

| Terme        | Définition                                                          |
|--------------|---------------------------------------------------------------------|
| **Node**     | Processus qui participe au graphe ROS. Publie et/ou souscrit.       |
| **Topic**    | Canal **pub/sub** typé, asynchrone, multi-producteur/consommateur.  |
| **Message**  | Structure typée échangée sur un topic (ex: `geometry_msgs/Twist`).  |
| **Service**  | Appel **synchrone** request/response (un client, un serveur).       |
| **Action**   | Tâche **longue** avec feedback continu et annulation (ex: Nav2 goal).|
| **Parameter**| Clé-valeur attachée à un node (réglable via YAML, CLI, ou runtime). |

> **Topic vs Service vs Action en une phrase :**
> Topic = *flux continu*. Service = *appel court*. Action = *tâche longue*.

### 3.2 Organisation du code

| Terme           | Définition                                                          |
|-----------------|---------------------------------------------------------------------|
| **Package**     | Unité de code (`package.xml` + code + launch + config).             |
| **Workspace**   | Ensemble de paquets compilés ensemble (`src/`, `build/`, `install/`).|
| **`colcon`**    | Outil de build de ROS 2 (remplace `catkin_make` de ROS 1).           |
| **Launch file** | Script Python (`.launch.py`) qui démarre plusieurs nodes + config.   |
| **Bag**         | Enregistrement rejouable de topics (`.db3` en ROS 2).                |

### 3.3 Géométrie et description du robot

| Terme                     | Définition                                                  |
|---------------------------|-------------------------------------------------------------|
| **Frame**                 | Repère 3D (ex: `map`, `base_link`, `camera_link`).           |
| **TF / tf2**              | Arbre des transformations entre frames, maintenu en continu. |
| **URDF**                  | Fichier XML décrivant les *links* et *joints* du robot.      |
| **`robot_state_publisher`**| Lit l'URDF + les `JointState`, publie toutes les TF internes.|

### 3.4 Concepts avancés

| Terme              | Définition                                                       |
|--------------------|------------------------------------------------------------------|
| **DDS**            | *Data Distribution Service* — couche réseau pub/sub de ROS 2.    |
| **QoS**            | Politique qui règle fiabilité, durabilité, historique d'un topic.|
| **Lifecycle node** | Node géré par une machine à états (unconfigured → inactive → active). |
| **Managed**        | Géré par un `lifecycle_manager` (c'est le cas de Nav2).          |

---

## Partie 4 — Anatomie d'un node Python

Le plus petit node publieur qu'on puisse écrire :

```python
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class HelloNode(Node):
    def __init__(self):
        super().__init__("hello_node")                       # nom du node
        self.pub = self.create_publisher(String, "/hello", 10)
        self.create_timer(1.0, self.tick)                    # 1 Hz

    def tick(self):
        msg = String()
        msg.data = "hello world"
        self.pub.publish(msg)

def main():
    rclpy.init()
    rclpy.spin(HelloNode())
    rclpy.shutdown()
```

À retenir :

1. On hérite de `Node`.
2. On crée des publishers, subscribers, timers dans `__init__`.
3. `rclpy.spin(node)` = boucle d'événements qui fait tourner les
   callbacks. Sans elle, rien ne s'exécute.

---

## Partie 5 — Outils en ligne de commande

L'outil principal : **`ros2`**, décliné en sous-commandes.

### 5.1 Explorer le graphe actif

```bash
ros2 node list                     # tous les nodes actifs
ros2 node info /<node>             # détail : pubs, subs, services, actions
ros2 topic list                    # tous les topics actifs
ros2 topic info /<topic> -v        # type, publishers, subscribers
ros2 topic type /<topic>           # type de message
ros2 interface show <type>         # structure d'un message
ros2 service list
ros2 action list
ros2 param list
```

### 5.2 Observer les données

```bash
ros2 topic echo /<topic>                  # lire en continu
ros2 topic echo /<topic> --once           # un seul message
ros2 topic hz /<topic>                    # fréquence de publication
ros2 topic bw /<topic>                    # bande passante
ros2 run tf2_ros tf2_echo <parent> <child>  # TF en live
```

### 5.3 Injecter des données

```bash
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}}"
ros2 service call /<srv> <type> "{...}"
ros2 action send_goal /<act> <type> "{...}" --feedback
```

### 5.4 Lancer et builder

```bash
ros2 run <pkg> <exec>                  # un seul node
ros2 launch <pkg> <file>.launch.py     # plusieurs nodes + config
colcon build --symlink-install         # compiler le workspace
colcon build --packages-select <pkg>   # un seul paquet
source install/setup.bash              # charger l'environnement
```

### 5.5 Outils graphiques

| Outil                         | Usage                                                  |
|-------------------------------|--------------------------------------------------------|
| **RViz 2**                    | Visualisation 3D : TF, carte, scans, costmaps.         |
| **rqt**                       | Boîte à outils (graph, plot, reconfigure, image view). |
| **Foxglove Studio**           | Dashboard moderne (remplace RViz pour beaucoup).        |
| **rosbag2** (`ros2 bag record`) | Enregistrement et rejeu des topics.                   |

---

## Partie 6 — L'arbre TF

`tf2` est omniprésent en ROS 2. Sans lui, on ne peut pas passer d'un
repère à un autre (*« cet obstacle détecté par la caméra, où est-il sur
la carte ? »*).

### 6.1 Convention standard

```
map                              (repère fixe, le monde)
 └── odom                        (fixe mais dérive dans le temps)
      └── base_footprint         (projection du robot au sol)
           └── base_link         (corps du robot)
                ├── camera_link → camera_color_optical_frame
                ├── laser_front → laser_back
                └── arm_base → shoulder → elbow → wrist → gripper
```

### 6.2 Qui publie quoi ?

| TF                           | Publié par                                    |
|------------------------------|-----------------------------------------------|
| `map → odom`                 | **SLAM** (`slam_toolbox`) ou **AMCL**.         |
| `odom → base_footprint`      | Odométrie des roues (+ fusion IMU via EKF).    |
| `base_link → *` (liens fixes)| `robot_state_publisher` depuis l'URDF.         |
| `base_link → arm_*`          | `robot_state_publisher` + `JointState` du bras.|

### 6.3 TF statique vs dynamique

- **Statique** : relation qui ne change jamais (caméra boulonnée au
  robot). Publiée une seule fois sur `/tf_static`.
- **Dynamique** : relation qui bouge (position du robot, articulations
  du bras). Publiée continûment sur `/tf`.

---

## Partie 7 — URDF : décrire un robot

Un fichier URDF (*Unified Robot Description Format*) est du XML qui
décrit :

- Les **links** (corps rigides : base, roues, bras, caméra).
- Les **joints** (articulations entre links).
- Les **geometries** (formes visuelles + collision).
- Les **inertials** (masse, inertie).

### Types de joints

| Type         | Mouvement                       | Exemple                      |
|--------------|---------------------------------|------------------------------|
| `fixed`      | Aucun                           | Caméra boulonnée             |
| `revolute`   | Rotation limitée                | Articulation de bras         |
| `continuous` | Rotation infinie                | Roue de robot                |
| `prismatic`  | Translation                     | Vis sans fin, vérin          |

Le node `robot_state_publisher` lit cet URDF et, à partir des positions
reçues sur `/joint_states`, **publie toutes les TF** entre les links.
C'est **lui** qui permet à RViz d'afficher le robot en 3D.

---

## Partie 8 — QoS : la qualité de service

Chaque publisher/subscriber ROS 2 a une **politique QoS**. Trois champs
importants :

| Champ         | Valeurs courantes            | Quand l'utiliser ?                                   |
|---------------|------------------------------|------------------------------------------------------|
| `reliability` | `reliable` / `best_effort`   | `best_effort` pour capteurs (on peut perdre des msg).|
| `durability`  | `volatile` / `transient_local` | `transient_local` pour `/map`, `/tf_static`.      |
| `history`     | `keep_last(N)` / `keep_all`  | `keep_last(10)` par défaut.                          |

**Piège classique :** un publisher `reliable` et un subscriber
`best_effort` **ne peuvent pas se connecter**. Utiliser
`qos_profile_sensor_data` des deux côtés pour les capteurs.

---

## Partie 9 — La configuration Yahboom M3 Pro

C'est le matériel sur lequel tout le cours est basé.

### 9.1 Matériel

```
  ┌────────────────────────────────────────────────────────────┐
  │                   Yahboom ROSMASTER M3 Pro                 │
  │                                                            │
  │  Roues Mecanum × 4 (déplacement omnidirectionnel)          │
  │  Lidar avant 180° (scan0)                                  │
  │  Lidar arrière 180° (scan1)                                │
  │  Caméra RGB-D Astra (color + depth)                        │
  │  Bras 6 DOF (5 rotations + 1 pince)                        │
  │  IMU 6 axes                                                │
  │  LED RGB + Buzzer                                          │
  │                                                            │
  │  Jetson Nano (CPU ARM + GPU, 4 Go RAM)                     │
  │  STM32 (microcontrôleur bas niveau)                        │
  └────────────────────────────────────────────────────────────┘
```

### 9.2 Architecture logicielle

```
┌───────────────────────────────────────────────────────────────┐
│  Jetson Nano — Ubuntu 18.04                                   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Container Docker "rosmaster-m3pro-nano"               │   │
│  │    ROS 2 Humble                                        │   │
│  │    - /opt/ros/humble         (core ROS 2)              │   │
│  │    - /root/yahboomcar_ws     (driver Yahboom)          │   │
│  │    - /root/M3Pro_ws          (bringup M3 Pro)          │   │
│  │    - /root/m3pro_teacher_ws  (paquets du cours)        │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            │ UART / micro-ROS                 │
│                            ▼                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Container Docker "micro-ros-agent"                    │   │
│  │    Fait le pont entre ROS 2 et le STM32.               │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            │ UART                              │
│                            ▼                                  │
│                  STM32  ─── moteurs, servos, IMU, LED         │
└───────────────────────────────────────────────────────────────┘
```

**À retenir :**
- **Tout tourne dans Docker.** On ne lance jamais `ros2` directement sur
  l'hôte Jetson.
- Le **microcontrôleur STM32** gère le bas niveau (moteurs, servos,
  capteurs). Il parle à Linux via **micro-ROS** (un pont UART).
- **Trois workspaces empilés** : Yahboom (fourni), M3Pro (intégration),
  m3pro_teacher (notre cours).

### 9.3 Réseau et accès

| Paramètre                 | Valeur                  | Rôle                                   |
|---------------------------|-------------------------|----------------------------------------|
| IP typique du robot        | `192.168.50.102`        | Dépend du réseau TP.                   |
| `ROS_DOMAIN_ID`           | `30`                    | Isole le graphe ROS (0-232).            |
| `FASTDDS_BUILTIN_TRANSPORTS`| `UDPv4`              | Force UDPv4 (évite multicast wifi).    |
| Port SSH                  | `22`                    | `ssh jetson@192.168.50.102`            |
| Port VNC                  | `5900`                  | Pour voir RViz sur l'écran du Jetson.  |
| Port rosbridge            | `9090`                  | Dashboard web (WebSocket JSON).         |
| Port foxglove_bridge      | `8765`                  | Foxglove Studio.                        |
| Port dashboard HTTP       | `8080`                  | Notre page web.                         |

**Commande standard pour entrer dans le container :**

```bash
ssh jetson@192.168.50.102
docker exec -it \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -e DISPLAY=:0 \
  rosmaster-m3pro-nano bash

source /opt/ros/humble/setup.bash
source /root/M3Pro_ws/install/setup.bash
source /root/m3pro_teacher_ws/install/setup.bash
```

> **Le `ROS_DOMAIN_ID` est crucial.** Si votre ordinateur est sur
> `DOMAIN_ID=0` et le robot sur `30`, ils **ne se voient pas** — même sur
> le même Wi-Fi. C'est la "séparation d'univers" de ROS 2.

### 9.4 Les topics Yahboom importants

**Capteurs (entrées) :**

| Topic                       | Type                               | Description                    |
|-----------------------------|------------------------------------|--------------------------------|
| `/scan0`                    | `sensor_msgs/LaserScan`            | Lidar avant 180°               |
| `/scan1`                    | `sensor_msgs/LaserScan`            | Lidar arrière 180°             |
| `/scan_multi`               | `sensor_msgs/LaserScan`            | Fusion 360° (ira_laser_tools)  |
| `/odom_raw`                 | `nav_msgs/Odometry`                | Odométrie brute roues (MCU)    |
| `/odom`                     | `nav_msgs/Odometry`                | Odom fusionnée par EKF         |
| `/imu`                      | `sensor_msgs/Imu`                  | IMU 6 axes                     |
| `/camera/color/image_raw`   | `sensor_msgs/Image`                | Image RGB                      |
| `/camera/depth/image_raw`   | `sensor_msgs/Image`                | Image de profondeur            |
| `/camera/color/camera_info` | `sensor_msgs/CameraInfo`           | `fx fy cx cy` de la caméra     |
| `/arm6_joints`              | `arm_msgs/ArmJoints`               | Positions actuelles du bras    |

**Actionneurs (sorties) :**

| Topic           | Type                       | Description                       |
|-----------------|----------------------------|-----------------------------------|
| `/cmd_vel`      | `geometry_msgs/Twist`      | Commande vitesse Mecanum          |
| `/arm_command`  | `arm_msgs/ArmJoints`       | Consigne articulations bras       |
| `/rgb`          | `std_msgs/ColorRGBA`       | Commande LED RGB                  |
| `/beep`         | `std_msgs/UInt16`          | Commande buzzer (**garder à 0**) |

### 9.5 La pile de traitement

Schéma de ce qui tourne typiquement en TP :

```
  STM32 ──micro-ROS──► /odom_raw, /imu_raw, capteurs battery
                              │
                              ▼
              imu_filter_madgwick ──► /imu
                              │
                              ▼
           robot_localization (EKF) ──► /odom + TF odom → base_footprint
                                                      │
  /scan0, /scan1 ──► ira_laser_tools ──► /scan_multi  │
                                          │           │
                                          ▼           │
                             slam_toolbox ──► /map + TF map → odom
                                          │
                                          ▼
                                       Nav2 ──► /cmd_vel ──► STM32
```

### 9.6 Notre workspace `m3pro_teacher_ws`

Organisation :

```
m3pro_teacher_ws/
├── src/
│   ├── m3pro_teacher_demos/        → noeuds pédagogiques Python
│   │   ├── sensor_fusion_rgb_demo  (fusion lidars simple + LED)
│   │   ├── frontier_explorer_demo  (exploration frontière maison)
│   │   ├── arm_joint_state_bridge_demo
│   │   └── tf2_sensor_frames_demo
│   ├── m3pro_teacher_description/  → URDF du robot
│   ├── m3pro_teacher_nav/          → launch + config Nav2 + SLAM
│   │   ├── launch/slam_online.launch.py
│   │   ├── launch/navigation.launch.py
│   │   ├── launch/slam_and_nav.launch.py
│   │   └── launch/explore.launch.py
│   ├── m3pro_teacher_vision/       → détection HSV + pick-and-place
│   ├── m3pro_teacher_web/          → dashboard web (rosbridge + HTML)
│   └── m-explore-ros2/             → explore_lite (exploration frontière)
└── scripts/                         → déploiement / Docker / systemd
```

Les paquets démarrent par `m3pro_teacher_` **uniquement pour le cours**.
En dehors, on croise plutôt `nav2_*`, `slam_*`, `sensor_msgs`, etc.

### 9.7 Cycle de développement sur le robot

Typiquement :

```bash
# Sur votre Mac : modifier le code dans ~/m3pro_teacher_ws/src/...

# Déployer sur le robot :
./scripts/deploy_workspace_to_robot.sh 192.168.50.102

# Sur le robot (dans le container) :
cd /root/m3pro_teacher_ws
colcon build --symlink-install --packages-select <pkg>
source install/setup.bash
ros2 launch m3pro_teacher_nav slam_online.launch.py
```

---

## Partie 10 — Pour aller plus loin

### Documentation officielle

- **docs.ros.org/en/humble** — doc ROS 2 Humble (référence).
- **docs.nav2.org** — Nav2.
- **github.com/SteveMacenski/slam_toolbox** — SLAM.
- **foxglove.dev/docs** — dashboards.

### Grands projets de l'écosystème ROS 2

| Projet           | À quoi il sert                                              |
|------------------|-------------------------------------------------------------|
| **Nav2**         | Navigation autonome (cette formation).                       |
| **MoveIt 2**     | Planification de mouvement pour bras robotiques.             |
| **slam_toolbox** | SLAM 2D moderne, loop closure, online + async.               |
| **Cartographer**| Alternative SLAM (Google).                                   |
| **ros2_control** | Framework de contrôle moteur temps réel.                     |
| **Gazebo / Ignition** | Simulateur physique officiel.                          |
| **Foxglove**     | Visualisation et debugging.                                  |
| **rosbridge**    | Pont ROS ↔ Web / autres langages.                            |
| **micro-ROS**    | ROS 2 embarqué (microcontrôleurs).                           |

### Les trois ordres de grandeur à retenir

- Un robot mobile typique fait tourner **~20 à 50 nodes** simultanément.
- Les topics haute fréquence (lidar, IMU) tournent à **10-200 Hz**.
- Une carte 10 m × 10 m en résolution 5 cm = **40 000 cellules**.

---

## Check-list « je maîtrise »

Cochez avant le TP évalué :

- [ ] Je peux expliquer ce qu'est un *node* et un *topic*.
- [ ] Je sais la différence entre service et action.
- [ ] Je connais la commande `ros2 topic list/echo/hz/pub`.
- [ ] Je sais compiler un workspace (`colcon build`).
- [ ] Je comprends ce qu'est la TF `map → odom → base_footprint`.
- [ ] Je sais ce que fait `slam_toolbox` et quel TF il publie.
- [ ] Je connais les composants de Nav2 (planner, controller, recovery).
- [ ] Je sais ce qu'est une frontière et comment `explore_lite` décide.
- [ ] Je sais entrer dans le Docker du robot et sourcer les workspaces.
- [ ] Je sais régler `ROS_DOMAIN_ID` et pourquoi c'est nécessaire.
