# Extraits de code : paquet `m3pro_teacher_nav`

Objectif : repérer les parties importantes des fichiers de lancement et
de configuration pour le SLAM et la navigation Nav2.

Chemin du paquet :

```text
src/m3pro_teacher_nav/
├── launch/
│   ├── slam_online.launch.py        # SLAM seul (cartographie)
│   ├── navigation.launch.py         # Nav2 sur carte déjà faite
│   └── slam_and_nav.launch.py       # SLAM + Nav2 simultanés
├── config/
│   ├── slam_toolbox_params.yaml     # paramètres du SLAM
│   └── nav2_params.yaml             # paramètres de Nav2
└── maps/                            # cartes sauvegardées
```

---

## 1. `slam_online.launch.py` — Lancer le SLAM seul

**Rôle** : démarrer la fusion de scans + slam_toolbox + RViz pour
construire une carte.

### Partie importante 1 : fusion de scans avant le SLAM

```python
# fichier: slam_online.launch.py, ligne ~39
Node(
    package="m3pro_teacher_demos",
    executable="sensor_fusion_rgb_demo",
    parameters=[{
        "simulate": False,
        "front_scan_topic": "/scan0",
        "rear_scan_topic": "/scan1",
        "enable_beep": False,
    }],
    output="screen",
),
```

> Pourquoi : slam_toolbox consomme `/teacher/scan_merged` (360°), pas les
> scans individuels. Ce noeud produit ce topic.

### Partie importante 2 : lancement de slam_toolbox

```python
# fichier: slam_online.launch.py, ligne ~52
Node(
    package="slam_toolbox",
    executable="async_slam_toolbox_node",      # mode asynchrone (Jetson)
    name="slam_toolbox",
    parameters=[
        slam_params,                            # config YAML
        {"use_sim_time": LaunchConfiguration("use_sim_time")},
    ],
    output="screen",
),
```

> Le mode `async` est recommandé sur Jetson : il découple réception des
> scans et mise à jour de la carte.

### Piège à éviter

```text
NOTE: on NE lance PAS notre propre robot_state_publisher ici.
Le bringup Yahboom en fournit déjà un. En lancer deux causerait des
conflits de timestamps TF (l'horloge du microcontrôleur diffère de
celle du système).
```

---

## 2. `slam_toolbox_params.yaml` — Paramètres SLAM

### Partie importante 1 : repères TF

```yaml
# fichier: slam_toolbox_params.yaml, ligne ~16
odom_frame: odom              # repère odométrique (dérive)
map_frame: map                # repère fixe de la carte
base_frame: base_footprint    # robot au sol
scan_topic: /teacher/scan_merged   # scan d'entrée (fusionné)
```

> slam_toolbox publie la transformation `map → odom` pour corriger la
> dérive.

### Partie importante 2 : résolution et portée

```yaml
# fichier: slam_toolbox_params.yaml, ligne ~25
map_update_interval: 3.0      # maj carte toutes les 3 s
resolution: 0.05              # une cellule = 5 cm
max_laser_range: 3.5          # portée max du lidar (m)
```

> `resolution: 0.05` signifie que chaque pixel de la carte mesure 5 cm.
> Plus petit = carte plus détaillée mais plus lourde en mémoire.

### Partie importante 3 : seuils pour accepter un nouveau scan

```yaml
# fichier: slam_toolbox_params.yaml, ligne ~32
minimum_travel_distance: 0.3  # ne traite un nouveau scan que si
minimum_travel_heading: 0.3   # le robot a bougé de > 30 cm ou tourné
                              # de > 0.3 rad
```

> Évite de saturer le SLAM avec des scans quasi identiques quand le
> robot est immobile.

### Partie importante 4 : fermeture de boucle

```yaml
# fichier: slam_toolbox_params.yaml, ligne ~43
do_loop_closing: true                          # activer la fermeture de boucle
loop_match_minimum_chain_size: 10              # au moins 10 scans dans la boucle
loop_match_minimum_response_coarse: 0.35       # seuil de match grossier
loop_match_minimum_response_fine: 0.45         # seuil de match fin
loop_search_maximum_distance: 3.0              # distance max pour chercher une boucle
```

