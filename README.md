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
- Docker & Docker Compose

### 1. Variables d'environnement

```bash
cp infra/.env.example infra/.env
```

Éditer `infra/.env` si nécessaire (les valeurs par défaut suffisent pour le développement).

### 2. Lancer tout le stack

```bash
docker compose -f infra/docker-compose.yml up --build
```

Services exposés :
| Service    | URL                          |
|------------|------------------------------|
| Frontend   | `http://localhost:3000`      |
| Backend    | `http://localhost:4000`      |
| API Docs   | `http://localhost:4000/docs` |
| MQTT (tcp) | `localhost:1883`             |

### Lancer le backend en local (sans Docker)

```bash
cd backend
pip install -r requirements.txt
# Démarrer MySQL et Mosquitto séparément, ou via Docker :
docker compose -f ../infra/docker-compose.yml up -d mysql mosquitto
# Appliquer les migrations :
alembic upgrade head
# Lancer le serveur :
uvicorn app.main:app --reload --port 4000
```

### Tester l'auth admin

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@health-robot.local","password":"admin"}'
```

### Tests unitaires

```bash
cd backend
pytest tests/ -v
```

---

## Membres du groupe

- OUARDI Ahmed-Amine
- EHOUARA Christ-Yvann
- KOMOE Daniel
- SACKO Ousmane
- DRAME Baboye
