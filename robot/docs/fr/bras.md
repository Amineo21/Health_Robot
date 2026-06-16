---
title: Bras
parent: Francais
nav_order: 3
---

# Controler le bras 6 axes
{: .no_toc }

Bouger le bras, le visualiser, et ramasser les objets vus par la camera.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

> **Securite d'abord.** Le bras n'est alimente qu'avec l'autorisation du
> formateur. Gardez les mains et les cables hors de toute sa portee. Testez
> la logique en mode dry-run (voir plus bas) avant de piloter les vrais
> servos.

## Comment le bras est construit

Le bras du M3 Pro a **six servos**. Chaque servo prend un angle de `0` a
`180` degres, ou `90` est la position centrale.

| Servo | Articulation | Mouvement |
| --- | --- | --- |
| 1 | `base_yaw_joint` | Fait tourner tout le bras a gauche/droite. |
| 2 | `shoulder_joint` | Leve/baisse le bras superieur. |
| 3 | `elbow_joint` | Plie l'avant-bras. |
| 4 | `wrist_pitch_joint` | Incline le poignet haut/bas. |
| 5 | `wrist_roll_joint` | Fait tourner la pince. |
| 6 | pince | Ouvre/ferme les doigts. |

Une pose de repos sure ("home") en degres servo:

```text
[ j1=90, j2=120, j3=10, j4=20, j5=90, j6=30 ]
        base  epaule  coude poignet roll  pince(ouverte)
```

La pince s'ouvre vers `30` et se ferme sur un objet vers `75` a `90`.

## Comment radians et degres se correspondent

Le firmware du robot parle en **degres servo** (0 a 180, 90 = centre). ROS
et l'URDF parlent en **radians** (0 = centre). La conversion est:

```python
radians = math.radians(degres_servo - 90)      # degres -> radians
degres_servo = math.degrees(radians) + 90      # radians -> degres
```

## Recette 1: Visualiser le bras dans RViz

Le noeud `arm_joint_state_bridge_demo` transforme les angles bruts du bras
en un message `JointState` standard pour que RViz dessine le modele URDF.

```bash
ros2 run m3pro_teacher_demos arm_joint_state_bridge_demo
```

Il s'abonne au topic du bras (`/arm6_joints`, `arm_msgs/ArmJoints`) et
publie `/teacher/joint_states`. Ajoutez un affichage **RobotModel** et
**TF** dans RViz pour voir le bras bouger en 3D.

Mettez `demo_motion:=true` pour animer un balayage lent sans materiel reel,
utile pour verifier l'URDF:

```bash
ros2 run m3pro_teacher_demos arm_joint_state_bridge_demo --ros-args -p demo_motion:=true
```

## Recette 2: Envoyer le bras a une pose

Le bras se commande avec un message `arm_msgs/ArmJoints`: six angles servo
en degres. Le topic exact depend du firmware du robot et est defini par le
parametre `arm_command_topic` dans `detection_params.yaml`.

```python
# Noeud minimal: envoyer le bras a home, puis fermer la pince.
import rclpy
from rclpy.node import Node
from arm_msgs.msg import ArmJoints

class ArmPose(Node):
    def __init__(self):
        super().__init__("arm_pose")
        self.pub = self.create_publisher(ArmJoints, "/arm6_joints", 10)
        self.create_timer(1.0, self.tick)
        self.step = 0

    def tick(self):
        msg = ArmJoints()
        msg.joint1, msg.joint2, msg.joint3 = 90, 120, 10
        msg.joint4, msg.joint5 = 20, 90
        msg.joint6 = 30 if self.step == 0 else 80   # ouverte, puis fermee
        self.pub.publish(msg)
        self.get_logger().info(f"pince envoyee = {msg.joint6}")
        self.step += 1

rclpy.init()
rclpy.spin(ArmPose())
```

> **Dry run.** Si le paquet `arm_msgs` n'est pas installe, les noeuds de
> ramassage du cours affichent `[DRY RUN] Would send arm: [...]` au lieu de
> bouger les servos. Cela permet de tester la logique en securite. Installez
> `arm_msgs` pour piloter le vrai bras.

