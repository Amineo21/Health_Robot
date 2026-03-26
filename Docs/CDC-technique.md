# Projet : Robot intelligent d’assistance pour EHPAD

## Robot : ROSMASTER M3 Pro — ROS2 — Jetson Nano / Orin NX

---

# 1. Vision

Un robot autonome et intelligent capable d'assister le personnel soignant de l'EHPAD (aide-soignant, agent de soin) en livrant le matériel (gants, serviettes, pansements, etc.) et les plateaux-repas aux patients, afin d'optimiser le temps du personnel et améliorer la qualité et la réactivité des soins.

## Contexte et justification

Les EHPAD font face à une charge de travail croissante avec un personnel limité. Les tâches répétitives comme la livraison de matériel et de repas consomment un temps précieux qui pourrait être dédié aux patients. Ce robot vise à :

- **Libérer du temps** : Le personnel gagne en moyenne 2-3 heures par jour en tâches de livraison
- **Améliorer la qualité** : Les soignants peuvent se concentrer sur les interactions humaines avec les patients
- **Réduire la fatigue physique** : Moins de déplacements répétitifs pour le personnel
- **Assurer une traçabilité** : Suivi en temps réel des livraisons et des activités du robot

---

# 2. Objectifs et périmètre

## Objectifs primaires

1. **Permettre la livraison autonome des repas et du matériel**
   - Le robot doit naviguer automatiquement jusqu'à la chambre désignée
   - Livrer le matériel ou le plateau-repas sans intervention humaine
   - Confirmer la livraison via l'interface
   - Capacité à gérer plusieurs types de livraisons (matériel léger, repas chauds)

2. **Permettre au personnel soignant de commander le robot via une interface web**
   - Interface accessible sur tablette et téléphone mobile
   - Sélection simple de la chambre destination
   - Types de livraison sélectionnables (matériel, repas, autres)
   - Accès limité au personnel soignant authentifié
   - Feedback immédiat de la commande acceptée

3. **Permettre une communication temps réel pour le suivi du robot**
   - Suivi de la batterie (alerte si < 20%)
   - Détection et signalement des collisions avec patients ou personnel
   - Notification de l'état de livraison (en cours, terminée, erreur)
   - Localisation GPS/odométrie en temps réel
   - Alertes de problèmes (obstacle non franchissable, erreur navigation)

4. **Assurer la sécurité et la fiabilité**
   - Respect de la norme ISO 3691-4 (véhicules autonomes en environnement intérieur)
   - Arrêt d'urgence déclenchable manuellement ou automatiquement
   - Détection des personnes et arrêt immédiat
   - Vitesse limitée à 0.5 m/s maximum en zone patients

---

## Objectifs secondaires

1. **Commande Vocal (fonctionnalité optionnelle)**
  - 

2. **Optimisations futures**
   - Reconnaissance des numéros de chambre par QR code / OCR
   - Détection des personnes avec IA (pour évitement amélioré)
   - Gestion de flotte multi-robots coordonnés

---

## Non-objectifs

1. **Remplacer le personnel soignant** — Le robot est un outil d'assistance, pas de substitution
2. **Transporter des charges supérieures à 5kg** — Limitations matérielles du ROSMASTER M3 Pro
3. **Utilisation en extérieur** — Conçu pour environnement intérieur contrôlé uniquement
4. **Manipulation d'objets fragiles** — Pas de bras robotisé, pas de préhension fine
5. **Communication directe avec les patients** — Pas de reconnaissance vocale ou interactivité patient

---

## Scope du projet

### Inclus
- Navigation autonome dans l'EHPAD
- Système de commande web
- Communication MQTT/WebSocket
- Gestion des obstacles et sécurité
- Interface utilisateur web pour tablette/mobile
- Logging et traçabilité des livraisons

### Exclus
- Téléconférence vidéo depuis le robot
- Contrôle des lumières / équipements EHPAD
- Gestion des stocks automatisée
- Intégration ERP/Gestion administrative EHPAD

---

## Personas

### Persona 1 — Personnel soignant (aide-soignant)

**Profil :**
- Nom : Marie  
- Age : 34 ans
- Expérience : 8 ans en EHPAD
- Tech-savviness : Moyen (utilise tablette/smartphone couramment)

