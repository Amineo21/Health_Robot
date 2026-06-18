# Health Robot

Robot de santé autonome avec backend FastAPI, frontend TanStack Start, broker MQTT et persistance MySQL.

---

## Architecture du Backend (Clean Architecture)

```
backend/
├── app/
│   ├── domain/              # Cœur métier — pas de dépendances externes
│   │   ├── entities/        #   User, RobotState, MqttTopic
│   │   └── repositories/    #   Protocoles (UserRepository, RobotStateRepository, MessagePublisher)
│   ├── application/         # Cas d'utilisation et DTO
│   │   ├── dto/             #   LoginRequest, CreateUserRequest, TokenResponse, …
│   │   └── use_cases/       #   AuthenticateUser, CreateUser, TriggerEmergencyStop, …
│   ├── infrastructure/      # Adaptateurs concrets
│   │   ├── database/        #   SQLAlchemy, Alembic, models
│   │   ├── mqtt/            #   Client Paho MQTT
│   │   ├── repositories/    #   SqlAlchemyUserRepository, InMemoryUserRepository
│   │   └── security/        #   JwtTokenService, PasswordHasher
│   ├── presentation/        # Couche API
│   │   └── api/
│   │       ├── v1/endpoints/#   auth.py, admin_users.py, robot.py, safety.py, navigation.py
│   │       ├── dependencies.py  # get_current_user, require_roles, dep inj
│   │       └── health.py        # Health check
│   ├── core/
│   │   └── config.py        # Settings (JWT, DB, MQTT, vars env)
│   └── main.py              # create_app, lifespan, assemble DI
├── tests/
│   ├── conftest.py
│   ├── helpers.py
│   ├── test_auth_endpoints.py
│   ├── test_admin_user_endpoints.py
│   ├── test_robot_permissions.py
│   └── test_public_robot_ingestion.py
├── alembic/                 # Migrations DB
├── pyproject.toml
├── requirements.txt
├── Dockerfile
└── uv.lock
```

## Conventions

### Règles générales
- **Clean Architecture** : le domaine ne dépend jamais de FastAPI, SQLAlchemy, JWT ou passlib
- **Pas de dossiers** `routes/`, `services/`, `models/` à la racine de `app/`
- **Injection de dépendances** : les repositories et services sont passés via le container de use cases (`application/use_cases/container.py`)
- **Endpoints** : définis dans `presentation/api/v1/endpoints/`, protégés via les dépendances dans `presentation/api/dependencies.py`

### Authentification
- Deux rôles : `admin` (accès complet) et `caregiver` (accès opérationnel)
- JWT pour l'auth humaine, routes robot-only publiques sans protection
- Pas d'inscription publique : création des comptes uniquement par l'admin
- Seed du premier admin via variables d'environnement (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME`)

### Persistance
- MySQL 8.4 via Docker (volume nommé `health_robot_mysql_data`)
- Repository backend paramétrable : `USER_REPOSITORY_BACKEND=database` ou `memory`
- Migrations avec Alembic

### Tests
- pytest + httpx dans `tests/`
- `scope=module` pour partager le TestClient entre tests
- Compteur global d'emails uniques pour éviter les collisions

### Commits
- `[FEAT]:`, `[FIX]:`, `[REFACTOR]:`, `[DOCS]:`

## Ce qui a été fait

- [x] Restructuration complète en Clean Architecture
- [x] Authentification JWT (login, logout, me) avec rôles admin/caregiver
- [x] CRUD utilisateurs admin (création, liste, modification, désactivation, reset password)
- [x] Protection dernier admin actif
- [x] Persistance MySQL avec SQLAlchemy + Alembic
- [x] Routes robot protégées (status, emergency stop, navigation ETA)
- [x] Routes robot-only publiques (battery, ETA robot)
- [x] Documentation OpenAPI enrichie
- [x] Seed automatique du premier admin
- [x] Tests organisés par catégorie
- [x] Docker Compose avec MySQL, Mosquitto, backend et frontend

## Lancer le projet

### Prérequis

- Docker & Docker Compose v2
- Git

### 1. Cloner le repo

```bash
git clone git@github.com:Amineo21/Health_Robot.git
cd Health_Robot
```

### 2. Créer le fichier d'environnement

```bash
cp infra/.env.example infra/.env
```

Éditer `infra/.env` et **remplir les valeurs obligatoires** :

```bash
# Sécurité — REQUIS (le serveur ne démarre pas sans ces variables)
JWT_SECRET_KEY=<un-secret-long-au-moins-32-caracteres>
INITIAL_ADMIN_PASSWORD=<un-mot-de-passe-fort>

# MySQL
MYSQL_ROOT_PASSWORD=<un-mot-de-passe-fort>
MYSQL_PASSWORD=<un-mot-de-passe-fort>

# Optionnel — override si besoin
INITIAL_ADMIN_EMAIL=admin@health-robot.local
INITIAL_ADMIN_NAME=Admin
```

> **Générer un secret rapide :**
> ```bash
> openssl rand -base64 48
> ```

### 3. Lancer tout le stack

```bash
docker compose -f infra/docker-compose.yml up --build -d
```

### 4. Vérifier que tout tourne

```bash
docker compose -f infra/docker-compose.yml ps
curl http://localhost:4000/health
```

Résultat attendu :

