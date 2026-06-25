# Mission Control Implementation Plan

## Goal

Replace the current free-coordinate `/control` page with a backend-owned operational mission interface for CareBot delivery missions.

The MVP proves the complete loop: create a mission, route to stock, wait for recovery confirmation, route to delivery room, wait for delivery confirmation, complete the mission, then start the next queued mission if one exists.

## Fixed Decisions

- The backend is the source of truth for mission state.
- Mission state, annotated points, stock configuration, confirmations, cancellation and history are persisted in the database.
- New persisted tables are introduced through Alembic migrations.
- `/control` is the main operational mission page.
- `/map` remains the admin mapping/configuration page.
- `/robot-screen` is a dedicated web route for the robot onboard screen.
- `/robot-screen` is protected by a dedicated robot-screen token, not by a human login.
- The robot screen displays French labels.
- Foxglove is visualization only. Mission commands stay in the Health Robot backend.
- Foxglove embedding is not blocking for MVP. If embedding is not feasible quickly, `/control` shows an “open Foxglove” action.
- Mission orchestration is event-driven, not a background polling loop.
- Robot arrival is detected by backend pose proximity to the active target.
- Human confirmation is required for recovery and delivery.
- Recovery and delivery wait states have no automatic timeout in the MVP.
- The future scan feature can later automate or replace the recovery confirmation.
- Multiple missions can be queued, but only one mission can be active at a time.
- The queued mission order is FIFO for MVP.
- Navigation free-form coordinates are removed from the operational `/control` flow.

## Domain Model

### Supply Type

Supported supplies are fixed for the MVP:

- `serviettes`
- `papier_toilette`
- `gants`
- `protections`
- `linge`

### Annotated Point

An annotated point is a reusable map point created by an admin.

Point types:

- `STOCK`
- `DELIVERY_ROOM`
- `ROBOT_BASE`

Minimum fields:

- `id`
- `name`
- `type`
- `x`
- `y`
- `yaw`
- `is_active`
- `created_at`
- `updated_at`

Rules:

- Admins create, edit and deactivate annotated points on `/map`.
- Caregivers do not create or edit annotated points.
- Missions reference existing active `DELIVERY_ROOM` points.
- Points are soft-deactivated instead of hard-deleted if they have been referenced by missions.
- A mission stores the selected point IDs and coordinate snapshots so later point edits do not change an already-created mission.

### Stock Configuration

A stock point can contain multiple supplies.

Minimum model:

- `stock_point_id`
- `supply_type`
- `priority_order`
- `is_active`

Rules:

- The backend chooses the first active compatible stock by `priority_order`.
- No admin override stock selection in MVP.
- If no active stock can provide the requested supply, mission creation fails with a clear validation error.

### Mission

Mission state is separate from `RobotMode`.

Mission statuses:

```text
PENDING
NAVIGATING_TO_STOCK
WAITING_FOR_RECOVERY_CONFIRMATION
NAVIGATING_TO_DELIVERY
WAITING_FOR_DELIVERY_CONFIRMATION
COMPLETED
CANCELLED
FAILED
```

Minimum fields:

- `id`
- `status`
- `supply_type`
- `delivery_room_id`
- `delivery_room_name_snapshot`
- `delivery_x_snapshot`
- `delivery_y_snapshot`
- `delivery_yaw_snapshot`
- `stock_point_id`
- `stock_point_name_snapshot`
- `stock_x_snapshot`
- `stock_y_snapshot`
- `stock_yaw_snapshot`
- `created_by_user_id`
- `created_by_name_snapshot`
- `created_at`
- `started_at`
- `arrived_at_stock_at`
- `recovery_confirmed_at`
- `recovery_confirmed_by_user_id`
- `arrived_at_delivery_at`
- `delivery_confirmed_at`
- `delivery_confirmed_by_user_id`
- `completed_at`
- `cancelled_at`
- `cancelled_by_user_id`
- `failure_reason`
- `updated_at`

## Mission Flow

### Create Mission

1. A caregiver or admin selects a supply and delivery room on `/control`.
2. The backend validates the delivery room is an active `DELIVERY_ROOM`.
3. The backend chooses the compatible stock point by active stock rule order.
4. The backend persists the mission as `PENDING` with point snapshots.
5. If no mission is active and the robot is not in emergency stop, the backend starts the next mission immediately.

### Start Mission

1. The oldest `PENDING` mission is selected.
2. The mission becomes `NAVIGATING_TO_STOCK`.
3. The backend publishes a navigation command to the stock snapshot coordinates.
4. `RobotStatus.mission_id` uses the `Mission.id`, not the command id.

### Arrive At Stock

1. Robot pose telemetry updates the backend state.
2. The mission orchestrator checks distance to the stock target.
3. If distance is within `MISSION_ARRIVAL_RADIUS_M`, the mission becomes `WAITING_FOR_RECOVERY_CONFIRMATION`.
4. The robot stays blocked in this state until a caregiver or admin confirms recovery.

