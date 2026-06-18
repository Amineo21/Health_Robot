# Cours — Nav2 & Découverte autonome

**Format :** lecture magistrale (notes de l'enseignant).
**Durée :** ~1h15 (50 min de cours + 20 min de démo + 10 min Q/A).
**Prérequis :** cours précédent sur SLAM et téléopération ; les étudiants
savent lancer `slam_online.launch.py` et conduire au clavier.
**Matériel :** vidéoprojecteur, un robot allumé connecté au wifi, le
dashboard web ouvert sur le navigateur du poste enseignant.

---

## Plan de la séance

| Partie | Sujet                                                       | Durée |
|--------|-------------------------------------------------------------|-------|
| 0      | Ouverture & rappel du cours précédent                       |  5 min |
| I      | Nav2 : la pile de navigation autonome                       | 20 min |
| II     | Découverte autonome (frontier exploration)                  | 20 min |
| III    | Démo en direct avec le dashboard                            | 20 min |
| IV     | Points de vigilance & Q/A                                    | 10 min |

---

## 0. Ouverture (5 min)

> *« La semaine dernière, vous avez réussi à construire une carte en
> conduisant le robot manuellement au clavier. Aujourd'hui, on va enlever
> le clavier. Le robot va se déplacer tout seul : on lui dira "vas à ce
> point", ou même "explore la salle tout seul", et il le fera. »*

**Ce qu'on a déjà :**
- SLAM qui construit `/map` et publie la TF `map → odom`.
- Une carte sauvée (`.pgm` + `.yaml`).
- La téléopération clavier (`teleop_twist_keyboard` → `/cmd_vel`).

**Ce qui manque :** quelque chose entre *« voici un but »* et *« voici des
commandes moteur »*. C'est exactement le rôle de Nav2.

> À noter au tableau :
> ```
>   goal (x, y, θ)  →  ???  →  /cmd_vel (v, ω)
> ```

---

## I. Nav2 : la pile de navigation autonome (20 min)

### I.1. Définition

**Nav2** (*Navigation 2*) est la pile de navigation autonome officielle de
ROS 2. Ce n'est **pas un seul programme** — c'est un ensemble de nodes
coordonnés qui, ensemble, répondent à la question : *« comment aller du
point A au point B sans cogner les murs ? »*.

> *« Retenez bien : Nav2, c'est un assemblage. Si un node est manquant ou
> mal configuré, toute la chaîne s'arrête. »*

### I.2. Architecture

Dessiner au tableau, composant par composant :

```
  Utilisateur → /goal_pose ──┐
                             ▼
                       bt_navigator            ← orchestre via Behavior Tree
                        │     │      │
                        ▼     ▼      ▼
                   planner   controller   behaviors
                     │           │          (recovery)
                     ▼           ▼
              chemin global   /cmd_vel
                   ▲             ▲
                   │             │
            global_costmap   local_costmap
                   ▲             ▲
                   └── /map ──┐  └── /scan + depth
                              │
                           AMCL (si carte pré-enregistrée)
                           OU slam_toolbox (si SLAM online)
```

**À présenter dans cet ordre :**

1. **`map_server`** — serveur de carte. Charge un `.yaml` + `.pgm` et les
   publie sur `/map`.
2. **AMCL** (*Adaptive Monte Carlo Localization*) — se localise sur une
   carte connue par **filtre à particules**. Pas utile en SLAM online.
3. **`planner_server`** — calcule le chemin **global** entre la pose
   actuelle et le goal (A\*, Dijkstra, NavFn…).
4. **`controller_server`** — suit le chemin **en temps réel**. Algorithmes
   comme DWB (*Dynamic Window*) ou RPP (*Regulated Pure Pursuit*). Il
   produit les `/cmd_vel`.
5. **`behavior_server`** — gère les *recovery behaviors* : si on est
   bloqué, on fait un *spin*, on recule, on attend.
6. **`bt_navigator`** — orchestre tout via un **Behavior Tree** (fichier
   XML). C'est lui qui décide : *« la planif a échoué → déclenche recovery
   1 → si encore échec, recovery 2 → sinon annule »*.
7. **`lifecycle_manager`** — démarre et surveille tous les autres nodes
   dans le bon ordre (les nodes Nav2 sont *managed lifecycle nodes*).

> **Insister :** le *planificateur global* décide **une route** sur la
> carte. Le *contrôleur local* la **suit** en évitant les obstacles qui
> n'étaient pas dans la carte (une personne qui passe, une chaise
> déplacée).

