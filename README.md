# Shift Scheduler

A weekly shift-scheduling tool for cafes and restaurants. Managers define branches and shift templates, keep track of employees and their availability, and build each week's schedule by dragging people onto shift slots — or letting the app fill the gaps.

> **Status:** work in progress. Phase 1 (the core loop) is nearly complete; see [Roadmap](#roadmap).

## Features

- **Manager-only auth** — short-lived JWT access tokens plus a rotating, httpOnly refresh-token cookie (refresh tokens are stored hashed). Employees are plain data objects and never log in.
- **Multi-branch** — each branch defines its own shift templates (hours, required head count, opening/closing flags), and a manager only sees the branches they are assigned to.
- **Employee management** — employment type (full-time / part-time / minijob), start date, experience score, key-holder flag, target shifts per week, and branch assignment.
- **Availability** — recurring rules plus week-specific overrides, entered by the manager on the employee's behalf.
- **Weekly schedule grid** — days across, shift slots down; assign by dragging an employee from the roster onto a slot, lock slots, unassign, and see actual vs. target shifts per employee.
- **Auto-fill** — "fill empty slots", "randomize all", and "clear all". Locked slots are never touched.

## Tech stack

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces (`apps/web`, `apps/api`, `packages/shared-types`) |
| Frontend | React, TypeScript, Vite, TanStack Query, React Router, dnd-kit |
| Styling | Tailwind CSS via CSS Modules (`@apply`) |
| Backend | NestJS (modular, one module per domain), SWC builder |
| Database | PostgreSQL with Prisma |
| Tests | Jest unit tests + Jest/Supertest e2e tests against a real database |

The full product and technical specification lives in [`docs/spec.md`](docs/spec.md).

## Getting started

**Prerequisites:** Node.js 20+, pnpm, and a PostgreSQL database (a free [Neon](https://neon.tech) project works well).

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Configure environment variables
cp apps/api/.env.example apps/api/.env   # then fill in DATABASE_URL and the JWT secrets
cp apps/web/.env.example apps/web/.env

# 3. Create the database schema
pnpm --filter api prisma migrate deploy

# 4. Seed a demo manager, a demo branch with staff, and an empty second branch
pnpm --filter api seed

# 5. Run the API (http://localhost:3000) and the web app (http://localhost:5173)
pnpm dev:api
pnpm dev:web
```

Sign in with the seeded manager credentials from `apps/api/.env` (`SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD`). Generate strong JWT secrets with `openssl rand -hex 48`, and change the seed password if you ever deploy this.

### Tests

```bash
pnpm --filter api test        # unit tests
pnpm --filter api test:e2e    # e2e tests — need DATABASE_URL and the seeded manager
```

## Project structure

```
apps/
  api/                 NestJS backend
    prisma/            schema and migrations
    src/
      auth/  branch/  shift-template/  employee/  availability/  schedule/
      scheduling-engine/   pure, independently testable assignment logic
  web/                 React frontend
packages/
  shared-types/        types shared between frontend and backend
docs/
  spec.md              product and technical specification
```

## Roadmap

**Phase 1 — core loop (MVP)**
- [x] Manager auth (JWT + refresh cookie)
- [x] Branch and shift-template CRUD
- [x] Employee CRUD with branch assignment
- [x] Availability entry (API)
- [x] Target vs. actual shifts per week
- [x] Manual schedule grid with drag-and-drop
- [x] Simple auto-fill (availability only)
- [ ] Availability entry screen in the web app

**Phase 2 — business rules:** seniority pairing, key-holder requirements and hand-over warnings, one-shift-per-day and night→morning rest rules, understaffed detection with alternative suggestions, and a full auto-assign engine.

**Phase 3 — polish:** a CP-SAT (OR-Tools) comparison, email notifications, PWA, read-only employee accounts, CI, and visual polish.

Screenshots will be added soon.
