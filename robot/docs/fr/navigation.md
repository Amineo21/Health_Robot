---
title: Navigation
parent: Francais
nav_order: 2
---

# Navigation: cartographie et conduite autonome
{: .no_toc }

Construire la carte d'une piece, puis laisser le robot se rendre seul a
n'importe quel point.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Avant de commencer

Le bringup materiel (couche 2) doit tourner. Voir
[Demarrage](demarrage.html). Toutes les commandes ci-dessous se lancent
**dans le conteneur `m3pro`** avec l'environnement source.

## Quel fichier de lancement utiliser ?

| Objectif | Fichier de lancement | Paquet |
| --- | --- | --- |
| Cartographier une piece pour la premiere fois | `slam_online.launch.py` | `m3pro_teacher_nav` |
| Naviguer en autonomie sur une carte sauvegardee | `navigation.launch.py` | `m3pro_teacher_nav` |
| Cartographier et naviguer en meme temps | `slam_and_nav.launch.py` | `m3pro_teacher_nav` |
| Explorer et cartographier sans intervention | `explore.launch.py` | `m3pro_teacher_nav` |
| Se localiser seulement sur une carte sauvegardee | `localize.launch.py` | `m3pro_teacher_nav` |

## Recette 1: Construire une carte avec le SLAM

Le SLAM (cartographie et localisation simultanees) construit la carte tout
en suivant la position du robot dessus. Le cours utilise `slam_toolbox` en
mode async, adapte au CPU du Jetson.

**Etape 1.** Lancer le SLAM.

```bash
ros2 launch m3pro_teacher_nav slam_online.launch.py
```

Cela lance le fusionneur de scans (un `/scan_merged` a 360 degres),
`slam_toolbox`, et RViz preregle pour montrer la carte.

**Etape 2.** Conduire le robot lentement dans la piece. Dans un second
shell:

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

Conduisez **lentement**. Couvrez tous les murs. Repassez par des endroits
deja vus pour que le SLAM ferme des boucles et resserre la carte.

**Etape 3.** Regarder la carte grandir. Ouvrez RViz, Foxglove ou le tableau
de bord et observez le topic `/map`. L'espace libre est sombre, les
obstacles sont clairs, l'inconnu est gris.

**Etape 4.** Sauvegarder la carte quand elle semble complete.

```bash
ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap \
  "{name: {data: /root/maps/ma_piece}}"
```

Cela ecrit `ma_piece.yaml` et `ma_piece.pgm` dans `/root/maps`. Ce dossier
est conserve entre les redemarrages sur un robot prepare.

> Astuce. Vous pouvez aussi sauvegarder avec l'outil standard:
> `ros2 run nav2_map_server map_saver_cli -f /root/maps/ma_piece`.

## Recette 2: Naviguer en autonomie sur une carte sauvegardee

Une fois une carte disponible, Nav2 peut planifier et suivre des chemins
vers n'importe quel objectif.

**Etape 1.** Lancer Nav2 avec votre carte.

```bash
ros2 launch m3pro_teacher_nav navigation.launch.py \
  map:=/root/maps/ma_piece.yaml
```

Cela charge la carte, demarre AMCL (localisation par filtre a particules),
le planificateur, le controleur et les comportements de recuperation.

**Etape 2.** Dire au robot ou il se trouve. Le robot ne connait pas sa pose
de depart sur la carte chargee. Dans RViz, utilisez le bouton **2D Pose
Estimate** et cliquez ou se trouve reellement le robot, en pointant dans sa
direction. Ou publiez-la:

```bash
ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped \
  "{header: {frame_id: map}, pose: {pose: {position: {x: 0.0, y: 0.0}, orientation: {w: 1.0}}}}"
```

**Etape 3.** Envoyer un objectif de navigation.

```bash
# Simple: publier une pose objectif (le bouton "2D Goal Pose" de RViz fait pareil)
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}"
```