## Recette 3: Cliquer pour ramasser (bras seul)

`click_pick.launch.py` permet de ramasser un objet en **le cliquant sur une
photo dans un navigateur**. La base ne bouge pas, seul le bras bouge.

**Etape 1.** Verifier que le bringup materiel et la camera tournent.

```bash
ros2 launch slam_mapping bringup.launch.py        # couche 2
ros2 launch slam_mapping app_camera.launch.py     # camera
```

**Etape 2.** Lancer la stack cliquer-pour-ramasser.

```bash
ros2 launch m3pro_teacher_vision click_pick.launch.py
```

Cela demarre le `click_to_pick_node`, le service de cinematique inverse KDL
de Yahboom (`/get_kinemarics`), un serveur web et rosbridge.

**Etape 3.** Ouvrir `http://<robot-ip>:8080/pick.html` dans un navigateur.
Cliquez sur l'objet dans l'image camera. Le noeud:

1. Lit la profondeur a ce pixel et la transforme dans le repere
   `base_link`.
2. Appelle le service IK pour trouver des angles qui atteignent le point.
3. Indique si le point est atteignable.
4. A la commande **grasp**, deroule `HOVER -> DESCEND -> GRASP -> LIFT`.

## Recette 4: Detecter une couleur et la ramasser en autonomie

`detect_and_pick.launch.py` fait tourner toute la chaine vision-vers-bras:
detecter un objet par couleur, rouler jusqu'a lui, et le ramasser.

```bash
# Chaine complete: detection + scan obstacles depth + ramassage par le bras
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py

# Detection seule, sans mouvement du bras ni de la base (sur pour le reglage)
ros2 launch m3pro_teacher_vision detect_and_pick.launch.py pick:=false
```

Le `pick_and_place_node` fait tourner une machine a etats:

```text
IDLE -> APPROACH -> REACH -> GRASP -> LIFT -> DONE -> IDLE
        rouler      deployer fermer  lever
        vers l'objet le bras  la pince
```

Le detecteur publie les objets detectes sur `/teacher/detections`
(`PoseArray`), des marqueurs sur `/teacher/detection_markers`, et une image
annotee sur `/teacher/detection_image`.

### Regler la detection de couleur

Le detecteur trouve les objets par **plage de couleur HSV**, definie dans
`m3pro_teacher_vision/config/detection_params.yaml`. Les valeurs par defaut
correspondent au rouge:

```yaml
object_detector_node:
  ros__parameters:
    hsv_low_1:  [0,   120, 70]      # le rouge est aux deux bouts du cercle de teinte
    hsv_high_1: [10,  255, 255]
    hsv_low_2:  [170, 120, 70]
    hsv_high_2: [180, 255, 255]
    min_contour_area: 500           # ignore les taches sous 500 px2
```

Pour d'autres couleurs:

| Couleur | Teinte (H) | Saturation (S) | Valeur (V) |
| --- | --- | --- | --- |
| Vert | 35 a 85 | au-dessus de 100 | au-dessus de 70 |
| Bleu | 100 a 130 | au-dessus de 120 | au-dessus de 70 |
| Jaune | 20 a 35 | au-dessus de 100 | au-dessus de 100 |

### Comment la position est calculee

Le detecteur trouve le centre de l'objet dans l'image, lit la profondeur a
cet endroit, et la retro-projette en 3D avec le modele de camera pin-hole:

```python
x_3d = (cx_px - cx) / fx * z      # z est la profondeur mesuree
y_3d = (cy_px - cy) / fy * z
```

Le resultat est publie dans le repere camera. `pick_and_place_node` utilise
ensuite TF2 pour le convertir vers `base_link`, et resout une cinematique
inverse a 2 segments (loi des cosinus) pour les angles epaule et coude.

## La suite

- [Integration](integration.html) - naviguer vers un objet, puis le ramasser.
- [Recettes](recettes.html) - plus d'extraits de code bras et vision.
