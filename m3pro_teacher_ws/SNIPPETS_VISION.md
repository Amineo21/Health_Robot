# Extraits de code : paquet `m3pro_teacher_vision`

Objectif : repérer les parties importantes de la détection par caméra et
du ramassage avec le bras.

Chemin du paquet :

```text
src/m3pro_teacher_vision/
├── m3pro_teacher_vision/
│   ├── object_detector_node.py      # détection couleur HSV
│   ├── camera_obstacle_node.py      # obstacles via caméra depth
│   └── pick_and_place_node.py       # bras + machine à états
├── config/detection_params.yaml
└── launch/detect_and_pick.launch.py
```

---

## 1. `object_detector_node.py` — Détection d'objets par couleur

**Rôle** : détecter des objets d'une couleur donnée dans l'image RGB, et
calculer leur position 3D grâce à l'image de profondeur.

**Flux** :

```text
/camera/color/image_raw ──┐
                          ├─→ masque HSV → contours → position 3D
/camera/depth/image_raw ──┘                    │
                                               ├─→ /teacher/detections (PoseArray)
                                               ├─→ /teacher/detection_markers
                                               └─→ /teacher/detection_image
```

### Partie importante 1 : conversion RGB → HSV

```python
# fichier: object_detector_node.py, méthode detect, ligne ~100
color_img = self.decode_image(self.latest_color)
hsv = cv2.cvtColor(color_img, cv2.COLOR_RGB2HSV)
```

> Pourquoi HSV : la teinte (H) est robuste aux changements de luminosité,
> contrairement au RGB.

### Partie importante 2 : masque double pour le rouge

```python
# fichier: object_detector_node.py, ligne ~103
# Le rouge est aux deux bouts du cercle HSV (H=0 et H=180) → deux masques
mask1 = cv2.inRange(hsv, np.array(self.hsv_low_1, dtype=np.uint8),
                         np.array(self.hsv_high_1, dtype=np.uint8))
mask2 = cv2.inRange(hsv, np.array(self.hsv_low_2, dtype=np.uint8),
                         np.array(self.hsv_high_2, dtype=np.uint8))
mask = cv2.bitwise_or(mask1, mask2)
```

> Paramètres par défaut :
>
> ```text
> hsv_low_1  = [0,   120, 70]   hsv_high_1 = [10,  255, 255]
> hsv_low_2  = [170, 120, 70]   hsv_high_2 = [180, 255, 255]
> ```

### Partie importante 3 : nettoyage du masque

```python
# fichier: object_detector_node.py, ligne ~116
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)   # supprime le bruit
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)  # bouche les trous
```

> `OPEN` = érosion puis dilatation (efface les petits points).
> `CLOSE` = dilatation puis érosion (referme les petits trous).

### Partie importante 4 : trouver les contours et le centroïde

```python
# fichier: object_detector_node.py, ligne ~121
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

for contour in contours:
    area = cv2.contourArea(contour)
    if area < self.min_area:          # ignore les taches trop petites
        continue
    (cx_px, cy_px), radius = cv2.minEnclosingCircle(contour)
    cx_px, cy_px = int(cx_px), int(cy_px)
```

### Partie importante 5 : lecture robuste de la profondeur

```python
# fichier: object_detector_node.py, ligne ~142
# Petite région autour du centroïde + médiane (robuste aux trous)
r = max(1, int(radius * 0.3))
region = depth_img[cy_px-r:cy_px+r, cx_px-r:cx_px+r].astype(np.float64)
if depth_img.dtype == np.uint16:
    region = region * self.depth_scale     # 0.001 pour convertir mm → m
valid = region[(region > self.min_depth) & (region < self.max_depth)]
if valid.size > 0:
    z = float(np.median(valid))
```

> La médiane évite les valeurs aberrantes (pixels sans profondeur ou
> reflets).

### Partie importante 6 : back-projection 2D → 3D

```python
# fichier: object_detector_node.py, ligne ~162
# Modèle pin-hole inversé : (pixel + profondeur) → position 3D
x_3d = (cx_px - self.cx) / self.fx * z
y_3d = (cy_px - self.cy) / self.fy * z
# z est déjà la profondeur
```

