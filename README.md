# Meridian

A multi-tenant, dependency-aware engineering task and project management platform,
built phase by phase with a focus on real system-design patterns: multi-tenancy,
dependency-graph cycle detection, optimistic concurrency, and real-time collaboration.

(The repo/clone URL below still uses its original name, "work-management-platform" -
only the product name shown in the app itself changed to Meridian.)

## Stack

- Frontend: React + TypeScript + Vite, Tailwind CSS, React Query, Axios
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL via Prisma
- Cache/queue: Redis
- Real-time: Socket.IO
- Testing: Jest + Supertest (unit tests for pure logic, integration tests
  against a real Postgres/Redis)
- CI: GitHub Actions (runs the full test suite against real Postgres/Redis
  service containers, plus builds both Docker images, on every push)
- Infra: Docker Compose locally; a single-instance Docker Compose deploy on
  AWS EC2 (see [DEPLOY.md](DEPLOY.md))

## Local setup

Requires Node.js (LTS) and Docker Desktop.

```bash
git clone https://github.com/VimalSN/work-management-platform.git
cd work-management-platform

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# then edit backend/.env and set JWT_ACCESS_SECRET to your own random value
# (see the comment above it in .env.example for how to generate one)

docker compose up -d      # starts Postgres + Redis

cd backend && npm install && npm run migrate && npm run dev
cd frontend && npm install && npm run dev
```

Backend runs on http://localhost:4000, frontend on http://localhost:5173.
The frontend shows a login/register screen; registering creates a new
organization with you as its Admin. Once signed in, a live health check of
the server, database, and Redis is shown alongside your account info.

## Project status

Building in phases; see commit history for progress. Current phase: **Phase 8 —
tests, Docker, CI, one-time cloud deploy** (entirely behind-the-scenes; Phase 7
was the last phase to add a user-facing feature). See
[docs/phase-7-workload-notifications.md](docs/phase-7-workload-notifications.md)
for the design writeup, and the other `docs/phase-*.md` files for earlier
phases.

## Tests

```bash
cd backend
npm test
```

Runs both kinds together: pure unit tests (the cycle-detection algorithm,
JWT signing/verification - no database needed) and integration tests
(auth flows, optimistic concurrency, cycle detection, idempotency - hitting
a real Postgres + Redis via `DATABASE_URL`/`REDIS_URL`, same as the app
itself uses).

To run the integration tests locally (not required just to develop - only
if you want to run the full suite yourself rather than relying on CI),
first create a separate test database so `npm test` never touches your own
dev data:

```bash
docker compose up -d
docker compose exec postgres createdb -U postgres workmgmt_test
```

In CI, GitHub Actions provides its own throwaway Postgres/Redis
automatically instead (see `.github/workflows/ci.yml`) - that's what
actually runs on every push, independent of any single developer's machine
having Docker set up at all.

## Deploying

See [DEPLOY.md](DEPLOY.md) for a one-time deploy of the full stack (Docker
Compose - Postgres, Redis, backend, frontend) to a single AWS EC2 instance.

## UI

Phases 1-7 kept the frontend deliberately functional-only. With all
user-facing features complete, a dedicated design pass followed: a shared
component library (Button/Input/Select/Badge/Card/RowMenu), a brand
color theme, icons throughout (lucide-react), toast notifications and a
custom confirm dialog (replacing native alert/confirm), a drag-and-drop
Kanban board for tasks (@dnd-kit), a dashboard landing page, and a
responsive layout (hamburger + slide-out menu below the `md` breakpoint).

## Future work (explicitly out of scope for now)

Full recommendation/ML engine, complete audit logging, load testing suite,
microservice split, full observability stack, fully automated multi-environment
CI/CD.
