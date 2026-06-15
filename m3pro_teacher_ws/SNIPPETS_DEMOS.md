# Extraits de code : paquet `m3pro_teacher_demos`

Objectif : repérer rapidement les parties importantes de chaque noeud prêt
à l'emploi dans le paquet `m3pro_teacher_demos`.

Chemin du paquet :

```text
src/m3pro_teacher_demos/m3pro_teacher_demos/
├── sensor_fusion_rgb_demo.py
├── frontier_explorer_demo.py
├── arm_joint_state_bridge_demo.py
└── tf2_sensor_frames_demo.py
```

Chaque section suit le même plan : rôle du noeud, topics d'entrée/sortie,
extraits de code commentés, paramètres clés.

---

## 1. `sensor_fusion_rgb_demo.py` — Fusion des lidars et réaction LED

**Rôle** : combiner les deux lidars 2D (avant + arrière) en un scan 360°
unique, lire une couleur moyenne de la caméra, et réagir avec la LED RGB.

**Flux** :

```text
/scan0  ─┐
         ├─→ fusion 360° → /teacher/scan_merged
/scan1  ─┘
                    │
/camera/color/... ──┼─→ choix d'une couleur de LED
                    │
                    └─→ /rgb  (commande LED)
                        /teacher/fusion_state  (texte explicatif)
```

### Partie importante 1 : déclaration des topics

```python
# fichier: sensor_fusion_rgb_demo.py, ligne ~51
self.merged_scan_pub = self.create_publisher(LaserScan, "/teacher/scan_merged", 10)
self.state_pub = self.create_publisher(String, "/teacher/fusion_state", 10)
self.rgb_pub = self.create_publisher(ColorRGBA, "/rgb", 10)
self.beep_pub = self.create_publisher(UInt16, "/beep", 10)

self.create_subscription(LaserScan, self.front_scan_topic,
                         lambda msg: self.store_scan("front", msg), 10)
self.create_subscription(LaserScan, self.rear_scan_topic,
                         lambda msg: self.store_scan("rear", msg), 10)
```

> À retenir : `/teacher/scan_merged` est le topic de sortie consommé par
> slam_toolbox et Nav2. C'est le coeur de l'exercice.

### Partie importante 2 : fusion des deux scans

```python
# fichier: sensor_fusion_rgb_demo.py, méthode merge_scans, ligne ~153
angle_min = -math.pi
angle_max = math.pi
angle_increment = math.radians(1.0)
count = int(round((angle_max - angle_min) / angle_increment)) + 1
merged_ranges = [float("inf") for _ in range(count)]

for _name, scan, yaw_offset in scan_sources:
    for angle, distance in finite_ranges(scan):
        # Décaler l'angle selon la position du lidar (avant=0, arrière=pi)
        merged_angle = math.atan2(math.sin(angle + yaw_offset),
                                  math.cos(angle + yaw_offset))
        index = int(round((merged_angle - angle_min) / angle_increment))
        if 0 <= index < count and distance < merged_ranges[index]:
            merged_ranges[index] = distance
```

> Idée : chaque lidar voit 180°. On les place dans un même tableau de 360
> cases, en les décalant de leur orientation (avant = 0 rad, arrière = π).
> Quand deux lidars voient le même angle, on garde la distance la plus
> courte.

### Partie importante 3 : réaction selon la couleur dominante

```python
# fichier: sensor_fusion_rgb_demo.py, méthode choose_reaction, ligne ~249
if nearest is not None and nearest < self.danger_distance_m:
    return (255.0, 0.0, 0.0, 100.0), "lidar danger"        # rouge
if nearest is not None and nearest < self.caution_distance_m:
    return (255.0, 210.0, 0.0, 100.0), "lidar caution"     # jaune
if camera_summary == "red dominant":
    return (255.0, 0.0, 0.0, 100.0), "camera red"
if camera_summary == "green dominant":
    return (0.0, 255.0, 0.0, 100.0), "camera green"
# ...
return (0.0, 255.0, 90.0, 100.0), "clear"                  # vert
```

> Priorité : lidar d'abord (sécurité), caméra ensuite (information).

### Paramètres clés (modifiables au lancement)

