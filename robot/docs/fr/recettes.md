---
title: Recettes
parent: Francais
nav_order: 6
---

# Recettes de code
{: .no_toc }

Extraits a copier-coller pour les taches les plus frequentes. Toutes les
commandes se lancent dans le conteneur `m3pro` avec l'environnement ROS 2
source.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Inspecter le systeme en ligne de commande

```bash
ros2 topic list                       # tous les topics
ros2 topic echo /odom --once           # un message d'un topic
ros2 topic hz /scan_multi              # cadence de publication
ros2 topic info /cmd_vel               # type, nombre de publishers/subscribers
ros2 node list                         # noeuds en cours
ros2 node info /slam_toolbox            # topics et services d'un noeud
ros2 param list /controller_server      # parametres d'un noeud
ros2 run tf2_ros tf2_echo map base_link  # transformation en direct entre deux reperes
```

## Conduire le robot

Le robot ecoute sur `/cmd_vel` (`geometry_msgs/msg/Twist`).

```bash
# Une impulsion vers l'avant (publie une fois)
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"

# Continu: tourner sur place a 5 Hz
ros2 topic pub -r 5 /cmd_vel geometry_msgs/msg/Twist "{angular: {z: 0.5}}"

# Se deplacer lateralement - roues mecanum seulement
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {y: 0.1}}"

# Arreter
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{}"

# Controle clavier interactif
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

En Python:

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist

class Driver(Node):
    def __init__(self):
        super().__init__("driver")
        self.pub = self.create_publisher(Twist, "/cmd_vel", 10)
        self.create_timer(0.1, self.tick)     # 10 Hz

    def tick(self):
        msg = Twist()
        msg.linear.x = 0.1                     # 0.1 m/s vers l'avant
        self.pub.publish(msg)

rclpy.init()
rclpy.spin(Driver())
```

## Envoyer un objectif de navigation

```bash
# Comme un topic (ce que font le bouton "2D Goal Pose" et le tableau de bord)
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"

# Comme une action, avec retour d'information et resultat
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}}"
```

En Python, avec l'assistant Nav2:

```python
import rclpy
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator

rclpy.init()
nav = BasicNavigator()
nav.waitUntilNav2Active()

goal = PoseStamped()
goal.header.frame_id = "map"
goal.header.stamp = nav.get_clock().now().to_msg()
goal.pose.position.x = 1.5
goal.pose.position.y = 0.5
goal.pose.orientation.w = 1.0

nav.goToPose(goal)
while not nav.isTaskComplete():
    feedback = nav.getFeedback()       # distance restante, etc.
print(nav.getResult())
```

## Lire la carte

La carte est un `nav_msgs/msg/OccupancyGrid` sur `/map`. Chaque cellule vaut
`-1` (inconnu), `0` (libre) ou `1-100` (occupe).

```python
import rclpy
from rclpy.node import Node
from nav_msgs.msg import OccupancyGrid

class MapReader(Node):
    def __init__(self):
        super().__init__("map_reader")
        self.create_subscription(OccupancyGrid, "/map", self.on_map, 1)

    def on_map(self, msg):
        w, h = msg.info.width, msg.info.height
        free = sum(1 for c in msg.data if c == 0)
        self.get_logger().info(f"carte {w}x{h}, resolution {msg.info.resolution} m, "
                               f"{free} cellules libres")

rclpy.init()
rclpy.spin(MapReader())
```

Pixel vers coordonnees monde:

```python
world_x = px * info.resolution + info.origin.position.x
world_y = py * info.resolution + info.origin.position.y
```

## Sauvegarder la carte

```bash
# Via le service slam_toolbox
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/ma_piece}}"

# Via l'outil standard de sauvegarde de carte
ros2 run nav2_map_server map_saver_cli -f /root/maps/ma_piece
```

## S'abonner a un scan laser

```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from rclpy.qos import qos_profile_sensor_data

class ScanReader(Node):
    def __init__(self):
        super().__init__("scan_reader")
        self.create_subscription(LaserScan, "/scan_multi", self.on_scan,
                                 qos_profile_sensor_data)

    def on_scan(self, msg):
        valid = [r for r in msg.ranges if msg.range_min < r < msg.range_max]
        if valid:
            self.get_logger().info(f"obstacle le plus proche: {min(valid):.2f} m")

rclpy.init()
rclpy.spin(ScanReader())
```

Notez le `qos_profile_sensor_data`: les topics capteurs utilisent une QoS
best-effort, et un abonnement par defaut ne recevrait rien.

## Lire l'odometrie et la pose du robot

```python
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry

class PoseReader(Node):
    def __init__(self):
        super().__init__("pose_reader")
        self.create_subscription(Odometry, "/odom", self.on_odom, 10)

    def on_odom(self, msg):
        p = msg.pose.pose.position
        self.get_logger().info(f"robot a x={p.x:.2f} y={p.y:.2f}")

rclpy.init()
rclpy.spin(PoseReader())
```

Pour la pose **sur la carte**, recherchez la transformation
`map -> base_link`:

```python
from tf2_ros import Buffer, TransformListener
import rclpy
from rclpy.node import Node

class TfReader(Node):
    def __init__(self):
        super().__init__("tf_reader")
        self.buffer = Buffer()
        TransformListener(self.buffer, self)
        self.create_timer(1.0, self.tick)

    def tick(self):
        try:
            t = self.buffer.lookup_transform("map", "base_link",
                                             rclpy.time.Time())
            self.get_logger().info(f"sur la carte: x={t.transform.translation.x:.2f}")
        except Exception as e:
            self.get_logger().warn(f"pas encore de transformation: {e}")

rclpy.init()
rclpy.spin(TfReader())
```

## Commander le bras

```bash
# Envoyer six angles servo (degres, 90 = centre). Le topic depend du firmware.
ros2 topic pub --once /arm6_joints arm_msgs/msg/ArmJoints \
  "{joint1: 90, joint2: 120, joint3: 10, joint4: 20, joint5: 90, joint6: 30}"
```

Voir [Bras](bras.html) pour les recettes completes du bras.

## Ajouter une transformation statique

Deux reperes non relies dans TF (une cause frequente d'erreurs "no
transform"):

```bash
ros2 run tf2_ros static_transform_publisher \
  --x 0.091 --y 0 --z 0.093 \
  --qx 0 --qy 0 --qz 0 --qw 1 \
  --frame-id base_link --child-frame-id camera_link
```

## Enregistrer et rejouer des donnees

```bash
# Enregistrer des topics choisis
ros2 bag record /scan_multi /odom /tf /tf_static /map -o ma_session

# Inspecter un enregistrement
ros2 bag info ma_session

# Le rejouer (les autres noeuds voient les topics comme en direct)
ros2 bag play ma_session
```

Foxglove Studio peut aussi enregistrer la connexion en direct dans un
fichier `.mcap`.

## Un modele de noeud minimal

```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class MyNode(Node):
    def __init__(self):
        super().__init__("my_node")
        self.pub = self.create_publisher(String, "/teacher/hello", 10)
        self.create_subscription(String, "/teacher/hello", self.on_msg, 10)
        self.create_timer(1.0, self.tick)

    def tick(self):
        msg = String()
        msg.data = "bonjour depuis my_node"
        self.pub.publish(msg)

    def on_msg(self, msg):
        self.get_logger().info(f"recu: {msg.data}")

def main():
    rclpy.init()
    rclpy.spin(MyNode())
    rclpy.shutdown()

if __name__ == "__main__":
    main()
```