### Confirm Recovery

1. A caregiver or admin confirms recovery from `/control`.
2. The backend stores `recovery_confirmed_by_user_id` and `recovery_confirmed_at`.
3. The mission becomes `NAVIGATING_TO_DELIVERY`.
4. The backend publishes a navigation command to the delivery room snapshot coordinates.

### Arrive At Delivery

1. Robot pose telemetry updates the backend state.
2. The mission orchestrator checks distance to the delivery target.
3. If distance is within `MISSION_ARRIVAL_RADIUS_M`, the mission becomes `WAITING_FOR_DELIVERY_CONFIRMATION`.
4. The robot stays blocked in this state until a caregiver or admin confirms delivery.

### Confirm Delivery

1. A caregiver or admin confirms delivery from `/control`.
2. The backend stores `delivery_confirmed_by_user_id` and `delivery_confirmed_at`.
3. The mission becomes `COMPLETED`.
4. The robot remains at the delivery room.
5. The backend starts the next queued mission if one exists.

### Chained Missions

- Chained missions start from the robot's current position.
- The robot does not automatically return to base between missions.
- Return base remains an explicit admin action.

## Cancellation Rules

```text
PENDING
-> CANCELLED
-> no robot command

NAVIGATING_TO_STOCK
-> CANCELLED
-> cancel Nav2 and publish zero twist

WAITING_FOR_RECOVERY_CONFIRMATION
-> CANCELLED
-> no navigation is in progress; robot remains at stock

NAVIGATING_TO_DELIVERY
-> CANCELLED
-> cancel Nav2 and publish zero twist
-> supply may already be on the robot; admin intervention may be needed

WAITING_FOR_DELIVERY_CONFIRMATION
-> CANCELLED
-> robot remains at the delivery room; delivery is not confirmed

COMPLETED / CANCELLED / FAILED
-> not cancellable
```

Annulation does not mean return base.

## Emergency And Failure Rules

- Emergency stop remains available to caregivers and admins.
- Emergency reset remains admin-only.
- The mission orchestrator must not publish non-emergency navigation while `emergency_active=true`.
- If emergency stop occurs during an active navigation step, the MVP should move the active mission to `FAILED` with `failure_reason="emergency_stop"` unless the implementation can safely prove the mission is still waiting for human confirmation.
- After emergency reset, the backend may start the next `PENDING` mission only if there is no active non-terminal mission.
- No automatic mission resume after emergency in MVP.

## Backend Orchestration

The mission orchestrator is invoked by events:

- Mission created.
- Recovery confirmed.
- Delivery confirmed.
- Mission cancelled.
- Robot pose updated.
- Emergency reset completed.

The orchestrator does not run as a periodic background loop in MVP.

Core operations:

- `try_start_next_mission()`
- `handle_robot_pose_updated(pose)`
- `confirm_recovery(mission_id, actor)`
- `confirm_delivery(mission_id, actor)`
- `cancel_mission(mission_id, actor)`
- `fail_active_mission(reason)`

Concurrency rules:

- At most one mission can be in a non-terminal active status other than `PENDING`.
- Mission selection uses `created_at ASC`.
- State transitions should be guarded in the repository/use case layer to prevent double confirmations.

## Backend API

### Annotated Points

Admin write access:

```text
GET    /api/annotated-points
POST   /api/annotated-points
PATCH  /api/annotated-points/{point_id}
DELETE /api/annotated-points/{point_id}
```

Rules:

- `GET` can be caregiver/admin because `/control` needs active delivery rooms.
- `POST`, `PATCH`, `DELETE` are admin-only.
- `DELETE` should soft-deactivate.

### Stock Supplies

Admin write access:

```text
PUT /api/annotated-points/{point_id}/supplies
```

Rules:

- Only valid for `STOCK` points.
- Replaces active supply configuration for that stock point.

### Missions

Caregiver/admin access:

```text
GET  /api/missions
POST /api/missions
POST /api/missions/{mission_id}/confirm-recovery
POST /api/missions/{mission_id}/confirm-delivery
POST /api/missions/{mission_id}/cancel
```

Rules:

- Caregivers and admins can view all active missions.
- Caregivers and admins can confirm recovery and delivery for any active mission.
- The creator is stored for traceability but is not required for confirmation.
- Admin-only force/fix actions can be added later if needed.

### Robot Screen

Robot-screen token access:

```text
GET /api/robot-screen/status
```

Rules:

- Protected by `ROBOT_SCREEN_TOKEN`.
- Returns display-oriented data, not raw admin data.
- `/robot-screen` polls this endpoint every 2 seconds.
- SSE/WebSocket can be added later without changing the mission model.

Example response shape:

