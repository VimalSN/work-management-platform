# Phase 1 backend concepts: request/response flow

Companion to the chat explanation of Prisma, Postgres, CORS, and Redis. This
diagram traces one real request — the frontend's health check — end to end
through our actual code.

```mermaid
sequenceDiagram
    participant Browser as Browser (App.tsx)
    participant Express as Express (index.ts)
    participant Prisma as Prisma Client
    participant PG as Postgres
    participant Redis as ioredis client
    participant RD as Redis

    Browser->>Express: GET http://localhost:4000/health
    Note over Express: cors() middleware attaches<br/>Access-Control-Allow-Origin header
    Express->>Prisma: $queryRaw`SELECT 1`
    Prisma->>PG: query over TCP :5432
    PG-->>Prisma: result / connection error
    Prisma-->>Express: resolves or throws (caught)
    Express->>Redis: redis.ping()
    Redis->>RD: PING over TCP :6379
    RD-->>Redis: PONG / connection error
    Redis-->>Express: resolves or throws (caught)
    Note over Express: status = { server, database, redis }<br/>200 if all ok, else 503
    Express-->>Browser: JSON body + CORS header
    Note over Browser: axios resolves (2xx) or<br/>rejects into .catch (non-2xx)<br/>— we read err.response.data either way
    Browser->>Browser: setHealth(...) → React re-renders
```

## Why CORS only matters for the browser leg

`curl http://localhost:4000/health` works with no CORS setup at all, because
CORS is a rule browsers enforce on JavaScript, not a rule servers enforce on
callers in general. The `cors()` middleware exists purely because step 1
above is initiated by a browser running our frontend's JS on a different
origin (`:5173`/`:5174` vs `:4000`).

## Why both dependency checks are independent try/catch blocks

Postgres and Redis are unrelated systems. If Postgres is down but Redis is
fine, we still want an accurate `{ database: "error", redis: "ok" }` — not a
crash that tells us nothing. Each check fails in isolation on purpose.