### I.3. Les costmaps — cœur de Nav2

**Définition :** une costmap est une **grille 2D** où chaque cellule
stocke un **coût** numérique de passage.

```
  0       libre (on peut y aller)
  1-252   zone d'inflation (gradient autour des obstacles)
  253     collision probable
  254     collision certaine
  255     inconnu
```

Nav2 a **deux** costmaps :

| Costmap         | Basée sur       | Taille                      | Usage                 |
|-----------------|-----------------|-----------------------------|-----------------------|
| `global_costmap`| `/map` + lidar  | toute la salle              | planif globale        |
| `local_costmap` | lidar live      | fenêtre glissante (~3×3 m)  | évitement temps réel  |

Chaque costmap est empilée en **couches** (*layers*) :
- `static_layer` — la carte SLAM.
- `obstacle_layer` — points du lidar marqués comme obstacles.
- `voxel_layer` — obstacles 3D (caméra depth).
- **`inflation_layer`** — ajoute un dégradé de coût autour des obstacles
  pour que le robot garde une **marge de sécurité**.

> *« Sans inflation, Nav2 vous planifie un chemin qui frôle le mur à 1 mm.
> Avec inflation, il garde une marge. Le rayon d'inflation doit être un peu
> plus grand que le rayon du robot. »*

### I.4. AMCL — localisation sur carte connue

**Problème :** Si on a sauvé une carte hier et qu'on redémarre le robot
aujourd'hui, le robot ne sait pas où il est **sur cette carte**.

**Solution : AMCL** utilise un **filtre à particules** :

1. Disperse quelques centaines d'hypothèses de position (*particules*).
2. À chaque nouveau scan laser, compare ce qu'il **mesure** avec ce que la
   carte **prédirait** à chaque hypothèse.
3. Garde les particules qui "collent" à la réalité, élimine les autres.
4. Après quelques itérations → les particules **convergent** vers la vraie
   position.

**Mode opératoire** : dans RViz, outil *2D Pose Estimate* → cliquer à la
position approximative du robot → glisser pour orienter → relâcher. AMCL
affine ensuite tout seul.

> *« Attention : AMCL ne marche **que** sur une carte pré-enregistrée. Si
> vous êtes en SLAM online, c'est `slam_toolbox` qui fournit déjà la TF
> `map → odom`. Double-emploi = conflit garanti. »*

### I.5. Tolérances et vitesses

Paramètres clés (fichier `nav2_params.yaml`) :

```yaml
max_vel_x:           0.20   # m/s — vitesse linéaire max
max_vel_theta:       0.80   # rad/s — vitesse angulaire max
xy_goal_tolerance:   0.15   # m — arrivé si à 15 cm
yaw_goal_tolerance:  0.25   # rad — arrivé si à ~14°
inflation_radius:    0.35   # m — gradient autour des obstacles
```

> **Points de cours à marteler :**
> - `0.20 m/s` c'est **prudent** pour un robot d'intérieur — le lidar
>   tourne à 10 Hz, doubler la vitesse c'est diviser par deux les points
>   laser par mètre parcouru.
> - `xy_goal_tolerance` trop petit = le robot tourne sans fin autour du
>   goal.

---

## II. Découverte autonome (20 min)

### II.1. Le problème

> *« Jusqu'ici on suppose qu'on a déjà une carte, ou qu'on conduit le robot
> pour la construire. Mais un robot vraiment autonome doit pouvoir
> découvrir un environnement **qu'il ne connaît pas encore**. Comment ? »*

**Deux approches :**
1. **Wall following** — longer les murs. Simple mais incomplet.
2. **Frontier-based exploration** — l'approche standard en robotique,
   utilisée par la plupart des robots autonomes (y compris, conceptuellement,
   les Roomba modernes).

### II.2. Définition : frontière

**Frontière** = cellule de la carte d'occupation qui est :
- **libre** (valeur 0), ET
- **voisine** d'au moins une cellule **inconnue** (valeur -1).

