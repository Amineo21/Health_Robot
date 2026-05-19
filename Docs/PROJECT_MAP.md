# Project Map - Health Robot

_Cartographie du système Health Robot EHPAD: blocs, flux, interfaces, responsabilités et localisation de composants pour livraison autonome de matériel et repas._

---

## Contexte projet

**Vision**: Robot autonome ROSMASTER M3 Pro pour assister le personnel d'EHPAD en livrant matériel et repas, libérant ~2-3h/jour pour le personnel soignant.

**Environnement**: EHPAD (couloirs, chambres patients, cuisine) - intérieur uniquement  
**Constraints**: Vitesse max 0.5 m/s, capacité < 5kg, arrêt d'urgence iso 3691-4  
**Tech Stack**: ROS2 (Jetson Nano/Orin NX) + FastAPI (Backend) + React TanStack (Frontend) + MQTT (Communication) + Docker

## Variables d'environnement (Docker)

Le stack Docker lit `infra/.env` (copier depuis `infra/.env.example`, ne pas committer `infra/.env`).

```env
MQTT_BROKER=
DB_HOST=
DB_PORT=
MYSQL_USER=
MYSQL_DATABASE=
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=
MQTT_HOST=
MQTT_PORT=
```

---

## Vue d'ensemble architecturale

```
┌─────────────────┐          ┌──────────────────────┐
│   Personnel     │  WiFi    │   Robot ROSMASTER    │
│   (Tablette)    │◄────────►│  - ROS2 + Nav2       │
│   React PWA     │          │  - Jetson Nano/Orin  │
│  Port 3000      │          │  - Lidar 360°        │
└─────────────────┘          └──────────┬───────────┘
         │                              │
    HTTP/WebSocket                  MQTT/ROS2
         │                              │
    ┌────┴──────────────────────────────┴─────┐
    │                                          │
┌───▼──────────────────────┐      ┌──────────▼──────┐
│   Backend (FastAPI)      │      │  Mosquitto MQTT  │
│   - Orchestration        │      │  - Topics        │
│   - Validation commandes │      │  - Broker        │
│   - API REST             │      │  - Auth          │
│   - Logs centralisés     │      │  (1883, 9001)    │
│   Port 4000              │      └──────────────────┘
└──────────────────────────┘
         │
    ┌────┴─────────────────┐
    │                      │
┌───▼───────────────┐  ┌──▼──────────────┐
│   Docker Volumes  │  │   Nginx Proxy   │
│   - Logs          │  │   (Port 80/443) │
│   - Config MQTT   │  │   Load Balancer │
│   - Persistence   │  └─────────────────┘
└───────────────────┘
```

---

## Composants principaux

### 1. **Frontend** (`frontend/health-robot-front/`) — Interface Soignants/Cuisine

#### Technologie
- **Framework**: TanStack Start + React 19 + TypeScript  
- **Routing**: TanStack Router (file-based)  
- **Styling**: Tailwind CSS v4.1  
- **Build**: Vite 7 + Nitro  
- **Déploiement**: PWA (Progressive Web App) sur tablette/mobile sans store
- **Port**: 3000 (dev), via Nginx (prod)

#### Structure
```
src/
├── routes/          # File-based routing (TanStack Router)
│   ├── __root.tsx   # Layout racine
│   ├── index.tsx    # Dashboard principal
│   ├── delivery.tsx # Commande livraison (UC-01, UC-02)
│   ├── status.tsx   # Suivi robot temps-réel
│   └── logs.tsx     # Historique livraisons
├── components/
│   ├── Header.tsx           # Navigation
│   ├── DeliveryForm.tsx     # Sélection chambre/matériel
│   ├── RobotTracker.tsx     # Position en temps-réel
│   └── BatteryAlert.tsx     # Alerte batterie faible
├── hooks/
│   ├── useMQTT.ts          # WebSocket MQTT
│   └── useDelivery.ts      # Logique commandes
├── router.tsx       # Configuration routeur
└── styles.css       # Styles globaux Tailwind
```

