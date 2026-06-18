# Tutoriel : Cartographie autonome "style Roomba" avec le M3 Pro

Ce tutoriel explique comment lancer une exploration autonome sur le robot
Yahboom M3 Pro. Le robot construit sa carte en même temps qu'il se déplace,
choisit lui-même ses objectifs (front d'exploration) et revient à son point
de départ à la fin. Visualisation en 3D depuis le Mac via Foxglove Studio.

---

## Objectifs pédagogiques

À la fin de ce tutoriel, vous saurez :

1. **Comprendre la pile logicielle** : comment SLAM, Nav2 et l'exploration
   autonome s'articulent via des topics ROS 2.
2. **Lancer la pile complète** avec un seul `ros2 launch`.
3. **Visualiser à distance** la carte, les scans laser en 3D, la trajectoire
   et les fronts d'exploration depuis Foxglove Studio sur votre Mac.
4. **Régler le comportement d'exploration** (style "Roomba" – maximiser la
   couverture en privilégiant les grands fronts de découverte).
5. **Sauvegarder la carte** une fois l'exploration terminée.

---

## 1. Architecture de la pile

```
                               ┌──────────────────────┐
                               │ Foxglove Studio (Mac)│
                               │   vue 3D, carte,     │
                               │   téléopération      │
                               └──────────┬───────────┘
                                          │ ws://<robot>:8765
                               ┌──────────┴───────────┐
                               │  rosbridge_server    │
                               │    (port 8765)       │
                               └──────────┬───────────┘
                                          │
   ┌──────────────┐   /scan_multi   ┌─────┴──────┐   /map    ┌────────────┐
   │  bringup     │────────────────▶│ slam_toolbox│──────────▶│ Nav2       │
   │  Yahboom     │   /merged_cloud │            │  /tf      │ (planner,  │
   │  (lidars,    │   /odom, /imu   │ map+odom TF │  /cmd_vel │  controller│
   │   EKF, RSP)  │                 │             │◀─────────│  costmaps) │
   └──────────────┘                 └─────────────┘            └─────┬────┘
                                                                     │
                                        /global_costmap/costmap      │
                                                  ▼                  │
                                         ┌──────────────┐            │
                                         │ explore_lite │─goals─────▶│
                                         │  (frontier   │  nav2      │
                                         │   choix)     │  /navigate │
                                         └──────────────┘
```

**Points clés :**

- `ira_laser_tools/laserscan_multi_merger` (dans le bringup) fusionne les
  deux lidars en `/scan_multi` en respectant les transformations TF — c'est
  la raison pour laquelle nous n'utilisons plus notre ancien `sensor_fusion`
  (il ignorait le décalage de ±0.17 m entre les deux capteurs).
- `slam_toolbox` publie `/map` ET la TF `map → odom`.
- `Nav2` lit la carte et fait la planification d'itinéraire + évitement
  d'obstacles local (costmaps).
- `explore_lite` choisit les fronts (boundary entre connu-libre et inconnu)
  et envoie des objectifs à Nav2 via l'action `/navigate_to_pose`.
- `rosbridge_server` expose tout le graphe ROS 2 via WebSocket pour que
  Foxglove Studio (côté Mac) puisse visualiser sans installer ROS.

---

## 2. Prérequis

### Sur le robot

- Container Docker `rosmaster-m3pro-nano` en cours d'exécution.
- Container `micro-ros-agent` en cours (bridge UART du microcontrôleur).
- Wi-Fi connecté (script `scripts/setup_wifi_events.sh` déjà exécuté).
- Workspace `m3pro_teacher_ws` déployé et compilé :
  ```bash
  CONTAINER=<nom_container> ./scripts/deploy_workspace_to_robot.sh <ip_robot>
  ```

### Sur le Mac

- **Foxglove Studio** : https://foxglove.dev/download (application native gratuite).

---

## 3. Démarrer la pile d'exploration

Depuis votre Mac, dans deux terminaux séparés (ou via `tmux`) :

