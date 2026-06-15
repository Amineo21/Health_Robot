# Exercice : Navigation autonome avec Nav2

Objectif : faire naviguer le robot de manière autonome sur la carte que
vous avez construite à l'exercice précédent. Comprendre AMCL, les
costmaps, le planificateur global, le contrôleur local, et savoir régler
leurs paramètres.

Vous allez :

1. vérifier les prérequis (carte sauvegardée, bringup actif) ;
2. lancer la pile Nav2 avec votre carte ;
3. inspecter le graphe de nodes qui vient de démarrer ;
4. localiser le robot sur la carte avec AMCL ;
5. envoyer un premier objectif de navigation depuis RViz ;
6. observer les costmaps en temps réel ;
7. envoyer un objectif depuis la ligne de commande ;
8. étudier le fichier `nav2_params.yaml` ;
9. modifier un paramètre et observer l'effet ;
10. tester l'évitement d'obstacle dynamique ;
11. écrire un mini-script de patrouille (bonus) ;
12. nettoyer.

**Important :** le buzzer doit rester désactivé. Gardez la main sur
l'arrêt d'urgence physique ou sur `Ctrl-C` pendant les déplacements.

## Matériel et prérequis

- Robot Yahboom ROSMASTER M3 Pro allumé, bringup matériel en cours.
- Une **carte sauvegardée** à l'exercice précédent :
  ```text
  /root/m3pro_teacher_ws/src/m3pro_teacher_nav/maps/salle.pgm
  /root/m3pro_teacher_ws/src/m3pro_teacher_nav/maps/salle.yaml
  ```
- VNC ou écran sur le Jetson pour voir RViz.
- Navigateur sur votre ordinateur pour le dashboard web (bonus).

Dans tout l'exercice :

```text
Robot : jetson@192.168.50.102
ROS 2 : dans le container Docker
Workspace : /root/m3pro_teacher_ws
```

---

## Partie 1 : Vérifier les prérequis

Connectez-vous au robot et entrez dans le container :

```bash
ssh jetson@192.168.50.102
```

```bash
docker exec -it \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -e DISPLAY=:0 \
  NOM_CONTENEUR \
  bash
```

Sourcez les workspaces :

```bash
source /opt/ros/humble/setup.bash
source /root/yahboomcar_ws/install/setup.bash 2>/dev/null || true
source /root/M3Pro_ws/install/setup.bash 2>/dev/null || true
source /root/m3pro_teacher_ws/install/setup.bash
```

Vérifiez que votre carte existe :

```bash
ls -la /root/m3pro_teacher_ws/src/m3pro_teacher_nav/maps/
```

Résultat attendu :

```text
salle.pgm
salle.yaml
```

Vérifiez que le bringup Yahboom tourne dans un autre terminal (l'odom et
le lidar doivent publier) :

```bash
ros2 topic hz /odom
ros2 topic hz /scan0
```

Arrêtez avec `Ctrl-C` quand vous avez vu les fréquences.

Question :

```text
Pourquoi faut-il absolument que le bringup Yahboom soit déjà lancé
avant de démarrer Nav2 ?
```

Réponse :

```text
Nav2 a besoin de /odom, des scans lidar et de la TF odom →
base_footprint. Sans bringup, ces topics n'existent pas et les nodes
Nav2 échouent au démarrage (lifecycle en erreur).
```

---

## Partie 2 : Rappel de l'architecture Nav2

Nav2 est **un assemblage** de nodes, pas un seul programme. Voici ce
que la commande de la Partie 3 va démarrer :

```text
┌──────────────────────────────────────────────────────────────┐
│                   Nav2 (ce qui va démarrer)                  │
│                                                              │
│  map_server          → publie /map à partir du .yaml         │
│  amcl                → localise le robot (filtre particules) │
│  planner_server      → chemin global (A*, NavFn)             │
│  controller_server   → suit le chemin → /cmd_vel             │
│  behavior_server     → recovery (spin, backup, wait)         │
│  smoother_server     → lisse les chemins                     │
│  bt_navigator        → orchestre via Behavior Tree (XML)     │
│  lifecycle_manager   → démarre/surveille tous les autres     │
└──────────────────────────────────────────────────────────────┘
```