En clair : une frontière, c'est **la limite entre le connu et l'inconnu**.
Aller sur une frontière = découvrir du nouveau.

```
  ███████████         █ = obstacle (100)
  █ .  .  . █         . = libre (0)
  █ .  .  . ███████   ? = inconnu (-1)
  █ .  .  . F ? ? ?   F = frontière
  █ .  .  . █
  ███████████
```

### II.3. Algorithme de frontier exploration

```text
boucle :
    1. Lire la carte actuelle /map
    2. Scanner toutes les cellules → trouver les frontières
    3. Regrouper les frontières en CLUSTERS (composantes connexes)
    4. Pour chaque cluster, calculer un SCORE
    5. Envoyer un goal Nav2 vers le cluster avec le meilleur score
    6. Attendre l'arrivée (ou l'abandon)
    7. Recommencer
    8. S'il n'y a plus de frontières → la carte est complète
```

### II.4. Le scoring — là où ça devient intéressant

Dans `explore_lite` (paquet standard ROS 2, `m-explore-ros2`), chaque
frontière a un score :

```
  score = gain_scale       × taille_du_front
        − potential_scale  × distance_de_parcours
        − orientation_scale × changement_de_cap
```

Les trois coefficients déterminent le **comportement d'exploration** :

| Paramètre              | Effet si on l'augmente                       |
|------------------------|----------------------------------------------|
| `gain_scale`           | Privilégie les **grands** fronts (= zones encore très inconnues). |
| `potential_scale`      | Pénalise les fronts **lointains** → exploration plus locale/prudente. |
| `orientation_scale`    | Pénalise les fronts qui demandent de **tourner** → trajectoire plus fluide. |
| `min_frontier_size`    | Ignore les fronts plus petits que ce seuil → filtre le bruit. |

### II.5. Notre configuration « Roomba — circonférence max »

Fichier : `src/m3pro_teacher_nav/config/explore_params.yaml`

```yaml
potential_scale:    1.0    # défaut 3.0 — on pénalise peu la distance
gain_scale:         5.0    # défaut 1.0 — on privilégie fortement les GROS fronts
orientation_scale:  0.0    # on ignore le changement de cap
min_frontier_size:  0.50   # on ignore les fronts < 50 cm (bruit de carte)
return_to_init:     true   # le robot revient à son point de départ à la fin
```

> **Justification pédagogique :** *« On veut un robot qui **couvre**
> maximum la salle, comme un Roomba. Donc on récompense les grandes
> frontières (= beaucoup de terrain à découvrir en une fois) et on ne
> pénalise presque pas la distance. Résultat : le robot va à l'autre bout
> de la pièce si c'est là qu'il y a le plus à découvrir, au lieu de
> grignoter petit à petit autour de lui. »*

### II.6. explore_lite et Nav2 : qui fait quoi ?

C'est là que les étudiants s'embrouillent toujours. Être clair :

```
  explore_lite                     Nav2
  ────────────                     ────
  Décide OÙ aller                  Décide COMMENT y aller
  (frontière à explorer)           (chemin, évitement, contrôle moteur)

  Lit /global_costmap/costmap      Reçoit un goal
  Produit un goal PoseStamped      Produit /cmd_vel
```

`explore_lite` **dépend** entièrement de Nav2. Il n'envoie aucune commande
moteur directement — il utilise l'action Nav2 `/navigate_to_pose`.

> *« C'est une belle séparation des responsabilités : explore_lite ne sait
> pas piloter le robot, et Nav2 ne sait pas quoi explorer. Ensemble ils
> forment un explorateur autonome. »*

---

## III. Démo en direct (20 min)

### III.1. Présentation du dashboard

**Ouvrir** `http://<IP_ROBOT>:8080` sur le vidéoprojecteur.

Points à commenter :

- *« Tout ce que vous voyez ici est construit **au-dessus** de la pile
  qu'on vient de voir. »*
- Le bandeau **CONNECTED** vient de `rosbridge` (port 9090) — le
  navigateur parle au graphe ROS 2 via WebSocket.
- Le panneau **3D Viewer** utilise `three.js` + `roslibjs` pour afficher
  la carte, le robot et les scans en 3D.
- Le panneau **Camera Feed** propose trois modes : Live (MJPEG HTTP),
  Object Detection (image annotée via rosbridge), Camera Obstacles.