> Cœur du SLAM : quand le robot revient à un endroit déjà vu, la carte
> est recollée pour que les deux passages coïncident.

### Partie importante 5 : mode

```yaml
# fichier: slam_toolbox_params.yaml, ligne ~68
mode: mapping
# Pour localiser sur une carte existante à la place :
# mode: localization
# map_file_name: /path/to/saved_map
```

---

## 3. `navigation.launch.py` — Nav2 sur carte déjà construite

**Rôle** : charger une carte sauvegardée et démarrer Nav2 complet (AMCL +
planner + controller + behaviors).

### Partie importante 1 : paramètre `map` obligatoire

```python
# fichier: navigation.launch.py, ligne ~31
DeclareLaunchArgument("map", description="Full path to the map YAML file"),
```

> Usage :
>
> ```bash
> ros2 launch m3pro_teacher_nav navigation.launch.py \
>   map:=/root/m3pro_teacher_ws/src/m3pro_teacher_nav/maps/salle.yaml
> ```

### Partie importante 2 : inclusion du bringup Nav2 standard

```python
# fichier: navigation.launch.py, ligne ~49
IncludeLaunchDescription(
    PythonLaunchDescriptionSource(
        PathJoinSubstitution([nav2_bringup_share, "launch", "bringup_launch.py"])
    ),
    launch_arguments={
        "map": LaunchConfiguration("map"),
        "params_file": nav2_params,         # notre fichier YAML custom
        "use_sim_time": LaunchConfiguration("use_sim_time"),
        "autostart": "true",                # démarre automatiquement les lifecycle nodes
    }.items(),
),
```

> On réutilise le bringup officiel de `nav2_bringup` avec nos paramètres
> pédagogiques. Pas besoin de recoder AMCL, planner, etc.

---

## 4. `nav2_params.yaml` — Paramètres de navigation

### Partie importante 1 : AMCL (localisation)

```yaml
# fichier: nav2_params.yaml, ligne ~7
amcl:
  ros__parameters:
    base_frame_id: base_footprint
    global_frame_id: map
    odom_frame_id: odom
    min_particles: 500        # particules minimum
    max_particles: 2000       # particules maximum
    laser_max_range: 3.5
    laser_model_type: likelihood_field
    scan_topic: /teacher/scan_merged
```

> AMCL = filtre à particules Monte-Carlo pour localiser le robot sur la
> carte chargée.

### Partie importante 2 : limites de vitesse (DWB controller)

```yaml
# fichier: nav2_params.yaml, ligne ~88
FollowPath:
  plugin: dwb_core::DWBLocalPlanner
  max_vel_x: 0.20          # vitesse linéaire max (m/s) — prudent pour une salle
  max_vel_theta: 0.8       # vitesse de rotation max (rad/s)
  acc_lim_x: 1.0           # accélération max (m/s²)
  acc_lim_theta: 2.0       # accélération angulaire max (rad/s²)
  xy_goal_tolerance: 0.15  # arrivé si à moins de 15 cm
```

> À modifier pour rendre le robot plus rapide (plus nerveux) ou plus lent
> (plus sûr). 0.20 m/s est prudent pour un environnement intérieur.

### Partie importante 3 : footprint (contour du robot)

```yaml
# fichier: nav2_params.yaml, ligne ~140
# Rectangle : M3 Pro 0.38m x 0.32m avec marge de sécurité
footprint: "[[-0.19, -0.16], [-0.19, 0.16], [0.19, 0.16], [0.19, -0.16]]"
```

> Utilisé par Nav2 pour vérifier si le robot passe dans un passage
> étroit. Les coordonnées sont en mètres, par rapport à `base_link`.

### Partie importante 4 : costmap locale — sources d'observation

```yaml
# fichier: nav2_params.yaml, ligne ~142
obstacle_layer:
  plugin: nav2_costmap_2d::ObstacleLayer
  observation_sources: scan camera    # deux sources !
  scan:
    topic: /teacher/scan_merged       # lidar 360°
    clearing: true                    # efface les obstacles vus à travers
    marking: true
    raytrace_max_range: 3.5
  camera:
    topic: /teacher/camera_scan       # scan virtuel depth caméra
    clearing: false                   # seulement ajouter, pas effacer
    marking: true
    raytrace_max_range: 2.0
```

