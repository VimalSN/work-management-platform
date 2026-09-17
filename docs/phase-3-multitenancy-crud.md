# Phase 3: Multi-Tenant Data Model & Core CRUD

## The core rule: `organizationId` comes from the token, never from the client

Every single query in [routes/projects.ts](../backend/src/routes/projects.ts) and [routes/tasks.ts](../backend/src/routes/tasks.ts) filters by `req.user!.organizationId` — a value that comes from the **verified JWT** ([middleware/auth.ts](../backend/src/middleware/auth.ts)'s `authenticate`), never from a URL param, query string, or request body. A client can put anything it wants in a URL — `GET /projects/some-other-orgs-project-id` — but `organizationId` in the `where` clause is not something it can influence at all. This single rule is the entire defense against IDOR (Insecure Direct Object Reference): the attack where a user tampers with an ID in a request to reach data they shouldn't see.

## Why a mismatched org ID returns 404, not 403

Look at [routes/projects.ts](../backend/src/routes/projects.ts):
```ts
const project = await prisma.project.findFirst({
  where: { id: String(req.params.id), organizationId: req.user!.organizationId },
});
if (!project) {
  res.status(404).json({ error: 'Project not found' });
  return;
}
```

`id` and `organizationId` are checked **in the same query**. If a project with that ID exists but belongs to a different organization, this query still returns nothing — indistinguishable, from the outside, from the ID simply not existing at all. That's deliberate: a `403 Forbidden` would leak information ("yes, this ID is real, you're just not allowed to see it"), which is itself a small but real vulnerability — it lets an attacker enumerate which IDs exist across the whole system, org boundaries or not, just by watching for `403` vs `404`. Returning `404` in both cases (truly doesn't exist / exists in someone else's org) leaks nothing.

This is the direct answer to the Phase 3 checkpoint question (*"how would you prevent a user in Organization A from ever accessing Organization B's data, even if they tamper with a request ID?"*): scope every query by a server-derived tenant ID, and make "not yours" and "doesn't exist" look identical from the outside.

## Two different layers of authorization, not one

Phase 2 introduced `authorize(...roles)` — route-level RBAC, checked *before* any data is even loaded: "is this role ever allowed to hit this endpoint at all?" `router.post('/', authorize(Role.ADMIN, Role.MANAGER), ...)` on project creation is exactly that.

Phase 3 adds a second, different kind of check inside [routes/tasks.ts](../backend/src/routes/tasks.ts)'s `PATCH /tasks/:id`:
```ts
const isManager = role === Role.ADMIN || role === Role.MANAGER;
const isOwnTask = role === Role.DEVELOPER && task.assigneeId === userId;
if (!isManager && !isOwnTask) {
  res.status(403).json({ error: 'You can only update tasks assigned to you' });
  return;
}
```
This can't be a route-level middleware, because the answer depends on the **specific resource** — whether *this* task happens to be assigned to *this* user — which is only knowable after the task has already been loaded from the database. Role-based RBAC answers "what can a Developer ever do"; this resource-level ownership check answers "can *this* Developer do it *to this specific row*." Most real systems need both, and they live in different places in the code for exactly this reason.

## Why these specific columns are indexed

```prisma
@@index([organizationId])
@@index([projectId])
@@index([assigneeId])
@@index([status])
```

An index lets Postgres jump straight to matching rows instead of scanning the whole table. The rule of thumb: **index the columns that appear in `WHERE` clauses of your most frequent queries** — not every column, since each index also costs write performance and storage. Looking at what this app actually queries:

- Nearly *every* query filters by `organizationId` (the multi-tenancy rule above) — without an index here, every request would force a full table scan across *all* organizations' data just to find one org's rows, on every single API call.
- Listing a project's tasks filters by `projectId`.
- The Phase 7 workload view will filter by `assigneeId` ("what's assigned to this person").
- A Kanban-style board filters by `status` ("show me everything in `IN_PROGRESS`").

Columns that *aren't* indexed here — `title`, `description` — aren't filtered on in any query we have, so an index there would only cost write overhead for no read benefit.

## Project deletion is deliberately not a cascade

```ts
if (existing._count.tasks > 0) {
  res.status(409).json({ error: 'Cannot delete a project that still has tasks' });
  return;
}
```

Postgres *could* be configured to auto-delete every task when its parent project is deleted (`ON DELETE CASCADE`). We didn't do that — deliberately. A silent cascading delete of potentially many tasks is exactly the kind of surprising, hard-to-reverse action worth avoiding; requiring the tasks to be dealt with first (reassigned or deleted explicitly) makes data loss a conscious choice, not a side effect of deleting something else.
