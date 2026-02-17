# Projet : Robot intelligent d'assistance pour EHPAD

  
# Robot : ROSMASTER M3 Pro -- ROS2 -- Jetson Nano / Orin NX

  

------------------------------------------------------------------------
# 1. Vision

  

Développer un robot autonome basé sur ROS2 capable d'assister les

infirmiers en EHPAD en livrant de manière sécurisée les médicaments et

les plateaux-repas aux patients, grâce à un système connecté utilisant

MQTT et WebSocket pour la communication temps réel.

  

------------------------------------------------------------------------

# 2. Objectifs et périmètre

## Objectifs principaux

  
1.  Permettre au robot de livrer des médicaments et des plateaux-repas

2.  Permettre à l'infirmier de commander le robot via une interface

3.  Permettre une communication temps réel entre interface et robot

4.  Permettre au robot de naviguer de manière autonome

5.  Permettre au robot d'éviter les obstacles

  

## Objectifs secondaires

  

1.  Sortie des poubelles (fonctionnalité optionnelle)

2.  Surveillance via caméra

3.  Suivi en temps réel de la position

  

------------------------------------------------------------------------

  

# 3. Architecture globale du système

  

Infirmier → Interface → WebSocket → Serveur MQTT → MQTT → Robot

ROSMASTER M3 Pro

  

------------------------------------------------------------------------

  

# 4. Composants Robot

  

## Navigation

  

navigation_node\

delivery_node

  

## Évitement obstacles

  

Dual ToF Lidar\

Caméra RGB-D

  

Nodes:

  

obstacle_avoidance_node\

safety_node

  

## Vision

  

OpenCV\

vision_node

  

------------------------------------------------------------------------

# 5. Interface

  

Technologies:

  

React\

WebSocket

  

Fonctions:

  

-   commander robot\

-   recevoir statut

  

------------------------------------------------------------------------

  

# 6. Serveur MQTT

  

Fonctions:

  

-   recevoir commandes

-   envoyer commandes robot

-   recevoir statut robot

-   envoyer statut interface

  

Topics:

  

robot/command\

robot/status\

robot/location

  

------------------------------------------------------------------------

  

# 7. Communication

  

Interface → WebSocket → MQTT → Robot

  

Robot → MQTT → WebSocket → Interface

  

------------------------------------------------------------------------

  

# 8. Stack Technique

  

Robot:

  

ROS2\

Python\

Jetson Nano / Orin NX\

Ubuntu

  

Vision:

  

OpenCV

  

Communication:

  

MQTT\

WebSocket

  

Interface:

  

React

  

------------------------------------------------------------------------

  

# 9. Use Cases

  

Livrer médicament\

Livrer repas\

Navigation autonome\

Évitement obstacles\

Sortie poubelles (optionnel)

  

------------------------------------------------------------------------

  

# 10. Architecture ROS2

  

Nodes:

  

navigation_node\

delivery_node\

vision_node\

obstacle_avoidance_node\

mqtt_node\

interface_node\

safety_node\

trash_node (optionnel)

  

------------------------------------------------------------------------

  

# 11. Sécurité

  

Détection obstacles\

Arrêt urgence\

Surveillance capteurs

  

------------------------------------------------------------------------

  

# 12. Roadmap

  

Phase 1: installation ROS2\

Phase 2: navigation\

Phase 3: communication MQTT\

Phase 4: interface\

Phase 5: livraison\

Phase 6: sortie poubelles

  

------------------------------------------------------------------------

  

# 13. Résultat attendu

  

Robot capable de:

  

-   recevoir commandes

-   naviguer autonome

-   éviter obstacles

-   livrer médicaments

-   livrer repas

-   communiquer temps réel

-   sortir poubelles (optionnel)