```json
{
  "robot_state": "MISSION_ACTIVE",
  "screen_title_fr": "En route vers le stock",
  "screen_message_fr": "CareBot va récupérer des gants.",
  "current_mission": {
    "id": "mis_...",
    "status": "NAVIGATING_TO_STOCK",
    "supply_label_fr": "Gants",
    "destination_label_fr": "Chambre 203"
  },
  "updated_at": "2026-06-19T12:00:00Z"
}
```

## Robot Screen French Labels

```text
PENDING -> Mission en attente
NAVIGATING_TO_STOCK -> En route vers le stock
WAITING_FOR_RECOVERY_CONFIRMATION -> En attente de récupération
NAVIGATING_TO_DELIVERY -> En route vers la chambre
WAITING_FOR_DELIVERY_CONFIRMATION -> En attente de confirmation
COMPLETED -> Livraison terminée
CANCELLED -> Mission annulée
FAILED -> Mission en échec
```

Idle display:

```text
CareBot
Prêt à aider l'équipe soignante
```

## Frontend Plan

### `/map`

- Add admin UI for annotated points.
- Allow point creation from map coordinates if map data is available.
- Allow editing name, type, pose and active state.
- Allow stock supply configuration for `STOCK` points.
- Keep existing mapping/admin behavior separate from mission operations.

### `/control`

- Replace the current free-coordinate navigation panel with mission controls.
- Show mission creation form with supply and delivery room.
- Show active mission and FIFO queue.
- Show recovery and delivery confirmation actions only in the matching states.
- Show cancellation action according to the mission state.
- Keep emergency stop visible.
- Show Foxglove visualization panel or fallback link/new-tab action.
- Do not expose free-coordinate navigation to caregivers in the operational flow.

### `/robot-screen`

- Fullscreen, simple, French-first display.
- Read-only.
- Stores robot-screen token locally after first use.
- Polls `/api/robot-screen/status` every 2 seconds.
- No command buttons.

### Existing Fake Mission Pages

- Remove or stop relying on local `robot-context` mission state.
- `/missions` can become a read-only mission history later.
- `/deliveries` can become delivery statistics later.
- These pages are not required for the first vertical slice if `/control` is complete.

## Persistence And Migration

Add SQLAlchemy models and Alembic migration for:

- `annotated_points`
- `stock_point_supplies`
- `missions`

Repository plan:

- Domain repository interfaces for annotated points and missions.
- SQLAlchemy implementations for production.
- In-memory implementations only if useful for fast unit tests.

Configuration additions:

- `MISSION_ARRIVAL_RADIUS_M`, default `0.60`.
- `ROBOT_SCREEN_TOKEN`, required when `/robot-screen` is enabled.
- Optional frontend env for Foxglove URL or robot rosbridge URL.

## Acceptance Criteria

- Admin can create a stock point, delivery room and robot base on `/map`.
- Admin can assign supported supplies to a stock point.
- Caregiver can create a mission from `/control` by choosing supply and delivery room.
- Backend persists the mission and selects the stock point automatically.
- If robot is free, backend immediately starts the mission and publishes navigation to stock.
- Backend detects stock arrival by pose proximity.
- `/control` shows recovery confirmation only after stock arrival.
- Confirming recovery publishes navigation to the delivery room.
- Backend detects delivery arrival by pose proximity.
- `/control` shows delivery confirmation only after delivery arrival.
- Confirming delivery completes the mission.
- If another mission is queued, backend starts it automatically.
- `/robot-screen` shows French mission state labels and idle CareBot identity.
- Foxglove is visible or openable, but mission flow works without it.
- Free-coordinate navigation is not part of caregiver `/control`.

## Test Plan

- Unit-test mission state transitions.
- Unit-test stock selection by supply and `priority_order`.
- Unit-test FIFO mission selection.
- Unit-test arrival detection radius.
- Unit-test cancellation rules for each mission status.
- Unit-test confirmation permissions and invalid-state rejection.
- Integration-test mission creation through completion using repositories and mocked robot command publisher.
- API-test caregiver/admin permissions for annotated points, missions and robot-screen access.
- Frontend-test critical `/control` states if existing test setup supports it.

## Implementation Order

1. Add domain entities, repository interfaces and DTOs for annotated points and missions.
2. Add SQLAlchemy models and Alembic migration.
3. Add SQLAlchemy repositories.
4. Add mission orchestrator use cases and tests.
5. Wire mission orchestration into robot pose telemetry updates.
6. Add annotated point and mission API endpoints.
7. Add robot-screen status endpoint and token dependency.
8. Add frontend API client functions and types.
9. Update `/map` for annotated point and stock configuration.
10. Replace `/control` with mission-first UI and Foxglove fallback panel.
11. Add `/robot-screen` fullscreen display.
12. Remove or neutralize fake local mission state from `robot-context` consumers.

## Deferred Work

- Automated recovery scan.
- Priority or proximity-based scheduling.
- Admin stock override.
- SSE/WebSocket status streaming.
- Analytics and delivery performance reporting.
- Automatic return base after delivery.
- Mission resume after emergency or backend restart.
- Foxglove command integration.