**Objectifs :**
- Livrer le matériel manquant rapidement aux patients
- Réduire les déplacements inutiles
- Réduire la charge physique de travail
- Pouvoir réagir rapidement à des urgences

**Problèmes actuels :**
- Passe 30% de son temps à chercher/livrer du matériel
- Fatigue physique après 8h de marche quotidienne
- Risque d'erreur quand elle oublie chambre lors de tournée

**Utilise :**
- Interface web simple depuis tablette dans la poche
- Besoin d'une réponse rapide (< 2 secondes)
- Veut voir où est le robot en temps réel

**Besoins spécifiques :**
- Interface avec gros boutons (facile à utiliser avec gants)
- Notifications push pour alertes
- Historique des commandes passées
- Possibilité d'annuler une commande

---

### Persona 2 — Responsable livraison/repas

**Profil :**
- Nom : Paul  
- Age : 45 ans
- Expérience : 10 ans en restauration collective
- Tech-savviness : Faible (peu familier avec technologie)

**Objectifs :**
- Livrer les repas efficacement à tous les patients
- Surveiller que le robot livre bien à la bonne chambre
- Gérer les repas spéciaux (végétariens, sans sel, etc.)
- Pouvoir intervenir en cas de problème

**Problèmes actuels :**
- Repas qui refroidissent en route
- Incertitude si livraison bien faite
- Double vérification manuelle nécessaire

**Utilise :**
- Interface web sur ordinateur de la cuisine
- Veut voir la progression du robot
- Besoin de confirmation de livraison

**Besoins spécifiques :**
- Interface claire et sans ambiguïté
- Pas de raccourcis clavier obscurs
- Logs détaillés de chaque livraison
- Alerte si livraison échoue

---

### Persona 3 — Infirmier/Responsable EHPAD

**Profil :**
- Nom : Sylvain
- Age : 50 ans
- Expérience : 15 ans en management EHPAD
- Tech-savviness : Moyen (management via logiciels)

**Objectifs :**
- Optimiser les opérations de l'EHPAD
- Réduire les risques de sécurité
- Diminuer les coûts d'exploitation
- Maintenir la qualité des services

**Utilise :**
- Dashboard d'administration
- Statistiques d'utilisation du robot
- Rapports de maintenance

**Besoins spécifiques :**
- Vue d'ensemble du système (activité, erreurs)
- Capacité à configurer les zones interdites
- Rapports exportables

---

# 3. Use Cases détaillés

## Tableau des Use Cases

|ID|Nom|Acteur|Description|Priorité|
|---|---|---|---|---|
|UC-01|Livrer matériel|Personnel soignant|Robot livre matériel spécifique|HAUTE|
|UC-02|Livrer repas|Personnel repas|Robot livre plateau-repas|HAUTE|
|UC-03|Navigation autonome|Robot|Robot se déplace seul|HAUTE|
|UC-04|Éviter obstacles|Robot|Robot détecte et évite obstacles|HAUTE|
|UC-05|Retour base|Robot|Robot retourne station de charge|MOYENNE|
|UC-06|Commande vocal|Personnel|Robot reçoit des commande via l'option vocal(optionnel)|BASSE|
|UC-07|Batterie faible|Robot|Alerte et retour automatique|MOYENNE|
|UC-08|Mode d'urgence|Utilisateur|Arrêt immédiat du robot|HAUTE|

---

## UC-01 : Livrer matériel (détaillé)

**Acteur principal :** Personnel soignant

**Acteurs secondaires :** Robot, Système MQTT, Interface Web

**Préalables :**
- Robot opérationnel et chargé (batterie > 30%)
- Robot connecté au réseau WiFi
- Carte de navigation chargée et valide
- Interface Web accessible
- Robot en position "prêt"

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

**Scénarios alternatifs :**

**2a. Authentification échouée :**
- Le système refuse l'accès
- Message d'erreur affiché
- Retour à l'écran de login

**6a. Erreur de transmission WebSocket :**
- Interface réessaye 3 fois
- Si échec : "Erreur de connexion - réessayer ?"
- L'utilisateur peut réessayer la commande

**11a. Obstacle imprévu détecté :**
- Robot s'arrête
- Tente contournement automatique (évitement)
- Si contournement impossible : appelle en aide / cherche itinéraire alternatif
- Après 30s sans solution : arrêt et alerte personnel