#### Responsabilités
- **Personnel soignant (Marie)**: Sélectionner chambre + type matériel → envoyer commande
- **Personnel cuisine (Paul)**: Préparer repas → confirmer livraison sur robot
- **Infirmier/Admin (Sylvain)**: Vue dashboard, historique, statistiques
- Affichage **temps-réel** du statut robot (position, batterie, état)
- Gestion des **erreurs** et **alertes** (batterie, collision, obstacle)
- **Confirmation** de livraison (matériel retiré / repas reçu)

#### Personas utilisateurs

| Persona | Besoins | Utilisation |
|---------|---------|-------------|
| **Marie** (Soignant) | Interface simple, gros boutons, gestion gants | Tablette - 30-50 commandes/jour |
| **Paul** (Cuisine) | Suivi repas, température, logs détaillés | PC cuisine - Batch repas x3 demi-journée |
| **Sylvain** (Infirmier) | Dashboard, statistiques, configuration | Admin - Supervision générale |

#### Points d'intégration
- **API Backend**: HTTP GET/POST à `http://backend:4000`
- **MQTT WebSocket**: Subscription directe `ws://mosquitto:9001` pour real-time
  - Topics: `/robot/status`, `/robot/battery`, `/delivery/{id}/update`

---

### 2. **Backend** (`backend/`) — Orchestration & Logique métier

#### Technologie
- **Framework**: FastAPI (Python 3.11)
- **Serveur**: Uvicorn (async)
- **Communication MQTT**: Paho-mqtt client
- **Port**: 4000
- **Conteneurisation**: Docker

#### Structure
```
app/
├── main.py                 # Point d'entrée FastAPI
├── routes/
│   ├── delivery.py        # Endpoints livraison (POST /api/mission)
│   ├── robot.py           # Endpoints robot (GET /api/robot/status)
│   ├── logs.py            # Endpoints logs (GET /api/logs)
│   └── auth.py            # Endpoints authentification (optionnel)
├── mqtt/
│   ├── client.py          # Client MQTT
│   ├── handlers.py        # Callbacks (status, battery, etc)
│   └── topics.py          # Définition topics
├── models/
│   ├── delivery.py        # Delivery, Mission
│   ├── robot.py           # RobotState, BatteryStatus
│   └── logs.py            # LogEntry
├── core/
│   ├── config.py          # Config (env vars, MQTT_BROKER)
│   └── logging_config.py  # Logger JSON structuré
└── [utils, schemas, dependencies]
```

#### Responsabilités
- **Endpoints API** pour frontend (POST /api/mission, GET /api/robot/status)
- **Orchestration** des commandes: validation → MQTT publish
- **Etat robot**: agrégation des topics MQTT
- **Persistence**: Logs, historique livraisons (File ou DB)
- **Sécurité**: Authentification personnel, validation chambre
- **Gestion erreurs**: Retry MQTT, timeout handling, circuit breaker

#### Topics MQTT publiés/écoutés

| Topic | Direction | Payload | Fréquence |
|-------|-----------|---------|----------|
| `/robot/command` | Backend → Robot | `{"action": "navigate", "destination": "Room_302"}` | On-demand |
| `/robot/status` | Robot → Backend | `{"state": "navigating", "position": {...}}` | 1 Hz |
| `/robot/battery` | Robot → Backend | `{"level": 75, "status": "charging"}` | 0.5 Hz |
| `/robot/collision` | Robot → Backend | `{"detected": true, "type": "person"}` | On-event |
| `/delivery/{id}/start` | Backend → Robot | `{"mission_id": "123", "room": "302"}` | On-demand |
| `/delivery/{id}/complete` | Robot → Backend | `{"success": true, "timestamp": "..."}` | On-event |
| `/heartbeat` | Bidirectionnel | `{"timestamp": "..."}` | 1 Hz |