### Terminal 1 — bringup matériel (toujours d'abord)

```bash
ssh jetson@<ip_robot>
docker exec -it -e ROS_DOMAIN_ID=30 -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  <nom_container> bash
source /opt/ros/humble/setup.bash
source /root/M3Pro_ws/install/setup.bash
ros2 launch M3Pro_navigation base_bringup.launch.py
```

Ce que ça démarre :
- `robot_state_publisher` (arbre TF URDF)
- `imu_filter_madgwick` (fusion IMU)
- `laserscan_multi_merger` → `/scan_multi`
- `ekf_node` (robot_localization) → `/odom` + TF `odom → base_footprint`

**Attendez de voir** `First IMU message received` et `Subscribing to topics 2`
dans les logs.

### Terminal 2 — SLAM + Nav2 + exploration + rosbridge

```bash
ssh jetson@<ip_robot>
docker exec -it -e ROS_DOMAIN_ID=30 -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  <nom_container> bash
source /opt/ros/humble/setup.bash
source /root/M3Pro_ws/install/setup.bash
source /root/m3pro_teacher_ws/install/setup.bash
ros2 launch m3pro_teacher_nav explore.launch.py
```

Ce que ça démarre :
- `slam_toolbox` (mode async, mapping)
- Nav2 complet (controller, planner, smoother, behaviors, bt_navigator,
  lifecycle_manager)
- `explore_lite` (exploration par fronts)
- `rosbridge_server` sur le port `8765`

Le robot commence à se déplacer tout seul dès que `explore_lite` détecte
un front à explorer (quelques secondes après le démarrage).

---

## 4. Visualiser depuis Foxglove Studio (sur le Mac)

1. Ouvrez Foxglove Studio.
2. **Open connection** → **Rosbridge (ROS 1 & 2)**.
3. URL : `ws://<ip_robot>:8765` → **Open**.
4. Ajoutez un panneau **3D**. Dans ses paramètres :
   - **Display frame** : `map`
   - Topics à activer :
     - `/merged_cloud` — le nuage de points laser 3D
     - `/map` — la carte d'occupation (grille)
     - `/global_costmap/costmap` — costmap globale (obstacles gonflés)
     - `/local_costmap/costmap` — costmap locale (évitement en temps réel)
     - `/plan` — l'itinéraire calculé par Nav2
     - `/explore/frontiers` — les fronts d'exploration candidats (markers)
     - Transforms : tout l'arbre TF

Ajoutez aussi :
- Un panneau **Image** sur `/camera/color/image_raw` si la caméra est active.
- Un panneau **Teleop** mappé sur `/cmd_vel` pour reprendre la main si besoin.

---

## 5. Réglage du comportement d'exploration

Le fichier `src/m3pro_teacher_nav/config/explore_params.yaml` contrôle la
stratégie de `explore_lite`. Le score d'un front est :

```
score = gain_scale · taille_du_front
      − potential_scale · distance_de_parcours
      − orientation_scale · changement_de_cap
```

### Configuration actuelle ("Roomba, circonférence max")

```yaml
potential_scale: 1.0    # défaut : 3.0 — on pénalise peu la distance
gain_scale: 5.0         # défaut : 1.0 — on privilégie fortement les GROS fronts
orientation_scale: 0.0  # on ignore l'angle
min_frontier_size: 0.50 # on ignore les fronts < 50 cm (bruit)
return_to_init: true    # retour au point de départ quand tout est cartographié
```

### À ajuster selon l'objectif

| Comportement souhaité              | Paramètre à changer                        |
| ---------------------------------- | ------------------------------------------ |
| Exploration plus prudente (proche) | ↑ `potential_scale` (ex : 3.0)             |
| Privilégier les très grands fronts | ↑ `gain_scale` (ex : 10.0)                 |
| Ignorer le bruit de carte          | ↑ `min_frontier_size` (ex : 0.80)          |
| Ne pas revenir au départ           | `return_to_init: false`                    |
| Re-planifier plus souvent          | ↑ `planner_frequency` (ex : 1.0 au lieu de 0.5) |