> Deux capteurs alimentent la costmap : le lidar (360°, efface) et la
> caméra de profondeur (frontal, n'efface pas car champ plus étroit).

### Partie importante 5 : inflation

```yaml
# fichier: nav2_params.yaml, ligne ~166
inflation_layer:
  plugin: nav2_costmap_2d::InflationLayer
  cost_scaling_factor: 3.0     # vitesse de décroissance du gradient
  inflation_radius: 0.35       # rayon d'inflation en mètres
```

> L'inflation crée un halo de coût autour des obstacles. Le robot évite
> naturellement de raser les murs.

### Partie importante 6 : planificateur global

```yaml
# fichier: nav2_params.yaml, ligne ~217
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: nav2_navfn_planner/NavfnPlanner
      tolerance: 0.5
      use_astar: false          # false = Dijkstra (plus robuste)
      allow_unknown: true       # autorise à planifier dans l'inconnu
```

### Partie importante 7 : comportements de récupération

```yaml
# fichier: nav2_params.yaml, ligne ~238
behavior_server:
  ros__parameters:
    behavior_plugins: ["spin", "backup", "drive_on_heading", "wait"]
    spin:          { plugin: nav2_behaviors/Spin }
    backup:        { plugin: nav2_behaviors/BackUp }
    drive_on_heading: { plugin: nav2_behaviors/DriveOnHeading }
    wait:          { plugin: nav2_behaviors/Wait }
```

> Quand le robot est bloqué : il peut tourner sur place, reculer, attendre.
> Le bt_navigator déclenche ces comportements automatiquement.

### Partie importante 8 : lifecycle manager

```yaml
# fichier: nav2_params.yaml, ligne ~285
lifecycle_manager:
  ros__parameters:
    autostart: true
    node_names:
      - controller_server
      - planner_server
      - behavior_server
      - bt_navigator
      - waypoint_follower
```

> Nav2 utilise les "lifecycle nodes" (configure → activate → deactivate).
> Le lifecycle_manager les active dans le bon ordre au démarrage.

---

## 5. `slam_and_nav.launch.py` — SLAM + Nav2 en même temps

**Rôle** : lancer slam_toolbox ET Nav2 simultanément pour cartographier
et naviguer en même temps.

### Partie importante 1 : pas d'AMCL

```python
# fichier: slam_and_nav.launch.py, ligne ~59
# Nav2 controller + planner (no AMCL needed, SLAM provides localization)
Node(package="nav2_controller",  executable="controller_server",  ...),
Node(package="nav2_smoother",    executable="smoother_server",    ...),
Node(package="nav2_planner",     executable="planner_server",     ...),
Node(package="nav2_behaviors",   executable="behavior_server",    ...),
Node(package="nav2_bt_navigator", executable="bt_navigator",      ...),
```

> Différence clé avec `navigation.launch.py` : pas d'AMCL, pas de
> map_server. C'est slam_toolbox qui fournit la localisation via la TF
> `map → odom` et la carte via le topic `/map`.

### Partie importante 2 : lifecycle manager manuel

```python
# fichier: slam_and_nav.launch.py, ligne ~96
Node(
    package="nav2_lifecycle_manager",
    executable="lifecycle_manager",
    name="lifecycle_manager_navigation",
    parameters=[{
        "autostart": True,
        "node_names": [
            "controller_server", "smoother_server", "planner_server",
            "behavior_server", "bt_navigator",
        ],
    }],
    output="screen",
),
```

> Sans AMCL ni map_server dans la liste, puisqu'ils ne tournent pas en
> mode SLAM.

---

## Résumé : quand utiliser quel launch ?

| Situation                          | Fichier à lancer             |
| ---------------------------------- | ---------------------------- |
| Première cartographie d'une salle  | `slam_online.launch.py`      |
| Navigation dans salle déjà connue  | `navigation.launch.py`       |
| Exploration + navigation en vrac   | `slam_and_nav.launch.py`     |