#### Use Cases traités
- **UC-01** (Livrer matériel): POST /api/mission → MQTT → nav → confirmation
- **UC-02** (Livrer repas): POST /api/mission + metadata température
- **UC-05** (Retour base): Logic batterie < 20% → return to dock
- **UC-07** (Batterie faible): MQTT battery topic → alerte frontend
- **UC-08** (Arrêt urgence): Endpoint POST /api/emergency → MQTT broadcast

#### Points d'intégration
- **HTTP API**: Écoute port 4000, reçoit requêtes frontend
- **MQTT**: Se connecte à Mosquitto (localhost:1883)
- **ROS2 Bridge** (futur): Peut connecter directement à ROS2 du robot
- **Persistance**: Docker volume pour logs/DB

---

### 3. **Infrastructure** (`infra/`) — DevOps & Networking

#### Composants

**Docker Compose** (`docker-compose.yml`)
- **Orchestration** des 3 services (Frontend, Backend, Mosquitto)
- **Networking**: Isolated network pour communication inter-services
- **Volumes persistants**:
  - `logs/`: Logs applica (Frontend, Backend, Robot)
  - `mosquitto/`: Config + auth
  - `mosquitto/data/`: Persistence des subscriptions

```yaml
# Services
frontend:  # Port 3000
backend:   # Port 4000
mosquitto: # Ports 1883, 9001
```

**Mosquitto MQTT** (`mosquitto/`)
- **Broker** central pour communication robot-backend-frontend
- **Port 1883**: MQTT natif (robot + backend)
- **Port 9001**: WebSocket (frontend subscribers)
- **Topics**: Définis dans `backend/app/mqtt/topics.py`
- **Auth**: Utilisateurs/passwords `mosquitto/config/password.txt`
  - `robot`: ROS2 robot
  - `backend`: FastAPI
  - `frontend`: Browser WebSocket
- **Config**: `mosquitto/config/mosquitto.conf`

```
mosquitto.conf:
- persistence: true (garder subscriptions)
- max_connections: 1000
- max_queued_messages: 1000
```

**Nginx** (`nginx/nginx.conf`)
- **Reverse proxy** HTTP + WebSocket upgrade
- **Routage**:
  - `/` → Frontend (3000)
  - `/api` → Backend (4000)
  - `/mqtt` → Mosquitto WebSocket (9001)
- **Port**: 80 (dev), 443 SSL (prod)
- **Features**: Compression gzip, cache static, rate limiting

#### Responsabilités
- **Démarrage orchestré** des services (docker-compose up)
- **Networking** isolé: frontend ↔ backend ↔ mosquitto
- **Persistance** des logs et config
- **Load balancing** & reverse proxying (Nginx)
- **Sécurité**: Auth MQTT, isolation Docker

---

## ROS2 Nodes sur Robot (Jetson Nano/Orin NX)

| Node | Type | Input | Output | Responsabilité | UC |
|------|------|-------|--------|---------------|----- |
| `mqtt_node` | Bridge | ROS2 topics | MQTT publish/subscribe | Communication bidirectionnelle avec backend | Tous |
| `navigation_node` (Nav2) | Autonome | Goal coordinates via /delivery/start | /tf, /odom, /cmd_vel | Navigation autonome vers chambre | UC-03 |
| `obstacle_avoidance_node` | Safety | /scan (Lidar) | Emergency stop signal, collision alerts | Détecte obstacles + arrêt urgence | UC-04 |
| `vision_node` | IA | /camera | /detection (persons, objects) | Classification obstacles (personne vs objet) | UC-04 |
| `battery_monitor_node` | Health | BMS voltage | `/robot/battery` MQTT | Monitoring batterie Jetson + alerte critique | UC-07 |
| `safety_node` | Critical | All sensors | Emergency signals, health status | Gère arrêts d'urgence + heartbeat | UC-08 |
| `delivery_node` | Orchestration | `/delivery/{id}/start` MQTT | Navigation goal + status updates | Orchestration des missions UC-01/UC-02 | UC-01, UC-02 |
| `slam_node` | Mapping | /scan + /imu | Map, /tf | SLAM (cartographie + localisation) | UC-03 |

