# EHPAD CareBot — Robotics Control Platform

## Overview

A professional healthcare dashboard for controlling an autonomous assistance robot in nursing homes (EHPAD). The platform helps caregivers manage medical equipment deliveries and meal distribution to residents.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + Shadcn/UI
- **State**: React Query + custom simulation hooks

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (robot status, missions)
│   └── ehpad-robot/        # React frontend (main UI at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Frontend Pages

- **Dashboard** (`/`) — Robot status cards, activity feed, quick actions, system health
- **Robot Control** (`/robot-control`) — Directional joystick, emergency stop, camera feed, telemetry
- **Missions** (`/missions`) — Mission table with status badges, create new mission modal
- **Live Map** (`/live-map`) — SVG floor plan with animated robot position
- **Deliveries** (`/deliveries`) — Delivery history and stats
- **Meal Distribution** (`/meal-distribution`) — Meal schedule by room/floor
- **System Status** (`/system-status`) — Connection indicators for ROS2, MQTT, WebSocket, Robot, DB
- **Settings** (`/settings`) — Robot config, notifications, display preferences

## Key Features

- Simulated real-time robot data (battery, position, status, speed)
- WebSocket / MQTT connection status indicators
- Dark / Light mode toggle
- Mission management (create, cancel, track)
- Toast notifications for alerts
- Fully responsive layout

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/robot/status` — Robot telemetry (simulated)
- `GET /api/missions` — List all missions
- `POST /api/missions` — Create a new mission
- `PATCH /api/missions/:id` — Update mission status

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- `pnpm run typecheck` — canonical full typecheck
- `pnpm run build` — runs typecheck + all package builds

## Packages

### `artifacts/ehpad-robot` (`@workspace/ehpad-robot`)

React + Vite frontend. Served at `/`. Uses:
- Shadcn/UI components
- lucide-react icons
- date-fns for timestamps
- framer-motion for animations
- react-hook-form + @hookform/resolvers for forms
- Custom hooks: `use-simulation.tsx`, `use-theme.tsx`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API. Routes: health, robot, missions. In-memory mock data (no DB needed for current MVP).

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Schema is currently empty (missions use in-memory state).