- Les boutons **Send Nav Goal** / **Cancel Nav** parlent directement à
  `/goal_pose` et à l'action `/navigate_to_pose`.

### III.2. Lancer la découverte autonome

Terminal 1 — bringup matériel (si pas déjà fait) :
```bash
ros2 launch M3Pro_navigation base_bringup.launch.py
```

Terminal 2 — SLAM + Nav2 + explore_lite + rosbridge :
```bash
ros2 launch m3pro_teacher_nav explore.launch.py
```

> **À commenter aux étudiants en direct :**
> - *« Regardez les logs : Nav2 démarre ses lifecycle nodes un par un… »*
> - *« Attendez ~15 secondes que la costmap globale soit publiée. »*
> - *« Premier goal envoyé par explore_lite : "`Sending goal: frontier at
>   (x, y)`". Le robot se met en marche. »*

### III.3. Observer dans le dashboard

- La **carte grandit** en direct dans le panneau 3D.
- Le **chemin vert** apparaît entre le robot et sa prochaine frontière.
- Le **scan laser** (points cyan) ajoute les obstacles à la costmap.
- Commenter la différence entre zones **blanches** (libre, scannées) et
  **grises** (inconnues, encore à explorer).

### III.4. Points pédagogiques pendant la démo

- **Arrêter la démo au milieu et pointer une frontière à l'écran** :
  *« Vous voyez cette ligne au bord du blanc ? C'est exactement ce que
  explore_lite appelle une frontière. Le robot va y aller. »*
- **Modifier `gain_scale` de 5.0 à 1.0 à chaud** (relancer) : montrer que
  le robot devient plus "sage" et reste local.
- **Demander à un étudiant** de prédire quel sera le prochain goal en
  regardant la carte.

---

## IV. Points de vigilance & Q/A (10 min)

### IV.1. Pièges récurrents

1. **Bringup pas démarré avant explore.launch.py** → Nav2 ne reçoit pas
   d'odométrie, les lifecycle nodes échouent au démarrage.
2. **Deux sources publiant sur `/cmd_vel`** en même temps (teleop + Nav2)
   → oscillations. Fermer teleop avant de lancer l'explo.
3. **`transform_tolerance` trop bas** sur Jetson Nano → le SLAM peut
   laguer, explore_lite affiche *Extrapolation Error* et conclut
   (à tort) qu'il n'y a plus de frontières. On l'a mis à **2.5 s** pour
   compenser la charge CPU.
4. **CPU saturé** → SLAM + Nav2 + explore + rosbridge + dashboard = les
   4 cœurs du Nano peuvent être à 100 %. Fermer RViz s'il tourne en plus.
5. **Foxglove / dashboard vides** : vérifier *Display frame = map* dans
   les panneaux 3D (le frame par défaut `base_link` ne montre rien tant
   que la TF `map` n'est pas là).

### IV.2. Questions à poser à la classe

- *« Si je supprime explore_lite mais que je garde Nav2, qu'est-ce que
  je peux encore faire ? »*
- *« Pourquoi AMCL n'est pas dans notre `explore.launch.py` ? »*
- *« Si j'augmente `potential_scale` à 10.0, le robot va-t-il explorer
  près ou loin ? »*
- *« Comment savoir, dans `ros2 topic list`, qu'explore_lite a bien
  démarré ? »*  (Indice : topic `/explore/frontiers`)

### IV.3. Ce qu'il faut retenir

> Trois phrases au tableau, à recopier :

1. **Nav2 ne décide pas où aller — il décide comment y aller.**
2. **Une frontière, c'est la limite entre le connu et l'inconnu.**
3. **En SLAM online, on n'a pas besoin d'AMCL ; en navigation sur carte
   sauvée, AMCL est indispensable.**

---

## Pour la prochaine séance

- TP 1 : lancer `explore.launch.py` sur votre robot et faire cartographier
  la salle TP entièrement en autonomie.
- TP 2 : sauvegarder la carte avec `map_saver_cli`.
- TP 3 : relancer Nav2 sur cette carte sauvée (`navigation.launch.py`) et
  envoyer des goals depuis le dashboard web.
- Bonus : modifier un paramètre d'`explore_params.yaml` et observer
  l'effet sur la trajectoire d'exploration.