> Les intrinsèques `fx`, `fy`, `cx`, `cy` proviennent de la calibration
> de la caméra. Valeurs par défaut : 615, 615, 320, 240 (RealSense D435).

### Partie importante 7 : publication dans le bon repère

```python
# fichier: object_detector_node.py, ligne ~168
header = Header()
header.stamp = self.get_clock().now().to_msg()
header.frame_id = "camera_color_optical_frame"    # X droite, Y bas, Z avant

pose_array = PoseArray()
pose_array.header = header
for x, y, z, _, _, _ in detections:
    pose = Pose()
    pose.position.x = x
    pose.position.y = y
    pose.position.z = z
    pose.orientation.w = 1.0
    pose_array.poses.append(pose)
self.pose_pub.publish(pose_array)
```

> Le consommateur (pick_and_place_node) devra transformer ces positions
> vers `base_link` avec TF2.

---

## 2. `camera_obstacle_node.py` — Scan virtuel depuis la caméra depth

**Rôle** : convertir l'image de profondeur en un LaserScan virtuel que
Nav2 utilise comme un vrai lidar. Détecte les petits obstacles au sol
que le lidar 2D rate.

**Flux** :

```text
/camera/depth/image_raw ──→ bande inférieure de l'image
                          → min de chaque colonne
                          → LaserScan virtuel
                          → /teacher/camera_scan  (consommé par Nav2)
```

### Partie importante 1 : décodage de l'image de profondeur

```python
# fichier: camera_obstacle_node.py, méthode process, ligne ~103
if encoding in ("16uc1", "mono16"):
    raw = np.frombuffer(data, dtype=np.uint16).reshape(h, w)
    depth_m = raw.astype(np.float32) * self.depth_scale  # mm → m
elif encoding in ("32fc1",):
    depth_m = np.frombuffer(data, dtype=np.float32).reshape(h, w)
```

### Partie importante 2 : zone de scan (bande inférieure)

```python
# fichier: camera_obstacle_node.py, ligne ~117
# On ne scanne que le bas de l'image (zone du sol)
y_start = int(h * (1.0 - self.scan_height_ratio))  # par défaut 40 %
y_end = h
roi = depth_m[y_start:y_end, :]
```

> Ne pas scanner tout l'image : les obstacles au plafond ou en hauteur
> ne nous intéressent pas.

### Partie importante 3 : min par colonne → scan

```python
# fichier: camera_obstacle_node.py, ligne ~122
# Pour chaque colonne de pixels, prendre la distance minimale
col_min = np.full(w, self.max_range, dtype=np.float32)
for x in range(w):
    col = roi[:, x]
    valid = col[(col > self.min_range) & (col < self.max_range)]
    if valid.size > 0:
        col_min[x] = float(np.min(valid))
```

> Chaque colonne de l'image devient un rayon du scan : la distance au
> plus proche obstacle visible dans cette colonne.

### Partie importante 4 : conversion pixels → angles

```python
# fichier: camera_obstacle_node.py, ligne ~131
# Angle de chaque colonne dans le repère optique de la caméra
angles = np.arctan2(np.arange(w, dtype=np.float32) - self.cx, self.fx)
angle_min = float(angles[0])
angle_max = float(angles[-1])
angle_increment = float((angle_max - angle_min) / max(w - 1, 1))
```

> Modèle pin-hole : un pixel à une colonne `x` correspond à un angle
> `atan2(x - cx, fx)` par rapport à l'axe optique.

### Partie importante 5 : construction du LaserScan

```python
# fichier: camera_obstacle_node.py, ligne ~140
scan = LaserScan()
scan.header.stamp = depth_msg.header.stamp
scan.header.frame_id = "camera_color_optical_frame"
scan.angle_min = angle_min
scan.angle_max = angle_max
scan.angle_increment = angle_increment
scan.range_min = self.min_range
scan.range_max = self.max_range
scan.ranges = col_min.tolist()
self.scan_pub.publish(scan)
```

> Le message produit est exactement comme celui d'un lidar réel. Nav2
> peut l'ajouter à sa costmap sans code spécial.

---

## 3. `pick_and_place_node.py` — Ramassage avec le bras

