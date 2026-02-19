# Projet : Robot intelligent d’assistance pour EHPAD

## Robot : ROSMASTER M3 Pro — ROS2 — Jetson Nano / Orin NX

---

# 1. Vision

 Un robot autonome basé sur ROS2 capable d’assister le personnel soignant de l'EHPAD (aide-soignant, agent de soin) en livrant le matériel(gants,serviettes, etc, ...) et les plateaux-repas aux patients, afin d’optimiser le temps du personnel et améliorer la qualité des soins.

---

# 2. Objectifs et périmètre

## Objectifs

1. Permettre la livraison autonome des repas et du matériel
2. Permettre au personnel soignant de commander le robot via une interface web (tablette ou telephone mobile)
3. Permettre une communication temps réel pour le suivi du robot (Batterie faible, collisions avec patients ou personnel)
4. Suivi de la position du robot en temps réel et de sa navigation pour conaitre sa progression dans sa tâche
---
## Objectifs secondaires

1. Commande vocal (fonctionnalité optionnelle)
---

## Non-objectifs

1. Remplacer le personnel soignant
2. Transporter des charges supérieures à 5kg
3. Utilisation en extérieur

---

## Personas

### Persona 1 — Personnel soignant

Nom : Marie  
Age : 34 ans

Objectifs :

- Livrer le materiel manquant rapidement
- Réduire déplacements

Utilise :

- Interface web pour commander robot

---

### Persona 2 — Personnel EHPAD

Nom : Paul  
Age : 45 ans

Objectifs :

- Livrer repas efficacement
- Surveiller robot

Utilise :

- Interface web pour commander et surveiller robot

---

# 3. Use Cases

## Tableau des Use Cases

|ID|Nom|Acteur|Description|
|---|---|---|---|
|UC-01|Livrer materiel|personnel soignant|Robot livre materiel|
|UC-02|Livrer repas|Personnel|Robot livre repas|
|UC-03|Navigation autonome|Robot|Robot se déplace seul|
|UC-04|Éviter obstacles|Robot|Robot évite obstacles|
|UC-05|Retour base|Robot|Robot retourne base|
|UC-06|Commande vocal|Personnel|Robot reçoit des commande via l'option vocal(optionnel)|BASSE|
|UC-07|Batterie faible|Robot|Alerte et retour automatique|MOYENNE|
|UC-08|Mode d'urgence|Utilisateur|Arrêt immédiat du robot|

---

## UC-01 : Livrer materiel (détaillé)

Acteur : personnel soignant

Préconditions :

- Robot connecté

- Carte navigation chargée


Scénario nominal :

Le personnel soignant accède à l'interface Web depuis sa tablette ou son téléphone

Authentification du personnel soignant

Sélection du type de matériel à livrer (gants, serviettes, pansements, etc.)

Sélection de la chambre destination à l'aide de un QR code (ex: "Chambre 302")

Confirmation de la commande

Interface envoie commande via WebSocket au serveur

Serveur valide la commande et la publie sur le topic MQTT /robot/tasks

Robot reçoit la commande et valide la tâche

Robot met à jour son état à "En route vers Chambre 302"

Interface Web met à jour l'affichage en temps réel (position, étape)

Robot navigue autonomement vers la chambre (utilisant Nav2 + Lidar)

Robot arrive à la chambre et s'arrête

Robot annonce l'arrivée (signal sonore, LED clignotante)

Robot attend que le matériel soit retiré (capteur de charge)

Une fois matériel retiré, robot met à jour l'état à "Livraison complète"

Robot envoie confirmation à l'interface

Interface notifie l'utilisateur "Livraison réussie"

Robot retourne vers sa base de charge


Postconditions :

- Livraison terminée


---

## UC-02 : Livrer repas (détaillé)

Processus identique au UC-01.

---

# 4. Architecture technique

Architecture globale :

```
personnel soignant
   │
   ▼
Interface Web
   │ WebSocket
   ▼
Serveur MQTT
   │ MQTT
   ▼
Robot ROSMASTER M3 Pro
   │
   ├── Navigation (ROS2 Nav2)
   ├── Vision (OpenCV)
   ├── Lidar Dual ToF
   └── Capteurs sécurité
```