---

## Flux de données par Use Case

### **UC-01 & UC-02: Commande de livraison** (Matériel ou Repas)

```
1. Personnel (Marie/Paul) clique "Livrer matériel/repas"
           ↓
2. Frontend envoie: POST /api/mission
   JSON: {"room": "302", "type": "materiel|repas", "details": {...}}
           ↓
3. Backend valide la commande
   - Chambre existe? Personnel autorisé? Robot disponible?
           ↓
4. Backend crée Mission(id=XYZ, status="PENDING")
   Sauvegarde en DB/volume
           ↓
5. Backend publie sur MQTT: /delivery/XYZ/start
   {"mission_id": "XYZ", "destination": "302", "cargo": "materiel"}
           ↓
6. Robot reçoit commande via ROS2 MQTT bridge
   Node delivery_node lance navigation_node
           ↓
7. Robot navigue (UC-03) avec évitement obstacles (UC-04)
   Publie: /robot/status {"state": "navigating", "position": {...}}
           ↓
8. Frontend subscribe /robot/status + /delivery/XYZ/update
   Affiche position temps-réel, ETA
           ↓
9. Robot arrive à chambre 302
   Publie: /delivery/XYZ/complete {"success": true}
   Affiche signal sonore + LED clignotante
           ↓
10. Personnel ouvre l'interface
    Valide transfert: clique "Livraison confirmée"
           ↓
11. Backend met à jour Mission(status="COMPLETED")
    Log l'événement: timestamp, room, duration, success
           ↓
12. Robot retourne à base (UC-05)
```

**Timing cible**: < 3 minutes (commande à livraison)

---

### **UC-04: Évitement d'obstacles** (Continu pendant navigation)

```
Robot Lidar scan 10 Hz
    ↓
Si obstacle < 1m:
    ├─ Personne détectée? → ARRÊT IMMÉDIAT + son + LED rouge
    ├─ Objet fixe? → Calcul roue alternative (Nav2)
    └─ Objet mobile? → Observation 5s
    ↓
Robot publie: /robot/collision {"detected": true, "type": "person"}
    ↓
Backend reçoit → Frontend alerte personnel
    ↓
Personnel intervient ou robot reprend quand chemin libre
```

**Sécurité critique**: Zéro collision policy

---

### **UC-07: Batterie faible** (Continu)

```
Robot détecte battery < 20%
    ↓
Publie: /robot/battery {"level": 18, "status": "CRITICAL"}
    ↓
Backend subscribe
    ↓
Frontend affiche alerte rouge + sound
    ↓
Si mission en cours:
    ├─ Abandon tâche
    └─ Retour immédiat base
    ↓
Robot dock s'engage chargeur
    ↓
Backend log: battery_critical_event
```

**Notification**: Push alert + UI clignotante

---

### **UC-08: Arrêt d'urgence** (On-demand)

```
Personnel appuie bouton STOP (UI ou physique)
    ↓
Frontend envoie: POST /api/emergency {"action": "stop_all"}
    ↓
Backend publie: /robot/command {"action": "emergency_stop"}
    ↓
Robot reçoit:
    ├─ Coupe moteurs (< 100ms)
    ├─ Freins se bloquent
    ├─ LED passe rouge clignotant
    └─ Son d'alerte
    ↓
Backend log: emergency_stop_executed
    ↓
Frontend affiche écran rouge "ARRÊT D'URGENCE"
    ↓
Maintenance physique du robot requise
```

**Criticité**: Sécurité → arrêt < 100ms