**Rôle** : recevoir une détection, rouler vers l'objet, actionner le
bras pour le saisir, le soulever, et le relâcher.

**Machine à états** :

```text
IDLE → APPROACH → REACH → GRASP → LIFT → DONE → IDLE
```

### Partie importante 1 : énumération des états

```python
# fichier: pick_and_place_node.py, ligne 34
class State(Enum):
    IDLE = auto()
    APPROACH = auto()    # rouler vers l'objet
    REACH = auto()       # déployer le bras
    GRASP = auto()       # fermer la pince
    LIFT = auto()        # lever et relâcher
    DONE = auto()
```

### Partie importante 2 : transformation caméra → base_link

```python
# fichier: pick_and_place_node.py, méthode on_detections, ligne ~127
tf = self.tf_buffer.lookup_transform(
    "base_link", msg.header.frame_id,         # de camera_color_optical_frame
    rclpy.time.Time(),
    timeout=rclpy.duration.Duration(seconds=0.5)
)
t = tf.transform.translation
q = tf.transform.rotation
# Appliquer rotation quaternion puis translation
rx, ry, rz = self.quat_rotate(q.x, q.y, q.z, q.w,
                               best.position.x, best.position.y, best.position.z)
bx, by, bz = rx + t.x, ry + t.y, rz + t.z
self.target = (bx, by, bz)
```

> Le détecteur publie dans le repère caméra. Le bras est solidaire de
> `base_link`. TF2 fait le pont entre les deux.

### Partie importante 3 : conversion radians → degrés servo

```python
# fichier: pick_and_place_node.py, ligne 47
def rad_to_servo(rad, center=90.0):
    """Radians (0 = centre) → degrés servo Yahboom (90 = centre)."""
    return clamp(math.degrees(rad) + center, 0.0, 180.0)
```

### Partie importante 4 : APPROACH — rouler vers l'objet

```python
# fichier: pick_and_place_node.py, méthode do_approach, ligne ~191
tx, ty, tz = self.target
dist = math.sqrt(tx ** 2 + ty ** 2)
angle = math.atan2(ty, tx)

twist = Twist()
if abs(angle) > 0.15:
    # 1. S'aligner en rotation d'abord
    twist.angular.z = clamp(angle * 1.5, -0.5, 0.5)
elif dist > self.approach_dist:
    # 2. Puis avancer, en corrigeant un peu l'angle
    twist.linear.x = clamp((dist - self.approach_dist) * 0.5, 0.0, 0.12)
    twist.angular.z = clamp(angle * 0.8, -0.3, 0.3)
else:
    # 3. Arrivé → passer à REACH
    self.cmd_vel_pub.publish(Twist())       # stop
    self.transition_to(State.REACH)
    return
self.cmd_vel_pub.publish(twist)
```

> Séquence : tourner d'abord (trop de biais), puis avancer en corrigeant.

### Partie importante 5 : cinématique inverse

```python
# fichier: pick_and_place_node.py, méthode compute_ik, ligne ~286
# Étape 1 : rotation de base
base_yaw = math.atan2(dy, dx)

# Étape 2 : distance et hauteur
r = math.sqrt(dx**2 + dy**2)
# On veut que la pince pointe vers le bas, donc le poignet doit être
# à L3 au-dessus de la cible
ik_r = r
ik_z = dz + self.L3

# Étape 3 : IK planaire à 2 segments (épaule + coude) via Al-Kashi
d = math.sqrt(ik_r**2 + ik_z**2)
if d > self.L1 + self.L2 or d < abs(self.L1 - self.L2):
    return None                 # hors de portée

cos_elbow = (self.L1**2 + self.L2**2 - d**2) / (2 * self.L1 * self.L2)
elbow = -(math.pi - math.acos(clamp(cos_elbow, -1.0, 1.0)))

alpha = math.atan2(ik_z, ik_r)
cos_beta = (self.L1**2 + d**2 - self.L2**2) / (2 * self.L1 * d)
beta = math.acos(clamp(cos_beta, -1.0, 1.0))
shoulder = alpha + beta

# Étape 4 : poignet compense pour pince vers le bas
wrist_pitch = -(shoulder + elbow) - math.pi / 2
```

