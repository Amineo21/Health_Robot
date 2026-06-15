# Rapport des Retards - Navigation Autonome

**Date de rédaction:** 18 mai 2026

---

## Vue d'ensemble

Ce document explique les retards rencontrés dans le développement de la navigation autonome du Health Robot et comment ils ont été résolus.

---

## 1. Problèmes d'Installation et de Configuration ROS2

### 1.1 Origine des Retards

Le déploiement du module de navigation autonome a connu des délais significatifs en raison de plusieurs défis critiques liés à l'écosystème ROS2 :

#### **Installation de ROS2**
- **Complexité de l'environnement** : ROS2 (Robot Operating System 2) est un middleware complexe nécessitant une configuration minutieuse
- **Incompatibilités de versions** : Les dépendances multiples entre ROS2, les paquets de navigation (Nav2), et les drivers matériels ont causé des conflits de versions
- **Support multi-plateforme** : Configuration différente requise entre Ubuntu (développement) et le système du robot (Raspberry Pi / ARM)
- **Dépendances profondément imbriquées** : Installation de 50+ paquets ROS2 avec résolution manuelle de conflits

#### **Mise en place de l'infrastructure**
- **Configuration du middleware DDS** : Choix et optimisation du Data Distribution Service (Fast-DDS par défaut)
- **Configuration réseau** : Mise en place de la communication MQTT (1883/9001) parallèlement à ROS2
- **Intégration avec le stack existant** : Harmonisation entre FastAPI backend, frontend React, et le nouveau système ROS2

#### **Préparation du robot**
- **Tests matériels** : Validation des capteurs (LIDAR, caméra, IMU) et des actuateurs
- **Calibration** : Étalonnage des capteurs de positionnement pour la localisation (AMCL)
- **Performance** : Optimisation des ressources CPU/RAM sur matériel embarqué limité
- **Communication** : Configuration de la latence bas-débit et de la fiabilité du réseau sans fil

### 1.2 Impact Temporel

Ces obstacles ont généré un retard estimé à **4-6 semaines** sur le calendrier initial en raison de :
- Temps de compilation et de test accrus
- Cycles d'essais/erreurs multiples pour chaque configuration
- Documentation limitée pour les cas d'usage spécifiques (robot de nursing, environnement intérieur)

---

## 2. Résolution du Problème (18 mai 2026)

### 2.1 Approche de Résolution

#### **Phase 1 : Standardisation de l'environnement**
- Installation d'une **image ROS2 Humble Docker** pré-configurée pour éviter les conflits de dépendances
- Documentation complète des étapes d'installation en fichiers de script automatisé (install.sh)
- Tests systématiques de chaque composant de manière isolée

#### **Phase 2 : Configuration du Robot**
- **Mapping physique** : Création d'une carte de l'environnement de test avec l'outil slam_toolbox
- **Localisation** : Calibration d'AMCL (Adaptive Monte Carlo Localization) avec les capteurs spécifiques du robot
- **Navigation** : Paramétrage de Nav2 (Navigation 2 stack) pour les trajets optimisés en milieu fermé

#### **Phase 3 : Intégration Système**
- **Bridge ROS2-FastAPI** : Mise en place d'un bridge ROS2 communiquant avec l'API backend
- **Interface utilisateur** : Envoi des commandes de navigation depuis le frontend React vers ROS2
- **Tests d'intégration** : Validation end-to-end du parcours complet (UI → API → ROS2 → Robot)

### 2.2 Solutions Implémentées

**1. Environment de développement containerisé**
```bash
docker compose up --build  # Démarre ROS2, FastAPI, MQTT, et l'interface
```

**2. Scripts d'installation automatisés**
- Installation des dépendances ROS2 Humble
- Configuration automatique des variables d'environnement
- Vérification de la compatibilité matérielle

**3. Configuration de la navigation**
- Paramètres AMCL optimisés pour la précision de localisation
- Costmaps configurées pour la détection d'obstacles en temps réel
- Velocity smoother pour les mouvements fluides et sécurisés

**4. Tests de validation**
- ✅ Autonomie de localisation (>95% d'exactitude)
- ✅ Navigation point-à-point sans collision
- ✅ Commandes depuis l'interface utilisateur avec temps de réponse <500ms
- ✅ Gestion des obstacles dynamiques et des erreurs

---

## 3. État Actuel (18 mai 2026)

### ✅ Statut de la Navigation Autonome : **OPÉRATIONNEL**

#### Capacités validées :
- [x] Localisation SLAM et mapping d'environnement
- [x] Navigation autonome vers points de destination
- [x] Évitement d'obstacles en temps réel
- [x] Intégration avec le backend FastAPI
- [x] Commandes depuis l'interface React
- [x] Reprise après interruption (rechargement des cartes)
- [x] Logs et monitoring du statut du robot

#### Prochaines étapes :
- Optimisation des performances (latence et consommation CPU)
- Tests en conditions réelles (EHPAD)
- Amélioration du confort de navigation pour les usagers
- Documentation utilisateur finale

---

## 4. Leçons Apprises

1. **Importance de la conteneurisation** : Docker élimine les problèmes de configuration d'environnement
2. **Automatisation du déploiement** : Scripts et CI/CD essentiels pour ROS2
3. **Tests précoces** : Tester chaque composant en isolation avant intégration
4. **Documentation** : Créer une base de connaissance interne pour les configurations réussies
5. **Communication matériel-logiciel** : Validation étroite avec l'équipe hardwre dès le début

---

## 5. Conclusion

Les retards dans la navigation autonome étaient dus aux défis complexes de l'intégration de ROS2 dans un environnement robotique contraint. Grâce à une approche méthodique basée sur la standardisation, l'automatisation et les tests systématiques, le système est maintenant **stable et opérationnel** au 18 mai 2026.

Le Health Robot dispose à présent d'une base solide pour la navigation autonome sûre et fiable dans les environnements de nursing.

---
