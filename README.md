# Work Management Platform

A multi-tenant, dependency-aware engineering task and project management platform,
built phase by phase with a focus on real system-design patterns: multi-tenancy,
dependency-graph cycle detection, optimistic concurrency, and real-time collaboration.

## Stack

- Frontend: React + TypeScript + Vite, Tailwind CSS, React Query, Axios
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL via Prisma
- Cache/queue: Redis
- Real-time: Socket.IO
- Local infra: Docker Compose

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

Building in phases; see commit history for progress. Current phase: **Phase 3 —
multi-tenant data model & core CRUD** (Projects and Tasks, every query scoped
by organization server-side, role- and ownership-based authorization). See
[docs/phase-3-multitenancy-crud.md](docs/phase-3-multitenancy-crud.md) for the
design writeup, and [docs/phase-2-auth-rbac.md](docs/phase-2-auth-rbac.md) for
Phase 2's.

## UI approach

The frontend stays functional-only (plain Tailwind utility classes, no design
system) through the core phases - each phase builds just enough UI to
exercise its backend feature in a browser. A dedicated visual/UX polish pass
is planned once all features exist, rather than spread across every phase.

## Future work (explicitly out of scope for now)

Full recommendation/ML engine, complete audit logging, load testing suite,
microservice split, full observability stack, fully automated multi-environment
CI/CD.