```text
front_scan_topic       : /scan0              topic du lidar avant
rear_scan_topic        : /scan1              topic du lidar arrière
front_yaw              : 0.0                 orientation avant (rad)
rear_yaw               : 3.14159             orientation arrière (rad)
danger_distance_m      : 0.35                seuil rouge (m)
caution_distance_m     : 0.80                seuil jaune (m)
enable_beep            : false               désactivé pour les cours
```

---

## 2. `frontier_explorer_demo.py` — Exploration autonome type Roomba

**Rôle** : analyser la carte en cours de construction, trouver les
frontières (libre / inconnu) et envoyer automatiquement le robot les
explorer.

**Flux** :

```text
/map (OccupancyGrid) ──┐
                       ├─→ analyse frontières → /goal_pose (PoseStamped)
/odom (Odometry)    ───┘
```

### Partie importante 1 : détecter les frontières

```python
# fichier: frontier_explorer_demo.py, méthode find_and_go_to_frontier, ligne ~123
# Une cellule frontière = cellule libre (0) voisine d'une cellule inconnue (-1)
frontier_cells = []
for y in range(1, h - 1):
    for x in range(1, w - 1):
        idx = y * w + x
        if data[idx] != self.FREE:       # 0 = libre
            continue
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ni = (y + dy) * w + (x + dx)
            if data[ni] == self.UNKNOWN:  # -1 = inconnu
                frontier_cells.append((x, y))
                break
```

> Idée : on scanne la grille et on note les cellules libres qui touchent
> au moins un voisin inconnu. Ce sont les "portes" vers le non-cartographié.

### Partie importante 2 : choix de la frontière cible

```python
# fichier: frontier_explorer_demo.py, ligne ~201
best = None
best_score = float("inf")
for cx, cy, size in centroids:
    dist = math.hypot(cx - self.robot_x, cy - self.robot_y)
    # Score : plus proche est mieux, frontière plus grande bonifiée
    score = dist - 0.02 * size
    if score < best_score:
        best_score = score
        best = (cx, cy, size)
```