> Théorème d'Al-Kashi (loi des cosinus) pour résoudre le triangle
> formé par l'épaule, le coude, et la cible.

### Partie importante 6 : envoi de la commande bras

```python
# fichier: pick_and_place_node.py, méthode send_arm_command, ligne ~344
j1 = int(rad_to_servo(base_yaw))
j2 = int(rad_to_servo(shoulder))
j3 = int(rad_to_servo(elbow))
j4 = int(rad_to_servo(wrist_pitch))
j5 = int(rad_to_servo(wrist_roll))
j6 = int(gripper)                        # servo pince directement en degrés

if HAS_ARM_MSGS and self.arm_pub is not None:
    msg = ArmJoints()
    msg.joint1 = j1; msg.joint2 = j2; msg.joint3 = j3
    msg.joint4 = j4; msg.joint5 = j5; msg.joint6 = j6
    self.arm_pub.publish(msg)
else:
    self.get_logger().info(f"[DRY RUN] Would send arm: [{j1},{j2},{j3},{j4},{j5},{j6}]")
```

> Mode DRY RUN si `arm_msgs` n'est pas installé : tout se passe comme
> avant mais rien n'est envoyé au servomoteur.

---

## 4. `detection_params.yaml` — Réglages HSV et bras

### Partie importante 1 : plages HSV (rouge par défaut)

```yaml
# fichier: detection_params.yaml, ligne ~14
object_detector_node:
  ros__parameters:
    hsv_low_1:  [0,   120, 70]
    hsv_high_1: [10,  255, 255]
    hsv_low_2:  [170, 120, 70]
    hsv_high_2: [180, 255, 255]
    min_contour_area: 500       # ignore les taches < 500 px²
    max_detection_depth: 1.0    # objets à plus de 1 m ignorés
    min_detection_depth: 0.15   # objets à moins de 15 cm ignorés
```

> Pour détecter un autre objet :
>
> ```text
> Vert  : H = 35-85,   S > 100, V > 70
> Bleu  : H = 100-130, S > 120, V > 70
> Jaune : H = 20-35,   S > 100, V > 100
> ```

### Partie importante 2 : dimensions du bras (URDF)

```yaml
# fichier: detection_params.yaml, ligne ~36
pick_and_place_node:
  ros__parameters:
    arm_base_x: 0.02           # décalage du bras depuis base_link
    arm_base_z: 0.24           # hauteur de l'épaule au-dessus de base_link
    upper_arm_length: 0.11     # L1
    forearm_length: 0.11       # L2
    wrist_length: 0.12         # L3 (poignet + pince)
    # Portée totale = L1 + L2 + L3 = 0.34 m
```

### Partie importante 3 : comportement du ramassage

```yaml
# fichier: detection_params.yaml, ligne ~43
arm_command_topic: /arm_control   # topic de commande (variable selon firmware)
approach_distance: 0.30           # stop à 30 cm de l'objet
gripper_open_value: 30            # servo ouvert
gripper_close_value: 75           # servo fermé sur un objet
```

---

## 5. `detect_and_pick.launch.py` — Lancer tout le pipeline vision

### Partie importante : trois noeuds en un launch

```python
# fichier: detect_and_pick.launch.py, ligne ~24
return LaunchDescription([
    DeclareLaunchArgument("pick", default_value="true"),

    Node(package="m3pro_teacher_vision",
         executable="camera_obstacle_node",   # scan virtuel depth
         parameters=[params_file]),

    Node(package="m3pro_teacher_vision",
         executable="object_detector_node",   # détection couleur
         parameters=[params_file]),

    Node(package="m3pro_teacher_vision",
         executable="pick_and_place_node",    # bras (optionnel)
         parameters=[params_file],
         condition=IfCondition(LaunchConfiguration("pick"))),
])
```

> Utilisation :
>
> ```bash
> # Tout : détection + obstacles + ramassage
> ros2 launch m3pro_teacher_vision detect_and_pick.launch.py
>
> # Détection seule (pas de mouvement du bras)
> ros2 launch m3pro_teacher_vision detect_and_pick.launch.py pick:=false
> ```