---

## Interfaces clés

### Frontend ↔ Backend (HTTP)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/health` | GET | Vérification santé |
| `/api/robot/status` | GET | État du robot |
| `/api/mission` | POST | Créer nouvelle mission |
| `/api/mission/{id}` | GET | Détail mission |
| `/api/logs` | GET | Récupérer logs |

### Backend ↔ MQTT

| Topic | Direction | Description |
|-------|-----------|-------------|
| `robot/command` | Backend → Robot | Commandes |
| `robot/status` | Robot → Backend | Telemetrie/Status |
| `robot/battery` | Robot → Backend | Batterie |
| `robot/logs` | Robot → Backend | Logs du robot |
| `heartbeat` | Bidirectionnel | Keepalive |

### Frontend ↔ MQTT (WebSocket)

- Subscription directe aux topics MQTT via WebSocket
- Real-time updates du statut robot
- Broadcast des événements système

---

## Localisation des éléments clés

| Élément | Localisation | Contenu |
|--------|-------------|--------|
| **Routes Frontend** | `frontend/health-robot-front/src/routes/` | Delivery form, Robot tracker, Dashboard |
| **Composants UI** | `frontend/health-robot-front/src/components/` | DeliveryForm, RobotTracker, BatteryAlert, Header |
| **Styles** | `frontend/health-robot-front/src/styles.css` | Tailwind v4.1 global styles |
| **Hook MQTT** | `frontend/health-robot-front/src/hooks/useMQTT.ts` | WebSocket subscription aux topics |
| **Endpoints API** | `backend/app/routes/delivery.py, robot.py` | POST /api/mission, GET /robot/status, POST /emergency |
| **Configuration Backend** | `backend/app/core/config.py` | MQTT_BROKER, API_PORT, LOG_LEVEL |
| **Client MQTT** | `backend/app/mqtt/client.py` | Paho-mqtt client, callbacks |
| **Topics MQTT** | `backend/app/mqtt/topics.py` | Constantes topics, QoS levels |
| **Logging structuré** | `backend/app/core/logging_config.py` | JSON formatter pour logs |
| **Config Mosquitto** | `infra/mosquitto/config/mosquitto.conf` | Persistence, ports, max connections |
| **Auth MQTT** | `infra/mosquitto/config/password.txt` | Users: robot, backend, frontend |
| **Setup Docker Compose** | `infra/docker-compose.yml` | Services: frontend, backend, mosquitto |
| **Reverse Proxy** | `infra/nginx/nginx.conf` | Routing / → frontend, /api → backend, /mqtt → mosquitto |
| **Docker volumes** | `infra/docker-compose.yml` | logs/, mosquitto/config/, mosquitto/data/ |
| **CDC (Specs)** | `Docs/CDC-technique.md` | Use cases, personas, roadmap, risques |
| **Roadmap phases** | `Docs/CDC-technique.md` | Phase 1-6 jusqu'à 13/07/2026 |

**Organisation**: Frontend (TanStack) → Backend (FastAPI) → MQTT (Mosquitto) → Robot ROS2

---

## Tech Stack détaillé

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|----------|
| **Frontend** | TanStack Start | 1.x | Framework React meta |
| - | React | 19 | UI components |
| - | TypeScript | 5.x | Type safety |
| - | Tailwind CSS | 4.1 | Styling |
| - | Vite | 7 | Build tool |
| **Backend** | FastAPI | 0.104+ | Web framework |
| - | Python | 3.11 | Runtime |
| - | Paho MQTT | 1.6+ | MQTT client |
| - | Uvicorn | 0.24+ | ASGI server |
| - | SQLAlchemy | 2.x | ORM (optional) |
| **Robot** | ROS2 | Humble/Foxy | Robot OS |
| - | Nav2 | Latest | Autonomous navigation |
| - | slam_toolbox | Latest | SLAM/mapping |
| - | OpenCV | 4.5+ | Vision processing |
| **Communication** | Mosquitto | 2.x | MQTT broker |
| - | Paho JS | 1.4+ | WebSocket (frontend) |
| **Infrastructure** | Docker | 20+ | Containerization |
| - | Docker Compose | 2.x | Orchestration |
| - | Nginx | Latest | Reverse proxy + LB |
| **Storage** | File system | - | Phase 1 (logs) |
| - | PostgreSQL | 14+ | Phase 2+ (missions, users) |
| **Hardware** | ROSMASTER M3 Pro | - | Robot platform |
| - | Jetson Nano/Orin NX | - | Robot compute |
| - | Lidar ToF Dual | - | 360° obstacle detection |