| Service    | URL / Port                  | Vérification                       |
|------------|-----------------------------|------------------------------------|
| Frontend   | `http://localhost:3000`     | Page de login s'affiche            |
| Backend    | `http://localhost:4000`     | `{"status":"healthy"}`             |
| API Docs   | `http://localhost:4000/docs`| Swagger UI s'affiche               |
| MQTT       | `localhost:1883`            | Broker actif                       |
| MySQL      | `localhost:3306`            | Healthcheck OK dans docker ps      |

> **Important — connexion au robot réel**
>
> Par défaut, le backend essaie de se connecter au robot M3 Pro réel via `ROBOT_ROSBRIDGE_URL=ws://10.10.220.180:9090` et `ROBOT_DASHBOARD_URL=http://10.10.220.180:8080`.
>
> Si la machine n'est pas sur le même réseau que le robot, si l'IP du robot est différente, ou si `rosbridge_websocket` n'est pas lancé sur le robot, les logs peuvent afficher en boucle :
>
> ```text
> WARNING:app.infrastructure.rosbridge.mqtt_rosbridge_bridge:Erreur rosbridge: [Errno 111] Connection refused
> ERROR:websocket:[Errno 111] Connection refused - goodbye
> WARNING:app.infrastructure.rosbridge.mqtt_rosbridge_bridge:Connexion rosbridge perdue, nouvelle tentative dans 3s
> ```
>
> Ce warning ne signifie pas que le backend, le frontend, Docker ou MQTT sont cassés. Il indique seulement que le backend ne peut pas ouvrir la WebSocket ROS du robot sur `10.10.220.180:9090` depuis cette machine.
>
> Pour vérifier l'accès au robot depuis une autre machine :
>
> ```bash
> nc -vz 10.10.220.180 9090
> curl http://10.10.220.180:8080
> ```
>
> Si vous lancez le projet sans robot réel, désactivez simplement le pont rosbridge dans `infra/.env` :
>
> ```bash
> ROBOT_ROSBRIDGE_ENABLED=false
> ```
>
> Si le robot a une autre adresse IP, gardez le pont activé mais remplacez les URLs :
>
> ```bash
> ROBOT_ROSBRIDGE_ENABLED=true
> ROBOT_ROSBRIDGE_URL=ws://<ip-du-robot>:9090
> ROBOT_DASHBOARD_URL=http://<ip-du-robot>:8080
> ```

### 5. Se connecter pour la première fois

- **URL** : `http://localhost:3000`
- **Email** : `admin@health-robot.local` (ou la valeur de `INITIAL_ADMIN_EMAIL`)
- **Mot de passe** : la valeur de `INITIAL_ADMIN_PASSWORD`

### 6. Créer des comptes caregivers

Depuis l'interface admin (`/admin/users`) ou l'API :

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@health-robot.local","password":"<votre-mot-de-passe>"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -X POST http://localhost:4000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"caregiver@health-robot.local","name":"Infirmier","password":"CaregiverPass123!","role":"caregiver"}'
```

---

### Lancer le backend en local (sans Docker)

```bash
cd backend
pip install -r requirements.txt

# MySQL + Mosquitto via Docker :
docker compose -f ../infra/docker-compose.yml up -d mysql mosquitto

# Variables d'environnement (minimal) :
export JWT_SECRET_KEY=$(openssl rand -base64 48)
export INITIAL_ADMIN_PASSWORD=dev-password
export DATABASE_URL=mysql+pymysql://health_robot:health_robot@localhost:3306/health_robot?charset=utf8mb4
export USER_REPOSITORY_BACKEND=database

# Migrations :
alembic upgrade head

# Lancer :
uvicorn app.main:app --reload --port 4000
```

### Lancer le frontend en local (sans Docker)

```bash
cd frontend/health-robot-front
npm ci
echo "VITE_API_BASE_URL=http://localhost:4000" > .env
npm run dev
```

Le frontend démarre sur `http://localhost:3000`.

### Tests unitaires

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend
cd frontend/health-robot-front
npm test
```

---

### Dépannage

| Problème | Solution |
|----------|----------|
| `RuntimeError: Environment variable JWT_SECRET_KEY is required` | Ajouter `JWT_SECRET_KEY=<secret>` dans `infra/.env` |
| `RuntimeError: Environment variable INITIAL_ADMIN_PASSWORD is required` | Ajouter `INITIAL_ADMIN_PASSWORD=<mot-de-passe>` dans `infra/.env` |
| Backend ne démarre pas, logs `Access denied for user` | Vérifier que `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` sont cohérents dans `.env` |
| Frontend affiche "Erreur réseau" | Vérifier que le backend tourne : `curl http://localhost:4000/health` |
| MQTT ne connecte pas | Vérifier `docker compose logs mosquitto` — le broker doit écouter sur 1883 |
| Logs répétés `Erreur rosbridge: [Errno 111] Connection refused` | La machine ne peut pas joindre le robot sur `ROBOT_ROSBRIDGE_URL`. Vérifier le réseau/IP/port `9090`, ou mettre `ROBOT_ROSBRIDGE_ENABLED=false` si aucun robot réel n'est utilisé |

---

## Membres du groupe

- OUARDI Ahmed-Amine
- EHOUARA Christ-Yvann
- KOMOE Daniel
- SACKO Ousmane
- DRAME Baboye