> Heuristique : on préfère les frontières proches, mais on donne un bonus
> aux grosses frontières (plus d'inconnu à découvrir).

### Partie importante 3 : détection d'un robot bloqué

```python
# fichier: frontier_explorer_demo.py, méthode explore_tick, ligne ~91
moved = math.hypot(self.robot_x - self.last_x, self.robot_y - self.last_y)
elapsed = (self.get_clock().now() - self.last_progress_time).nanoseconds / 1e9

if moved > 0.1:
    self.last_progress_time = self.get_clock().now()
    self.last_x = self.robot_x
    self.last_y = self.robot_y
elif elapsed > self.stuck_timeout:          # par défaut 20 s
    self.get_logger().warning("Robot seems stuck, picking a different frontier...")
    self.current_goal = None
```

> Si le robot n'a pas bougé depuis 20 secondes, on abandonne la frontière
> courante et on en choisit une autre.

### Partie importante 4 : envoi d'un objectif Nav2

```python
# fichier: frontier_explorer_demo.py, méthode send_goal, ligne ~227
msg = PoseStamped()
msg.header.frame_id = "map"
msg.header.stamp = self.get_clock().now().to_msg()
msg.pose.position.x = x
msg.pose.position.y = y
msg.pose.orientation.w = 1.0        # quaternion nul = pas de rotation imposée
self.goal_pub.publish(msg)
```

### Paramètres clés

```text
min_frontier_size   : 8      # ignorer les frontières < 8 cellules (bruit)
goal_tolerance      : 0.4    # considéré "arrivé" à moins de 40 cm
stuck_timeout       : 20.0   # secondes avant d'abandonner
replan_interval     : 5.0    # fréquence de replanification
```

---

## 3. `arm_joint_state_bridge_demo.py` — Pont bras Yahboom ↔ URDF

**Rôle** : traduire les messages Yahboom `/arm6_joints` (degrés, 0-180) en
messages ROS standard `JointState` (radians), pour que RViz puisse
afficher le modèle URDF du bras.

**Flux** :

```text
/arm6_joints (ArmJoints) ──→ conversion ──→ /teacher/joint_states (JointState)
```

### Partie importante 1 : noms des articulations

```python
# fichier: arm_joint_state_bridge_demo.py, ligne 15
JOINT_NAMES = [
    "base_yaw_joint",       # rotation de base (Z)
    "shoulder_joint",       # épaule (Y)
    "elbow_joint",          # coude (Y)
    "wrist_pitch_joint",    # inclinaison poignet (Y)
    "wrist_roll_joint",     # rotation pince (X)
    "left_finger_joint",    # doigt gauche (linéaire)
    "right_finger_joint",   # doigt droit (linéaire)
]
```

### Partie importante 2 : conversion degrés Yahboom → radians URDF

```python
# fichier: arm_joint_state_bridge_demo.py, ligne ~30
def deg_to_rad_centered(degrees, center=90.0):
    # Yahboom : 0-180 degrés, 90 = position centrale
    # URDF    : radians, 0 = position centrale
    return math.radians(float(degrees) - center)
```

> Formule clé : `radians = (servo_degrés - 90) * π/180`.

### Partie importante 3 : conversion pince (servo → mètres)

```python
# fichier: arm_joint_state_bridge_demo.py, ligne ~76
# Le servo pince va de 30 (ouvert) à 90 (fermé).
# On le convertit en une ouverture en mètres de 0 à 4 cm.
gripper_open_m = clamp((90.0 - float(joint6)) / 60.0 * 0.04, 0.0, 0.04)
```

### Paramètres clés

```text
arm_topic            : /arm6_joints            topic d'entrée (Yahboom)
joint_states_topic   : /teacher/joint_states   topic de sortie (standard)
publish_rate_hz      : 20.0                    fréquence
demo_motion          : false                   si true, anime en démo
```

---

## 4. `tf2_sensor_frames_demo.py` — Repères TF pédagogiques

**Rôle** : publier des transformations statiques pour les capteurs
(lidars, caméra, bras) afin que RViz et les algos puissent situer les
mesures dans l'espace.

### Partie importante 1 : les transformations statiques

```python
# fichier: tf2_sensor_frames_demo.py, méthode publish_static_frames, ligne ~74
transforms = [
    # lidar avant : +17 cm en X, +11 cm en Z, orientation 0
    make_transform(now, "base_link", "scan0_frame", (0.17, 0.0, 0.11),  (0.0, 0.0, 0.0)),
    # lidar arrière : -17 cm en X, +11 cm en Z, orientation pi (retourné)
    make_transform(now, "base_link", "scan1_frame", (-0.17, 0.0, 0.11), (0.0, 0.0, pi)),
    # caméra : +18 cm en X, +23 cm en Z
    make_transform(now, "base_link", "camera_link", (0.18, 0.0, 0.23),  (0.0, 0.0, 0.0)),
    # repère optique de la caméra (X droite, Y bas, Z avant)
    make_transform(now, "camera_link", "camera_color_optical_frame",
                   (0.025, 0.0, 0.0), (-pi/2, 0.0, -pi/2)),
    # base du bras
    make_transform(now, "base_link", "arm_base_link", (0.02, 0.0, 0.105), (0.0, 0.0, 0.0)),
]
self.static_broadcaster.sendTransform(transforms)
```

> À retenir : les translations sont en mètres, les rotations en radians
> (roll, pitch, yaw). Ces valeurs proviennent des dimensions physiques du
> M3 Pro.

### Partie importante 2 : conversion Euler → quaternion

```python
# fichier: tf2_sensor_frames_demo.py, ligne ~12
def quaternion_from_euler(roll, pitch, yaw):
    cr = math.cos(roll * 0.5);  sr = math.sin(roll * 0.5)
    cp = math.cos(pitch * 0.5); sp = math.sin(pitch * 0.5)
    cy = math.cos(yaw * 0.5);   sy = math.sin(yaw * 0.5)
    return (
        sr * cp * cy - cr * sp * sy,   # qx
        cr * sp * cy + sr * cp * sy,   # qy
        cr * cp * sy - sr * sp * cy,   # qz
        cr * cp * cy + sr * sp * sy,   # qw
    )
```

> TF2 stocke les rotations en quaternions. Cette fonction fait la
> conversion depuis les angles d'Euler (plus intuitifs à écrire).

### Vérification

```bash
# Après lancement, on peut inspecter les repères :
ros2 run tf2_ros tf2_echo base_link scan0_frame
ros2 run tf2_ros tf2_echo base_link camera_color_optical_frame
```
