---
title: Tableau de bord
parent: Francais
nav_order: 5
---

# Observer le robot: tableau de bord, Foxglove, RViz
{: .no_toc }

Trois facons de voir ce que le robot voit et de lui envoyer des commandes.

## Sommaire
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Quel outil choisir ?

| Outil | Installation | Ideal pour |
| --- | --- | --- |
| Tableau de bord web | Aucune, juste un navigateur | Verifications rapides, demos, envoi d'objectifs |
| Foxglove Studio | Application bureau gratuite | Inspection riche, enregistrement, dispositions personnalisees |
| RViz | Sur le robot, vu via VNC | La vue 3D ROS classique, costmaps, planificateurs |

Les trois se connectent au meme robot en meme temps.

## Le tableau de bord web

Un tableau de bord navigateur servi par le robot lui-meme. Aucune
installation de votre cote.

**Le lancer:**

```bash
ros2 launch m3pro_teacher_web web_dashboard.launch.py
```

Cela demarre deux serveurs:

- **Port 8080** - HTTP: la page du tableau de bord et le flux camera MJPEG.
- **Port 9090** - WebSocket rosbridge: les topics et services ROS en JSON.

Les deux sont necessaires. La page se charge depuis le 8080, puis ouvre une
WebSocket vers le 9090.

**L'ouvrir:** allez sur `http://<robot-ip>:8080`.

Ce que vous obtenez:

- La `/map` en direct dessinee sur un canvas (libre / obstacle / inconnu).
- La pose et le cap du robot sur la carte.
- Le flux camera (`http://<robot-ip>:8080/camera/stream`).
- **Cliquez sur la carte pour envoyer un objectif** - comme le bouton "2D
  Goal Pose" de RViz.
- Un bouton pour sauvegarder la carte courante via le service
  `/slam_toolbox/save_map`.

Il y a aussi une page de ramassage a `http://<robot-ip>:8080/pick.html`,
utilisee par la [recette cliquer-pour-ramasser](bras.html).

> Si `explore.launch.py` ou `click_pick.launch.py` fait deja tourner
> rosbridge sur le 9090, lancez le tableau de bord sans son propre pont:
> `ros2 launch m3pro_teacher_web web_dashboard.launch.py rosbridge:=false`.

## Foxglove Studio

[Foxglove Studio](https://foxglove.dev) est une application bureau gratuite
pour inspecter les donnees ROS. Elle a besoin d'un serveur rosbridge qui
tourne sur le robot (port 9090).

Les lancements qui demarrent deja rosbridge: `web_dashboard.launch.py`,
`explore.launch.py`, `click_pick.launch.py`. Si aucun ne tourne, demarrez un
pont autonome:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
```

**Se connecter:** ouvrez Foxglove, choisissez **Open connection ->
Rosbridge**, et entrez:

```text
ws://<robot-ip>:9090
```

**Une disposition utile a 4 panneaux:**

| Panneau | Affiche |
| --- | --- |
| 3D | `/map`, `/tf`, le modele du robot, `/scan_multi`, le chemin Nav2 `/plan` |
| Image | `/camera/color/image_raw` ou `/teacher/detection_image` |
| Raw Messages | `/battery`, `/teacher/fusion_state` |
| Publish | publier `/goal_pose` pour envoyer le robot quelque part |

Dans le panneau 3D, reglez le repere d'affichage sur `map` une fois le SLAM
lance.

**Envoyer un objectif depuis Foxglove:** ajoutez un panneau Publish, reglez
le topic sur `/goal_pose`, le type `geometry_msgs/msg/PoseStamped`, et
publiez une pose avec `header.frame_id: map`.

**Enregistrer des donnees:** Foxglove peut enregistrer la connexion en
direct dans un fichier `.mcap`, que vous pourrez rejouer hors ligne plus
tard.

## RViz

RViz est le visualiseur 3D ROS classique. Sur ce robot il tourne **sur le
Jetson** et vous le voyez via VNC, car diffuser une fenetre 3D sur le reseau
est lourd.

Le cours fournit une disposition prete a l'emploi:

```bash
ros2 run rviz2 rviz2 -d \
  $(ros2 pkg prefix m3pro_teacher_nav)/share/m3pro_teacher_nav/rviz/nav2_view.rviz
```

Le preset `nav2_view.rviz` montre: une grille, le modele du robot, l'arbre
TF, le scan laser fusionne, la `/map`, les costmaps locale et globale, les
chemins global et local, et les marqueurs de detection.

**Le seul reglage qui compte:** le **Fixed Frame**.

- Avant le demarrage du SLAM, mettez-le sur `odom`.
- Une fois le SLAM ou Nav2 lance, mettez-le sur `map`.

Si RViz dit `Fixed Frame [map] does not exist`, aucun noeud ne publie encore
la carte. Voir [Depannage](depannage.html).

**Note VNC:** RViz via VNC peut ramer. Pour la surveillance quotidienne, le
tableau de bord web ou Foxglove est plus leger. Utilisez RViz quand vous
avez specifiquement besoin des visualisations costmap et planificateur.

## Envoyer des objectifs: les trois outils cote a cote

| Outil | Comment envoyer un objectif |
| --- | --- |
| Tableau de bord web | Cliquer un point sur la carte. |
| Foxglove | Panneau Publish sur `/goal_pose`. |
| RViz | Bouton "2D Goal Pose" de la barre d'outils. |
| Terminal | `ros2 topic pub --once /goal_pose ...` (voir [Recettes](recettes.html)). |

Les quatre publient le meme message `/goal_pose`. Choisissez celui qui est
devant vous.