**11b. Batterie critique détectée (< 10%) :**
- Robot abandonne tâche
- Retour immédiat à la base
- Notification à l'utilisateur "Batterie faible - retour base"

**Postconditions :**
- Matériel a été livré à la chambre
- Charge du robot allégée (si capteur présent)
- Log d'événement enregistré (timestamp, chambre, type matériel)
- Interface mise à jour

**Critères d'acceptation :**
- Livraison réussit 95% des cas nominaux
- Temps total < 3 minutes (de l'ordre, à la livraison)
- Navigation sans collision
- Confirmations envoyées en < 1 seconde

---

## UC-02 : Livrer repas (détaillé)

**Acteur principal :** Personnel repas/cuisine

**Préalables :**
- Tous les préalables de UC-01
- + Plateau-repas placé correctement sur le robot
- + Température du repas contrôlée (maintien thermique)

**Scénario nominal :**

1. Personnel à la cuisine prépare le plateau-repas
2. Groupe le repas
3. Accède à l'interface Web de livraison
4. Sélectionne "Type : Repas"
5. Sélectionne le patient/chambre destination
6. Ajoute les notes si nécessaire (régime spécial, allergies)
7. Confirme la livraison
8. Interface calcule le temps restant avant refroidissement
9. Robot navigue avec vitesse adaptée (plus lent si repas chaud)
10. Robot arrive à la chambre
11. Signal d'arrivée (signal sonore, moins agressif que pour matériel)
12. Patient ou personnel récupère le repas
13. Robot détecte que le plateau a été retiré
14. Confirmation de livraison
15. Interface notifie : "Repas livré avec succès"
16. Robot retourne à la cuisine pour chercher prochain repas si queue existe

**Spécificités :**
- Vitesse réduite (0.3 m/s au lieu de 0.5 m/s) pour éviter basculement
- Plateau à faible centre de gravité
- Route optimisée pour éviter les secousses
- Isolation thermique du compartiment de transport
- Capteur de présence du plateau avant départ

**Postconditions :**
- Repas livré chaud (température acceptable)
- Aucun dégât ne s'est produit
- Log : timestamp, chambre, type repas, temps transport

---

## UC-03 : Navigation autonome

**Acteur :** Robot + système de navigation

**Déclenchement :** UC-01 ou UC-02 (commande de livraison)

**Processus :**

1. Robot reçoit coordonnées destination
2. Calcul de route via planificateur global (ROS2 Nav2)
3. Suivi de la route via planificateur local (Dynamic Window Approach)
4. Utilisation du Lidar pour l'odométrie et détection d'obstacles
5. Ajustement dynamique de la trajectoire
6. Arrivée à destination détectée par proximité (< 30 cm)
7. Arrêt et stabilisation du robot

**Technologies utilisées :**
- **SLAM (Simultaneous Localization and Mapping)** : slam_toolbox
- **Planification** : Nav2 (move_base equivalent ROS2)
- **Capteurs** : Lidar Dual ToF (2 capteurs), Roues odométriques encodeurs, IMU
- **Localisation** : Fusion EKF (Extended Kalman Filter)

---

## UC-04 : Éviter obstacles

**Déclenchement :** Continu pendant UC-03

**Capteurs impliqués :**
- Lidar frontal : détection obstacles à 360°
- Lidar arrière : prévention de collision en marche arrière
- Caméra avec OpenCV : classification des obstacles (personne, meuble, etc.)

**Processus d'évitement :**

**Niveau 1 - Détection (Lidar) :**
1. Lidar scan en continu (10 Hz)
2. Si obstacle détecté < 1 m : alerte système
3. Vérification de la classification (personne / objet)

**Niveau 2 - Réaction immédiate :**
- Si **personne détectée** : ARRÊT IMMÉDIAT + son + LED rouge
- Si **objet fixe** : calcul route alternative via NAV2
- Si **objet mobile** (animal, enfant) : arrêt + observation 5s

**Niveau 3 - Contournement intelligent :**
1. Robot cherche passage à gauche / droite
2. Distance minimale 0.5 m du robot
3. Si contournement possible : exécution
4. Si route bloquée : notification personnel, attente intervention

**Postconditions :**
- Zéro collision
- Robot continue ou s'arrête de manière prévisible
- Incident loggé si obstacle anormal

---

## UC-05 : Retour base

**Déclenchement :**
- Après chaque livraison
- Batterie < 20%
- Fin de journée (programmé)
- Commande manuelle

**Processus :**
1. Robot reçoit instruction "Retour base"
2. Navigation vers station de charge (coordonnées prédéfinies)
3. Alignement avec connecteur de charge (capteur IR)
4. Engagement de la charge
5. Démarrage du cycle de charge
6. Robot passe en mode "Standby"

---

## UC-07 : Batterie faible

**Déclenchement :** Batterie < 20% de capacité

**Processus :**

1. Robot détecte batterie critique
2. Broadcast sur topic MQTT : `/robot/status/battery` = "CRITICAL"
3. Interface Web affiche alerte (icône batterie rouge clignotante)
4. Notification push au personnel soignant
5. Si tâche en cours : abandon et retour immédiat vers base
6. Si repos : acheminement vers base
7. Arrivée à la base et engagement automatique du chargeur

**Notification :**
```json
{
  "timestamp": "2026-02-19T14:30:00Z",
  "battery_level": 18,
  "status": "CRITICAL",
  "action": "RETURNING_TO_BASE",
  "eta_minutes": 3
}
```

---

## UC-08 : Mode d'urgence

**Déclenchement :** Bouton d'arrêt d'urgence physique ou numérique

**Acteurs :** Personnel soignant, infirmier, responsable

**Processus :**

1. Détection du bouton d'urgence activé
2. Coupure immédiate des moteurs (< 100 ms)
3. Les freins mécaniques se bloquent
4. Broadcast urgence sur tous les canaux MQTT
5. Interface Web affiche écran rouge "ARRÊT D'URGENCE ACTIVÉ"
6. LED robot become rouge clignotante + son d'alerte
7. Logs d'urgence enregistrés avec timestamp exact

**Récupération :**
- Maintenance physique du robot
- Vérification sécurité
- Redémarrage contrôlé via interface admin
---

# 4. Architecture technique détaillée

## 4.1 Diagramme UML 

![Diagramme d’architecture](Images/Pasted%20image%2020260217150427.png)

![Diagramme de séquence](Images/Pasted%20image%2020260217152148.png)


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
|Architecture/standardisation | Docker | Conteneurisation pour utiliser ROS2|

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
| **Phase 1 — Installation ROS2, mise en place et préparation du robot** | 23/02/2026 → 15/03/2026 (3 semaines) | - Préparer l'environnement logiciel et matériel du robot.<br>- Vérifier le bon fonctionnement des capteurs (Lidar, caméras, IMU).<br>- Installer ROS2 + packages essentiels.<br>- Mettre en place l'architecture de base des nodes. | - Robot opérationnel avec ROS2 Humble/Foxy installé.<br>- Drivers Lidar + caméra fonctionnels.<br>- Arborescence ROS2 du projet créée.<br>- Tests de communication MQTT simples. | - Installation ROS2 sur Jetson Nano / Orin NX.<br>- Configuration réseau (WiFi, IP fixe, SSH).<br>- Installation des drivers capteurs.<br>- Test des topics ROS2 (/scan, /camera, /imu).<br>- Mise en place du broker MQTT (Mosquitto).<br>- Création des premiers nodes : mqtt_node, safety_node. | - Tous les capteurs publient correctement.<br>- Le robot répond aux commandes simples (ping MQTT).<br>- Aucun crash ROS2 au démarrage. | — |
| **Phase 2 — Navigation autonome (Nav2)** | 16/03/2026 → 26/04/2026 (6 semaines) | - Permettre au robot de se déplacer sans télécommande.<br>- Générer une carte de l'EHPAD (SLAM).<br>- Configurer Nav2 pour la navigation autonome. | - Carte SLAM complète de l'environnement.<br>- Navigation autonome fonctionnelle (point A → point B).<br>- Évitement d'obstacles basique. | - Installation Nav2 + configuration des plugins.<br>- Calibration du Lidar + tests de scan.<br>- SLAM avec slam_toolbox.<br>- Configuration du planner global/local.<br>- Tests de navigation dans couloirs.<br>- Implémentation du node obstacle_avoidance_node. | - Le robot atteint une destination sans intervention humaine.<br>- Le robot évite les obstacles statiques.<br>- La carte est stable et exploitable. | - Mauvaise calibration Lidar → navigation instable.<br>- Mauvaise luminosité → vision perturbée. |
| **Phase 3 — Communication interface ↔ robot (MQTT + WebSocket)** | 27/04/2026 → 17/05/2026 (3 semaines) | - Permettre au personnel d'envoyer des commandes depuis l'interface.<br>- Assurer un retour d'état temps réel du robot. | - API WebSocket fonctionnelle.<br>- Topics MQTT définis et documentés.<br>- Node ROS delivery_node capable de recevoir une commande. | - Définition du protocole MQTT (topics, payload JSON).<br>- Développement du mqtt_node (publish/subscribe).<br>- Mise en place du serveur WebSocket.<br>- Tests de bout en bout : Interface → MQTT → ROS → robot. | - Une commande envoyée depuis l'interface déclenche un déplacement réel.<br>- Le robot renvoie son état (batterie, position, statut). | — |
| **Phase 4 — Interface Web (React)** | 18/05/2026 → 07/06/2026 (3 semaines) | - Créer une interface simple et accessible pour le personnel soignant.<br>- Permettre la sélection des chambres et des tâches. | - Interface React responsive (tablette + mobile).<br>- Dashboard de suivi du robot.<br>- Page de sélection des tâches (livraison matériel, repas). | - Maquettage UI/UX (Figma).<br>- Développement des pages principales.<br>- Intégration WebSocket.<br>- Affichage de la carte du robot (optionnel).<br>- Tests utilisateurs (personnel soignant). | - Le personnel peut commander une livraison sans formation technique.<br>- Le robot apparaît en temps réel dans l'interface. | — |
| **Phase 5 — Livraison (tests unitaires + fonctionnels)** | 08/06/2026 → 28/06/2026 (3 semaines) | - Finaliser la fonctionnalité de livraison.<br>- Tester la fiabilité du système dans un scénario réel. | - Livraison matériel opérationnelle.<br>- Livraison repas opérationnelle.<br>- Rapport de tests. | - Tests unitaires ROS (nodes).<br>- Tests fonctionnels : commande → déplacement → livraison → confirmation.<br>- Gestion des erreurs (collision, batterie faible).<br>- Optimisation de la vitesse et trajectoires. | - 95% des livraisons réussies sans intervention humaine.<br>- Aucun incident de sécurité. | — |
| **Phase 6 — Commande vocale (optionnelle)** | 29/06/2026 → 13/07/2026 (2,5 semaines) | - Ajouter une fonctionnalité secondaire si le temps le permet. | - Commande vocale opérationnelle. | - Définition du workflow (Demande vocale → Réception → Exécution).<br>- Ajout d’un mode "Vocal" dans l'interface.<br>- Tests de la fonctionnalité avec mots-clés. | - Le robot comprend et exécute la demande vocale.<br>- Le personnel peut déclencher une tâche uniquement avec la voix. | — |

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


# 14. Pipeline CI/CD & Infrastructure as Code


Nous avons implémenté une pipeline CI/CD complète pour assurer des déploiements reproductibles et automatisés. La CI (.github/workflows/docker.yml) se déclenche sur chaque push/PR : elle build les images Docker (frontend React, backend Python, Mosquitto MQTT) et teste leur démarrage via docker-compose up -d. L'infrastructure sous-jacente est gérée par Terraform (infra/terraform/main.tf) qui déclare explicitement le réseau health_robot_network et les volumes persistants mosquitto_data/config, remplaçant les créations implicites de docker-compose.

Choix Terraform justifié: docker-compose suppose Docker installé manuellement et crée des ressources non déclaratives. Terraform garantit une infra 100% reproductible (terraform apply = même état exact) et évolutive vers une VM cloud (même fichier). Le CD (.github/workflows/cd.yml) est prêt pour le déploiement automatique sur main (TODO : SSH vers VM staging + docker compose up -d).

Flux actuel : push branche → CI build/test  | terraform apply → infra réseau/volumes ✅ | merge main → CD deploy VM 🔄. Cette approche garantit zéro intervention manuelle du commit à la prod, alignée sur les standards DevOps industriels.


Contributeurs:<br>
- OUARDI Ahmed-Amine
- Ehoura Christ-Yvann
- Ousmane Sacko
- Drame Baboye
- Daniel Komoe