---

## Ressources & Documentation

- **Frontend README**: `frontend/health-robot-front/README.md`
- **Backend Requirements**: `backend/requirements.txt`
- **CDC Technique complète**: `Docs/CDC-technique.md` (Personas, Use cases, Roadmap)
- **MVP Specs**: `Docs/MVP.md`
- **Logs Plan**: `Docs/LOGS_PLAN.md`
- **Conventions équipe**: `AGENTS.md`
- **Roadmap phases**: `Docs/CDC-technique.md#11-roadmap` (Phase 1-6 jusqu'à 13/07/2026)

---

## État du projet (Phase 1)

### ✅ Complété
- [x] Structure monorepo
- [x] Frontend scaffold (TanStack Start)
- [x] Backend scaffold (FastAPI)
- [x] Infrastructure Docker Compose
- [x] Mosquitto MQTT setup
- [x] Project Map (ce document)
- [x] Logs Plan
- [x] CDC technique

### ⏳ Phase 1 (23/02 → 15/03)
Setup ROS2 + préparation du robot
- [ ] Installation ROS2 sur Jetson Nano/Orin NX
- [ ] Drivers Lidar + Caméra
- [ ] Configuration réseau (WiFi, IP fixe)
- [ ] Premiers nodes ROS2 (mqtt_node, safety_node)
- [ ] Test topics MQTT (/scan, /camera, /imu)

### ⏳ Phase 2 (16/03 → 26/04)
Navigation autonome (Nav2 + SLAM)
- [ ] Cartographie SLAM de l'EHPAD
- [ ] Configuration Nav2
- [ ] Tests navigation sans obstacles

### ⏳ Phase 3 (27/04 → 17/05)
Communication MQTT + WebSocket
- [ ] Topics MQTT définies et documentées
- [ ] Endpoints Backend fonctionnels
- [ ] WebSocket Frontend connectée
- [ ] Tests bout-en-bout

### ⏳ Phase 4 (18/05 → 07/06)
Interface React
- [ ] Pages delivery/status/logs
- [ ] Composants UI (DeliveryForm, RobotTracker, BatteryAlert)
- [ ] Intégration WebSocket MQTT

### ⏳ Phase 5 (08/06 → 28/06)
Livraison + Tests
- [ ] UC-01 et UC-02 fonctionnelles (95% success rate)
- [ ] Tests unitaires/intégration

### ⏳ Phase 6 (29/06 → 13/07)
Commande vocale (optional)
- [ ] Mode vocal optionnel

---

## Notes importantes

**Personas utilisateurs**: Marie (soignant), Paul (cuisine), Sylvain (management)  
**Objectif principal**: Livrer matériel & repas autonomes en < 3 min  
**Contraintes sécurité**: Vitesse max 0.5 m/s, arrêt urgence < 100ms, zéro collision  
**Environnement**: EHPAD intérieur uniquement  
**Personne liaison tech**: Référer au CDC-technique pour questions d'architecture  

---

**Dernière mise à jour**: 25 février 2026  
**Basé sur**: CDC-technique.md (v1.0)  
**Propriétaire doc**: Équipe architecture  
**Maintenance**: À jour après chaque phase clé