---

# 5. Diagrammes UML :


![Diagramme d’architecture](Images/Pasted%20image%2020260217150427.png)

![Diagramme de séquence](Images/Pasted%20image%2020260217152148.png)

---

# 6. Stack technique

|Composant|Technologie|Justification|
|---|---|---|
|Robot OS|ROS2|Standard robotique|
|Robot compute|Jetson Nano / Orin NX|IA embarquée|
|Langage|Python|Compatible ROS2|
|Vision|OpenCV|Vision ordinateur|
|Communication|MQTT|Communication robot fiable|
|Communication|WebSocket|Communication temps réel|
|Interface|React|Interface moderne|
|Navigation|Nav2|Navigation autonome|
| Application mobile   | PWA (React)| Installation tablette/mobile sans store |

---

## Alternatives écartées

| Technologie | Raison                 |
| ----------- | ---------------------- |
| Socket.io   | trop lourd             |
| Arduino     | puissance insuffisante |

---

# 7. Risques et contraintes

## Risques

| Risque              | Probabilité | Impact   | Mitigation           |
| ------------------- | ----------- | -------- | -------------------- |
| Collision           | Moyen       | Critique | Lidar + Vision       |
| Perte connexion     | Moyen       | Moyen    | Reconnexion MQTT     |
| Bug ROS2            | Faible      | Moyen    | Tests                |
| Erreur de livraison | Moyen       | Critique | Révisions régulières |

---

## Contraintes

Hardware :

- ROSMASTER M3 Pro obligatoire


Software :

- ROS2 obligatoire


Environnement :

- Utilisation intérieure uniquement


---

# 8. Sécurité

Mesures :

- Détection obstacles

- Arrêt urgence

- Surveillance capteurs

- Vision OpenCV

- Vitesse adaptative selon zone(optionnel)

---

# 9. Conventions équipe

Git :

Branches :

```
feature/navigation
feature/mqtt
feature/interface
```

Commits :

```
[FEAT]:
[FIX]:
[DOCS]:
```
- Conflits : rebase sur main, resolution en binome
- Review obligatoire avant merge

---

# 10. Architecture ROS2

Nodes :

```
navigation_node
delivery_node
vision_node
obstacle_avoidance_node
mqtt_node
interface_node
safety_node
trash_node
```

---

# 11. Roadmap