Après modification, recompilez :

```bash
cd ~/m3pro_teacher_ws && colcon build --symlink-install --packages-select m3pro_teacher_nav
```

---

## 6. Sauvegarder la carte

Quand `explore_lite` signale `Exploration completed` (ou quand vous voulez
arrêter) :

```bash
ros2 run nav2_map_server map_saver_cli -f ~/maps/ma_piece
```

Cela crée `~/maps/ma_piece.pgm` et `~/maps/ma_piece.yaml`. Pour relocaliser
plus tard sur cette carte (au lieu de re-mapper), utilisez `slam_toolbox` en
mode `localization` avec `map_file_name: ~/maps/ma_piece.yaml`.

---

## 7. Dépannage

| Symptôme                                                                 | Cause probable                               | Action                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Invalid frame ID "odom" passed to canTransform`                         | EKF pas encore prêt ou MCU déconnecté        | Vérifier que `/odom_raw` publie. Relancer `scripts/restart_microros_agent.sh`.                 |
| `EKF: Failed to meet update rate`                                        | Le Jetson Nano est saturé (CPU)              | Réduire `frequency: 6.0` → `4.0` dans `yahboom_M3Pro_ekf.yaml`. Fermer rviz s'il tourne aussi. |
| Le robot ne bouge pas après le démarrage                                 | `explore_lite` attend la costmap globale     | Patientez ~15 s. Vérifier que `/global_costmap/costmap` publie.                                 |
| La carte sort en forme de V dans un couloir droit                        | Fusion lidar incorrecte (ancien code)        | **Déjà corrigé** — SLAM utilise `/scan_multi` de `ira_laser_tools`.                             |
| Foxglove se connecte mais rien ne s'affiche                              | **Display frame** mal réglé                  | Mettre **Display frame** = `map` (pas `base_link`).                                             |
| Heure cassée après reboot → `apt` / `git` refusent les certificats        | Jetson Nano sans pile RTC                    | `sudo date -u -s "$(wget -qSO /dev/null http://google.com 2>&1 \| awk -F': ' 'tolower($1) ~ /date/{print $2; exit}')"` |

---

## 8. Limites connues

- **CPU du Jetson Nano** : Nav2 + SLAM + EKF + explore + rosbridge saturent
  les 4 cœurs. Si le robot hésite ou si EKF ne publie pas assez vite, passer
  rosbridge côté Mac (`ros2 launch rosbridge_server ...` sur un Mac avec ROS 2
  installé via Docker).
- **Pas de fusion IMU directe dans slam_toolbox** : le scan-matching est la
  seule contrainte de cap. Dans des environnements "sans relief" (long
  couloir), les dérives peuvent apparaître. L'EKF compense via l'odométrie
  roues + IMU qui alimente `odom → base_footprint`.

---

## 9. Prochaine étape (sprint suivant)

**Interface web de contrôle** servie depuis le robot (ou le Mac) avec :

- Vue caméra en direct (WebSocket + `/camera/color/image_raw`)
- Vue carte 3D avec **Three.js** (subscribe à `/map` + `/merged_cloud` via roslibjs)
- Boutons d'action :
  - **Mapper** (lance `explore.launch.py`)
  - **Configurer** (slider pour `gain_scale`, `potential_scale`, etc.)
  - **Lancer la découverte** (appel à une action Nav2 ou trigger d'explore)
  - **Contrôle clavier** (publie sur `/cmd_vel`)
  - **Retour maison** (annule explore, publie goal = pose initiale)
  - **Sauvegarder la carte** (appel au service `map_saver`)
  - **Abandonner** (cancel_all sur Nav2)

Stack envisagé : FastAPI (Python) + WebSocket + **roslibjs** (qui parle
déjà rosbridge) + Three.js pour le rendu 3D.