Le launch du cours, `navigation.launch.py`, ajoute aussi :

- `sensor_fusion_rgb_demo` → fusionne `/scan0` + `/scan1` en `/teacher/scan_merged`
- `rviz2` → visualisation

Question :

```text
Sur quelle TF AMCL repose-t-il pour fonctionner ?
```

Réponse :

```text
AMCL a besoin de la TF odom → base_footprint (fournie par
l'odométrie). Il produit ensuite la TF map → odom pour aligner le
robot avec la carte sauvegardée.
```

---

## Partie 3 : Lancer Nav2 avec votre carte

Dans un terminal Docker fraîchement sourcé :

```bash
ros2 launch m3pro_teacher_nav navigation.launch.py \
  map:=/root/m3pro_teacher_ws/src/m3pro_teacher_nav/maps/salle.yaml
```

Ce que vous devez observer dans les logs (patientez ~15 s) :

```text
[map_server]        Loaded map from salle.yaml ...
[amcl]              Received a 480 X 384 map @ 0.050 m/pix
[planner_server]    Configuring ...
[controller_server] Configuring ...
[lifecycle_manager] Managed nodes are active
```

Ce que vous devez voir dans RViz :

- La carte grise apparaît (les murs en noir, les zones libres en blanc).
- Le modèle 3D du robot apparaît quelque part sur la carte.
- Le scan laser (points verts ou blancs) est visible.
- Les **costmaps** (colorées) apparaissent autour des obstacles.

Si le robot apparaît au mauvais endroit ou si le scan ne s'aligne pas
avec les murs, c'est **normal pour l'instant**. On va corriger à la
Partie 4.

---

## Partie 4 : Inspecter ce qui tourne

Ouvrez un nouveau terminal Docker. Sourcez les workspaces. Puis :

```bash
ros2 node list | sort
```

Cherchez au minimum :

```text
/amcl
/behavior_server
/bt_navigator
/controller_server
/lifecycle_manager_navigation
/map_server
/planner_server
/smoother_server
```

Vérifiez le cycle de vie :

```bash
ros2 lifecycle get /bt_navigator
```

Résultat attendu :

```text
active [3]
```

Listez les topics créés par Nav2 :

```bash
ros2 topic list | grep -E "cost|plan|amcl|map"
```

Vous devriez voir :

```text
/amcl_pose
/global_costmap/costmap
/local_costmap/costmap
/map
/plan
```

Question :

```text
Qui publie /map, et qui publie /plan ?
```

Réponse :

```text
- /map est publié par map_server (à partir de salle.yaml).
- /plan est publié par planner_server dès qu'un goal est envoyé.
```

---

## Partie 5 : Localiser le robot avec AMCL

Le robot ne sait pas encore où il est sur la carte. Il faut lui donner
une **position initiale**. AMCL va ensuite affiner tout seul avec le
lidar.

Dans RViz :

```text
1. Cliquez sur "2D Pose Estimate" dans la barre d'outils
2. Cliquez sur la carte, à l'endroit où le robot se trouve en vrai
3. Maintenez le clic et faites glisser pour indiquer son orientation
4. Relâchez
```

Ce que vous devez voir :

- Un **nuage de particules vertes** apparaît autour du robot.
- Le scan laser commence à s'aligner avec les murs de la carte.
- Les particules se resserrent après quelques secondes.

Si le scan ne s'aligne pas :

```text
- Vérifiez visuellement la position du robot sur la carte
- Réessayez "2D Pose Estimate" plus précisément
- Faites tourner le robot doucement pour donner plus d'infos à AMCL
```

Vérifiez la pose estimée dans un autre terminal :

```bash
ros2 topic echo /amcl_pose --once
```

Résultat attendu : une position `(x, y)` et un quaternion cohérents
avec la position réelle.

Question :

```text
Comment AMCL sait-il si sa localisation est correcte ?
```

Réponse :