| Phase | Dates | 🎯 Objectifs | 📦 Livrables | 🛠️ Tâches | ✔️ Critères de validation | ⚠️ Risques spécifiques |
|-------|--------|--------------|--------------|------------|---------------------------|-------------------------|
| **Phase 1 — Installation ROS2, mise en place et préparation du robot** | 23/02/2026 → 08/03/2026 | - Préparer l’environnement logiciel et matériel du robot. <br> - Vérifier le bon fonctionnement des capteurs (Lidar, caméras, IMU). <br> - Installer ROS2 + packages essentiels. <br> - Mettre en place l’architecture de base des nodes. | - Robot opérationnel avec ROS2 Humble/Foxy installé. <br> - Drivers Lidar + caméra fonctionnels. <br> - Arborescence ROS2 du projet créée. <br> - Tests de communication MQTT simples. | - Installation ROS2 sur Jetson Nano / Orin NX. <br> - Configuration réseau (WiFi, IP fixe, SSH). <br> - Installation des drivers capteurs. <br> - Test des topics ROS2 (/scan, /camera, /imu). <br> - Mise en place du broker MQTT (Mosquitto). <br> - Création des premiers nodes : mqtt_node, safety_node. | - Tous les capteurs publient correctement. <br> - Le robot répond aux commandes simples (ping MQTT). <br> - Aucun crash ROS2 au démarrage. | — |
| **Phase 2 — Navigation autonome (Nav2)** | 09/03/2026 → 22/03/2026 | - Permettre au robot de se déplacer sans télécommande. <br> - Générer une carte de l’EHPAD (SLAM). <br> - Configurer Nav2 pour la navigation autonome. | - Carte SLAM complète de l’environnement. <br> - Navigation autonome fonctionnelle (point A → point B). <br> - Évitement d’obstacles basique. | - Installation Nav2 + configuration des plugins. <br> - Calibration du Lidar + tests de scan. <br> - SLAM avec slam_toolbox. <br> - Configuration du planner global/local. <br> - Tests de navigation dans couloirs. <br> - Implémentation du node obstacle_avoidance_node. | - Le robot atteint une destination sans intervention humaine. <br> - Le robot évite les obstacles statiques. <br> - La carte est stable et exploitable. | - Mauvaise calibration Lidar → navigation instable. <br> - Mauvaise luminosité → vision perturbée. |
| **Phase 3 — Communication interface ↔ robot (MQTT + WebSocket)** | 23/03/2026 → 05/04/2026 | - Permettre au personnel d’envoyer des commandes depuis l’interface. <br> - Assurer un retour d’état temps réel du robot. | - API WebSocket fonctionnelle. <br> - Topics MQTT définis et documentés. <br> - Node ROS2 delivery_node capable de recevoir une commande. | - Définition du protocole MQTT (topics, payload JSON). <br> - Développement du mqtt_node (publish/subscribe). <br> - Mise en place du serveur WebSocket. <br> - Tests de bout en bout : Interface → MQTT → ROS2 → robot. | - Une commande envoyée depuis l’interface déclenche un déplacement réel. <br> - Le robot renvoie son état (batterie, position, statut). | — |
| **Phase 4 — Interface Web (React)** | 06/04/2026 → 19/04/2026 | - Créer une interface simple et accessible pour le personnel soignant. <br> - Permettre la sélection des chambres et des tâches. | - Interface React responsive (tablette + mobile). <br> - Dashboard de suivi du robot. <br> - Page de sélection des tâches (livraison matériel, repas). | - Maquettage UI/UX (Figma). <br> - Développement des pages principales. <br> - Intégration WebSocket. <br> - Affichage de la carte du robot (optionnel). <br> - Tests utilisateurs (personnel soignant). | - Le personnel peut commander une livraison sans formation technique. <br> - Le robot apparaît en temps réel dans l’interface. | — |
| **Phase 5 — Livraison (tests unitaires + fonctionnels)** | 20/04/2026 → 03/05/2026 | - Finaliser la fonctionnalité de livraison. <br> - Tester la fiabilité du système dans un scénario réel. | - Livraison matériel opérationnelle. <br> - Livraison repas opérationnelle. <br> - Rapport de tests. | - Tests unitaires ROS2 (nodes). <br> - Tests fonctionnels : commande → déplacement → livraison → confirmation. <br> - Gestion des erreurs (collision, batterie faible). <br> - Optimisation de la vitesse et trajectoires. | - 95% des livraisons réussies sans intervention humaine. <br> - Aucun incident de sécurité. | — |
| **Phase 6 — Sortie poubelles (optionnelle)** | 04/05/2026 → 17/05/2026 | - Ajouter une fonctionnalité secondaire si le temps le permet. | - Node trash_node. <br> - Parcours prédéfini vers la zone poubelles. | - Définition du workflow (départ → collecte → dépôt). <br> - Ajout d’un mode “poubelles” dans l’interface. <br> - Tests de navigation avec charge légère. | - Le robot peut transporter une petite poubelle sans risque. <br> - Le personnel peut déclencher la tâche depuis l’interface. | — |


---

# 12. Questions ouvertes

-  Faut-il ajouter une reconnaissance via QR code ?
-  Faut-il ajouter l'IA détection personnes ?
-  Faut-il créer une flotte dans l'idéal ?
- Faut-il adapter le comportement du robot selon les zones (chambres / couloirs) ?
- Quel niveau de supervision est acceptable pour le personnel ?

---

# 13. Résultat attendu

Robot capable de :

- recevoir les commandes données par le personnel soignant

- déplacements autonomes

- éviter les obstacles

- livrer le matériel

- livrer les repas

- communiquer temps réel (suivi du robot)


Contributeurs:<br>
- OUARDI Ahmed-Amine
- Ehoura Christ-Yvann