Le robot planifie un chemin global (`/plan`), le suit avec le planificateur
local (`/local_plan`), et s'arrete dans la tolerance de l'objectif.

Pour un controle complet avec retour d'information, envoyez l'objectif comme
une action:

```bash
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.5}, orientation: {w: 1.0}}}}"
```

## Recette 3: Cartographier et naviguer en meme temps

`slam_and_nav.launch.py` fait tourner `slam_toolbox` **et** Nav2 ensemble. Il
n'y a ni AMCL ni fichier de carte: le SLAM fournit a la fois la carte et la
localisation.

```bash
ros2 launch m3pro_teacher_nav slam_and_nav.launch.py
```

Envoyez les objectifs exactement comme dans la recette 2. Le robot navigue
dans l'espace deja cartographie et etend la carte au fur et a mesure. C'est
la facon la plus simple de tester la navigation sans sauvegarder de carte.

## Recette 4: Explorer une piece sans intervention

`explore.launch.py` ajoute l'exploration de frontieres: le robot trouve la
limite entre l'espace connu et inconnu et s'y rend seul, comme un robot
aspirateur.

```bash
ros2 launch m3pro_teacher_nav explore.launch.py
```

Il fait tourner `slam_toolbox` + Nav2 + `explore_lite` + rosbridge (port
9090 pour Foxglove). Le robot cartographie toute la piece sans teleop. Quand
la carte semble finie, sauvegardez-la comme dans la recette 1.

## Sauvegarder et reutiliser des cartes

| Action | Commande |
| --- | --- |
| Sauvegarder la carte courante | `ros2 service call /slam_toolbox/save_map slam_toolbox/srv/SaveMap "{name: {data: /root/maps/ma_piece}}"` |
| Sauvegarder avec l'outil standard | `ros2 run nav2_map_server map_saver_cli -f /root/maps/ma_piece` |
| Lister les cartes sauvegardees | `ls /root/maps` |
| Reutiliser une carte pour la navigation | `ros2 launch m3pro_teacher_nav navigation.launch.py map:=/root/maps/ma_piece.yaml` |

Une carte, ce sont deux fichiers: `nom.yaml` (metadonnees: resolution,
origine) et `nom.pgm` (l'image).

## Ajuster le comportement

Les deux fichiers de parametres se trouvent dans
`m3pro_teacher_nav/config/`.

**`slam_toolbox_params.yaml`** controle la cartographie:

```yaml
resolution: 0.05            # metres par cellule de carte (5 cm)
max_laser_range: 3.5        # portee utile du lidar
minimum_travel_distance: 0.5 # n'insere un scan qu'apres 0.5 m parcourus
minimum_travel_heading: 0.5  # ... ou 0.5 rad de rotation
```

**`nav2_params.yaml`** controle la conduite:

```yaml
# Limites de vitesse du planificateur local
max_vel_x: 0.20             # vitesse avant (m/s), prudente en interieur
max_vel_theta: 0.8          # vitesse de rotation (rad/s)
xy_goal_tolerance: 0.15     # "arrive" a moins de 15 cm

# Inflation des obstacles: un halo de securite autour des murs
inflation_radius: 0.35      # distance que le robot garde
```

Augmentez `max_vel_x` pour un robot plus rapide, baissez-le pour plus de
securite. Augmentez `inflation_radius` pour que le robot s'eloigne plus des
murs.

## Ce qui alimente la costmap

Nav2 construit sa carte d'obstacles a partir de **deux** capteurs:

- `/scan_multi` (ou `/teacher/scan_merged`) - le lidar a 360 degres.
- `/teacher/camera_scan` - un scan virtuel fabrique depuis la camera de
  profondeur, qui detecte les obstacles bas que le lidar 2D rate. Voir
  [Bras](bras.html) et [Recettes](recettes.html).

## La suite

- [Bras](bras.html) - ramasser les objets vers lesquels vous naviguez.
- [Integration](integration.html) - enchainer navigation, detection et bras.