```text
AMCL compare ce que chaque particule "prédit" (en fonction de la
carte) avec ce que le lidar mesure réellement. Les particules dont
la prédiction correspond bien au scan survivent et se multiplient.
Les autres disparaissent. Après plusieurs itérations, le nuage
converge.
```

Question :

```text
Que se passe-t-il si vous donnez une mauvaise position initiale
(par exemple, de l'autre côté de la salle) ?
```

Réponse :

```text
Le scan ne s'alignera pas avec les murs. AMCL peut éventuellement
se recaler si le robot bouge, mais dans un environnement symétrique
(couloir), il peut rester "perdu" indéfiniment.
```

---

## Partie 6 : Envoyer votre premier objectif

Méthode 1 — depuis RViz :

```text
1. Cliquez sur "2D Goal Pose" dans la barre d'outils (ou touche G)
2. Cliquez sur la carte, à l'endroit où vous voulez envoyer le robot
3. Maintenez et glissez pour indiquer l'orientation d'arrivée
4. Relâchez
```

Ce que vous devez voir :

- Un **chemin vert** apparaît entre le robot et l'objectif (c'est `/plan`).
- Les **costmaps** s'illuminent autour des obstacles.
- Le robot **démarre** et suit le chemin.
- À l'approche des murs, vous voyez des couleurs autour d'eux dans la
  costmap : c'est l'**inflation**.
- Le robot s'arrête à l'objectif.

Question :

```text
Comment savoir si le robot a terminé sa navigation avec succès ?
```

Réponse :

```text
Le topic /navigate_to_pose/_action/status passe à 4 (SUCCEEDED).
Dans RViz, le chemin vert disparaît et le robot s'immobilise dans
la tolérance xy_goal_tolerance (15 cm par défaut).
```

---

## Partie 7 : Observer les costmaps

Pendant que le robot navigue, observez les costmaps dans RViz.

La **global_costmap** :
- Couvre toute la carte.
- Sert au `planner_server` pour calculer le chemin global.
- Fusionne `/map` (statique) + obstacles lidar.

La **local_costmap** :
- Fenêtre glissante autour du robot (~3 × 3 m).
- Sert au `controller_server` pour éviter les obstacles imprévus.
- Reconstruite à chaque tick à partir du lidar live.

Valeurs de coût (rappel) :

```text
0        libre
1-252    inflation (zone de sécurité autour des obstacles)
253      collision possible
254      collision certaine
255      inconnu
```

Dans un autre terminal :

```bash
ros2 topic hz /local_costmap/costmap
```

Résultat attendu : la local_costmap se met à jour à ~5 Hz.

Question :

```text
Pourquoi a-t-on besoin de DEUX costmaps plutôt qu'une seule ?
```

Réponse :

```text
La globale est grande mais lente à recalculer : idéale pour un
plan stratégique sur toute la salle. La locale est petite mais
rapide : idéale pour réagir en temps réel à un obstacle qui
apparaît (quelqu'un qui traverse, une chaise déplacée).
```

---

## Partie 8 : Envoyer un objectif en ligne de commande

RViz c'est bien pour le débogage, mais en production on envoie les
goals depuis un programme ou la ligne de commande.

Dans un nouveau terminal Docker (sourcez avant) :

```bash
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: 'map'},
    pose: {position: {x: 1.0, y: 0.5, z: 0.0},
           orientation: {w: 1.0}}}"
```

Le robot doit se rendre à la position `(1.0, 0.5)` avec une orientation
nulle (pointé vers l'axe X de la carte).

Pour **annuler** la navigation en cours :

```bash
ros2 action send_goal /navigate_to_pose \
  nav2_msgs/action/NavigateToPose "{}" \
  --cancel-all 2>/dev/null

# Ou plus simple : arrêt d'urgence manuel
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.0}}"
```

Question :

```text
Que représente `orientation: {w: 1.0}` dans le goal ?
```

Réponse :

```text
C'est un quaternion qui code une rotation nulle (pas de rotation).
Le robot arrivera orienté vers l'axe X de la carte. Pour une
rotation de 90° autour de Z, on écrirait z: 0.707, w: 0.707.
```

---

## Partie 9 : Explorer la configuration Nav2

Le comportement de Nav2 est entièrement contrôlé par le fichier
`nav2_params.yaml`.

```bash
less /root/m3pro_teacher_ws/src/m3pro_teacher_nav/config/nav2_params.yaml
```

(Naviguez avec les flèches, `/` pour chercher, `q` pour quitter.)

Repérez les sections principales :

```text
amcl:                  → paramètres de localisation
bt_navigator:          → fichier .xml du Behavior Tree
controller_server:     → algo de contrôle local (DWB ou RPP)
global_costmap:        → couches et résolution globales
local_costmap:         → couches et résolution locales
map_server:            → (le yaml à charger)
planner_server:        → algo de planification (GridBased)
behavior_server:       → recovery (spin, backup, wait)
```

Dans la section `controller_server`, trouvez :

```yaml
FollowPath:
  max_vel_x:           0.20       # vitesse linéaire max (m/s)
  max_vel_theta:       0.80       # vitesse angulaire max (rad/s)
  xy_goal_tolerance:   0.15       # tolérance d'arrivée en position (m)
  yaw_goal_tolerance:  0.25       # tolérance d'arrivée en orientation (rad)
```

Dans les costmaps, trouvez :

```yaml
inflation_layer:
  inflation_radius:    0.35       # rayon d'inflation (m)
  cost_scaling_factor: 3.0        # décroissance du gradient
```

Question :

```text
Que se passe-t-il si on règle xy_goal_tolerance à 0.02 (2 cm) ?
```

Réponse :

```text
Le robot devra s'arrêter à 2 cm près du goal. Avec l'imprécision
de l'odométrie et de l'AMCL, il n'y arrivera probablement jamais
et tournera en rond autour du point. Le Behavior Tree finira par
déclarer un échec.
```

Question :

```text
Que se passe-t-il si on réduit inflation_radius à 0.05 (5 cm) ?
```

Réponse :

```text
Le robot va frôler les murs et les meubles. À la moindre erreur
de localisation, il peut cogner. Le rayon d'inflation doit être
légèrement supérieur au rayon du robot (M3 Pro ~0.20 m).
```

---

## Partie 10 : Modifier un paramètre et observer

Faisons un test contrôlé : réduire la vitesse max du robot.

Arrêtez Nav2 avec `Ctrl-C`.

Éditez le fichier :

```bash
nano /root/m3pro_teacher_ws/src/m3pro_teacher_nav/config/nav2_params.yaml
```

Cherchez `max_vel_x: 0.20` dans la section `controller_server` et
remplacez par :

```yaml
max_vel_x: 0.08
```

Sauvez (`Ctrl-O`, `Enter`, `Ctrl-X`).

Recompilez le paquet :

```bash
cd /root/m3pro_teacher_ws
colcon build --symlink-install --packages-select m3pro_teacher_nav
source install/setup.bash
```

Relancez Nav2 (même commande qu'à la Partie 3), refaites la
localisation AMCL, envoyez un goal.

**Comparez :** le robot est maintenant beaucoup plus lent.

> **Important :** remettez `max_vel_x: 0.20` avant de passer à la
> partie suivante, sinon les autres exercices seront pénibles.

Question :

```text
Quel serait l'inconvénient d'une vitesse trop élevée (ex: 0.5 m/s) ?
```

Réponse :

```text
À 0.5 m/s, le robot parcourt 5 cm entre deux scans lidar (10 Hz).
Il réagit trop tard aux obstacles imprévus. De plus, le contrôleur
a du mal à stabiliser la trajectoire à haute vitesse avec une
tolérance de 15 cm — le robot dépasse le goal et doit faire
demi-tour.
```

---

## Partie 11 : Test d'évitement d'obstacle dynamique

Envoyez le robot vers un point éloigné depuis RViz.

Pendant qu'il navigue :

```text
1. Placez-vous (doucement) sur son chemin, à ~1 m devant lui
2. Observez RViz : la local_costmap doit s'illuminer à votre position
3. Le contrôleur local doit recalculer une trajectoire qui vous évite
4. Si le passage est complètement bloqué, le behavior_server peut
   lancer un "spin" (rotation sur place) pour chercher une alternative
```

Écoutez les logs Nav2, vous devriez voir :

```text
[controller_server] Passing new path to controller
[bt_navigator] Recovery node started
```

Question :

```text
Pourquoi le global_costmap ne suffit-il pas à éviter une personne
qui traverse ?
```

Réponse :

```text
Le global_costmap est basé sur la carte sauvegardée + les
obstacles lidar observés. Il est lent à mettre à jour. Le
local_costmap, lui, se reconstruit à chaque tick (~5-10 Hz) avec
le lidar live : c'est lui qui "voit" les obstacles dynamiques
à temps pour que le contrôleur réagisse.
```

Question :

```text
Comment faire pour que le robot reprenne sa route une fois que
vous vous êtes écarté ?
```

Réponse :

```text
Le local_costmap "efface" naturellement les obstacles qui
disparaissent (clearing). Le planner recalcule, et la navigation
reprend automatiquement. Aucune action manuelle n'est nécessaire.
```

---

## Partie 12 : Bonus — mini-script de patrouille

Écrivez un petit script Python qui envoie 3 goals en boucle. Le robot
fait la ronde entre trois points.

Créez un fichier sur le robot :

```bash
mkdir -p /root/m3pro_teacher_ws/patrol
nano /root/m3pro_teacher_ws/patrol/patrol.py
```

Collez :

```python
#!/usr/bin/env python3
import time
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped

WAYPOINTS = [
    (0.5, 0.0, 1.0),   # (x, y, w)
    (1.0, 1.0, 0.707),
    (0.0, 1.0, -0.707),
]

class Patrol(Node):
    def __init__(self):
        super().__init__("patrol")
        self.pub = self.create_publisher(PoseStamped, "/goal_pose", 10)
        self.index = 0
        self.create_timer(15.0, self.tick)  # un goal toutes les 15 s

    def tick(self):
        x, y, w = WAYPOINTS[self.index % len(WAYPOINTS)]
        msg = PoseStamped()
        msg.header.frame_id = "map"
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.pose.position.x = x
        msg.pose.position.y = y
        msg.pose.orientation.w = w
        self.pub.publish(msg)
        self.get_logger().info(f"Goal #{self.index}: ({x:.2f}, {y:.2f})")
        self.index += 1

def main():
    rclpy.init()
    rclpy.spin(Patrol())

if __name__ == "__main__":
    main()
```

Lancez :

```bash
python3 /root/m3pro_teacher_ws/patrol/patrol.py
```

Le robot va patrouiller entre les 3 points.

> Adaptez les coordonnées aux dimensions de votre carte. Trouvez des
> points valides en cliquant dans RViz et en lisant les coordonnées
> affichées en bas de la fenêtre.

Question :

```text
Pourquoi attendre 15 s entre deux goals plutôt que d'en enchaîner
immédiatement ?
```

Réponse :

```text
Envoyer un nouveau goal pendant qu'un autre est en cours
l'annule. Il faut laisser au robot le temps d'atteindre le
précédent. Une version plus propre utiliserait l'action
/navigate_to_pose au lieu de publier sur /goal_pose, pour
attendre le feedback "SUCCEEDED".
```

---

## Partie 13 : Bonus — envoyer un goal depuis le dashboard web

Si le dashboard web tourne (`ros2 launch m3pro_teacher_web
web_dashboard.launch.py`), ouvrez `http://192.168.50.102:8080`.

```text
1. Cliquez sur la carte à l'endroit souhaité (un marqueur orange apparaît)
2. Cliquez sur "Send Nav Goal"
3. Observez le robot partir
```

Pour annuler :

```text
Cliquez sur "Cancel Navigation"
```

Question :

```text
Par quel topic ROS 2 le dashboard envoie-t-il les goals ?
```

Réponse :

```text
Le dashboard publie sur /goal_pose (type PoseStamped) via
rosbridge. C'est bt_navigator qui récupère ce topic et déclenche
une action /navigate_to_pose.
```

---

## Partie 14 : Nettoyage

Arrêtez les terminaux avec `Ctrl-C` dans cet ordre :

```text
1. Ctrl-C dans le terminal du script patrouille (si lancé)
2. Ctrl-C dans le terminal Nav2
3. Ctrl-C dans le terminal bringup (en dernier)
```

Vérifiez qu'il ne reste aucun processus Nav2 :

```bash
ps -ef | grep -E "nav2|amcl|controller_server|bt_navigator" | grep -v grep
```

S'il reste des processus :

```bash
pkill -TERM -f nav2
pkill -TERM -f bt_navigator
```

Vérifiez que le robot est arrêté :

```bash
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.0}}"
```

---

## Questions de synthèse

```text
Q1. Listez les 5 composants principaux de Nav2 et leur rôle.
```

Réponse :

```text
1. map_server      : charge et publie la carte sauvegardée.
2. amcl            : localise le robot sur la carte (particules).
3. planner_server  : calcule le chemin global A*/Dijkstra.
4. controller_server : suit le chemin → /cmd_vel.
5. behavior_server : gère les situations bloquées (spin, backup).
   + bt_navigator qui orchestre le tout.
```

```text
Q2. Vous chargez Nav2 avec une carte correcte, mais le robot reste
immobile. Citez trois causes possibles.
```

Réponse :

```text
1. AMCL n'a pas encore été initialisé (pas de 2D Pose Estimate).
2. Le bringup Yahboom n'est pas actif → pas d'odométrie → Nav2 en
   lifecycle erreur.
3. Le lifecycle_manager n'a pas activé tous les nodes ("Managed
   nodes are active" absent des logs).
```

```text
Q3. Dans quelle situation AMCL est-il inutile voire nuisible ?
```

Réponse :

```text
Quand slam_toolbox tourne en mode online : il fournit déjà la TF
map → odom. AMCL ferait double emploi et les deux se concurrenceraient
pour publier la même transformation. C'est pour cela que
slam_and_nav.launch.py ne lance PAS AMCL.
```

```text
Q4. Votre robot tourne en rond autour du goal sans jamais s'arrêter.
Quel paramètre vérifier ?
```

Réponse :

```text
xy_goal_tolerance (et dans une moindre mesure yaw_goal_tolerance).
Si elles sont trop petites face à la précision réelle du robot,
le contrôleur n'arrive jamais à les respecter et ne déclare
jamais le goal atteint.
```

```text
Q5. Vous voulez que le robot garde 40 cm de marge avec tous les
obstacles. Quel paramètre modifier ?
```

Réponse :

```text
inflation_radius (dans les deux costmaps). Le robot passera alors
dans les couloirs à au moins 40 cm des murs, plus le rayon de son
footprint. Attention : dans des couloirs étroits, le robot peut ne
plus trouver de chemin.
```

---

## Défis bonus

Pour les étudiants qui finissent en avance :

1. **Retour automatique à la base.** Modifiez le script de patrouille
   pour qu'il retourne toujours au point `(0, 0)` entre chaque waypoint.

2. **Multi-robots.** Si plusieurs robots partagent la salle, changez
   le `ROS_DOMAIN_ID` de chacun pour les isoler. Vérifiez avec
   `ros2 node list`.

3. **Changer de planificateur.** Dans `nav2_params.yaml`, remplacez le
   plugin `GridBased` par un autre (ex: `SmacHybrid` pour un
   planificateur kinodynamique). Observez la différence sur des
   chemins courbes.

4. **Zone interdite.** Créez une *keepout zone* (zone que le robot doit
   éviter même si elle est libre) en éditant manuellement le `.pgm`
   de la carte dans GIMP : tracez une ligne noire en travers d'un
   couloir. Sauvez, relancez Nav2, envoyez un goal qui imposerait de
   traverser la zone : le robot doit faire le tour.

5. **Mesure de performance.** Écrivez un script qui envoie 10 goals
   et mesure le temps moyen de parcours. Comparez avant/après une
   modification de `max_vel_x`.
