# Phase 4: Dependency Tracking & Circular Dependency Detection

## Modeling tasks as a graph

Every task is a **node**. Every declared dependency is a **directed edge**. `BLOCKS` is the interesting edge type: if task A blocks task B, that's an edge `A -> B` meaning "B cannot be considered done until A is." A **cycle** in this graph — A blocks B blocks C blocks A — is a genuine contradiction: nothing in the cycle can ever be unblocked, because everything in it is waiting on something else in the same loop. That's what this phase's validation exists to prevent.

`RELATES_TO` and `DUPLICATES` are stored the same way (a row with a source and target task) but are **not** checked for cycles — a cycle in "relates to" (three tickets all referencing each other) is completely normal and means nothing is broken.

## Four API types, three stored types

The brief lists four relationship types a user can declare: `BLOCKS`, `BLOCKED_BY`, `RELATES_TO`, `DUPLICATES`. But `BLOCKS` and `BLOCKED_BY` describe **the same fact from opposite ends** — "A blocks B" and "B is blocked by A" are one edge, not two. Storing both directions as separate rows would let them silently drift apart (e.g., someone deletes one but not its "mirror").

So [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) only has **three** `DependencyType` values (`BLOCKS`, `RELATES_TO`, `DUPLICATES`), and [backend/src/routes/tasks.ts](../backend/src/routes/tasks.ts)'s `POST /tasks/:id/dependencies` translates a `BLOCKED_BY` request into a `BLOCKS` row with the source/target swapped, before it's ever written:

```ts
const storedType = type === 'BLOCKED_BY' ? 'BLOCKS' : type;
const sourceTaskId = type === 'BLOCKED_BY' ? relatedTaskId : taskId;
const targetTaskId = type === 'BLOCKED_BY' ? taskId : relatedTaskId;
```

On the way back out, `GET /tasks/:id/dependencies` does the reverse translation — querying the same `BLOCKS` rows from both directions (`taskId = this task` → "Blocks"; `relatedTaskId = this task` → "Blocked by") to reconstruct both human-facing labels from the one stored direction. This pattern — accepting a richer set of options at the API boundary than you actually store — is common in real systems (Jira's issue links work exactly this way) and avoids a whole class of data-integrity bugs that come from redundant, easily-desynced storage.

## The cycle-detection algorithm

[backend/src/lib/graph.ts](../backend/src/lib/graph.ts) is a standalone function with no dependency on Express, Prisma, or anything else — deliberately, so it can be reasoned about (and tested) as pure graph theory:

```ts
export function hasCycle(edges: Edge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(to);
    if (!adjacency.has(to)) adjacency.set(to, []);
  }

  const color = new Map<string, number>(); // 0=white, 1=gray, 2=black

  function visit(node: string): boolean {
    color.set(node, 1); // gray: on the current recursion stack
    for (const neighbor of adjacency.get(node) ?? []) {
      const c = color.get(neighbor) ?? 0;
      if (c === 1) return true;                       // back edge -> cycle
      if (c === 0 && visit(neighbor)) return true;
    }
    color.set(node, 2); // black: fully explored, no cycle through here
    return false;
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? 0) === 0 && visit(node)) return true;
  }
  return false;
}
```

**Why three colors, not just visited/unvisited:** a plain "have I seen this node before" check would incorrectly flag diamonds as cycles — e.g. `A -> B -> D` and `A -> C -> D` both reach `D`, which is fine (D has two paths in, not a loop). The distinction that actually matters is between a node that's **done and safe** (black — every path through it has already been checked) and a node that's **still an ancestor of the node currently being explored** (gray — reaching it again means we've walked back into our own call stack, which is exactly what a cycle is). Reaching a black node again is completely normal; reaching a gray node again is the cycle.

**Complexity: O(V+E).** Each node changes color white→gray→black exactly once — the `visit` function is only ever called on a white node, checked via the color map, so no node is fully processed twice. Each edge is examined exactly once, from whichever node it starts at, inside that node's single `visit` call. So the total work is bounded by the number of nodes plus the number of edges, not by anything worse (there's no repeated re-scanning of the same edges).

I verified it directly against six hand-built graphs (a simple 3-cycle, a self-loop, a linear DAG, a diamond shape, a disconnected graph with one cyclic component, and an empty graph) before it was ever wired into a route — all six matched the expected true/false result.

## Using it: "would adding this edge create a cycle?"

The route doesn't re-run cycle detection on the *entire historical graph* for no reason — it specifically asks the practical question: **if I add this one proposed edge, does a cycle appear?**

```ts
const existingBlocksEdges = await prisma.taskDependency.findMany({
  where: { organizationId, type: 'BLOCKS' },
  select: { taskId: true, relatedTaskId: true },
});
const candidateEdges = [
  ...existingBlocksEdges.map((e) => ({ from: e.taskId, to: e.relatedTaskId })),
  { from: sourceTaskId, to: targetTaskId }, // the one being proposed
];
if (hasCycle(candidateEdges)) {
  res.status(409).json({ error: 'This would create a circular dependency' });
  return;
}
```

Fetching "all `BLOCKS` edges in this org" rather than "all `BLOCKS` edges everywhere" is the multi-tenancy rule from Phase 3 doing double duty here — it's also a performance bound: the graph being checked is only ever as large as one organization's dependency data, never the whole platform's.

## System design: compute vs. cache "is this task blocked?"

The brief asks when to compute this versus cache it. For this project's scale, computing it live is the right call, not premature optimization avoided for its own sake: "is task X blocked" is a single indexed query — `TaskDependency` rows where `relatedTaskId = X`, `type = BLOCKS`, joined to check whether the blocking task's `status` is not yet `DONE` — bounded by however many direct blockers one task has (typically small), not by the size of the whole graph. A cache would need active invalidation every time any task's status changes (since that could unblock everything downstream of it), which is real complexity to take on for a query that's already cheap. Caching would earn its cost only if this became a hot path at a scale where even that indexed lookup showed up in profiling — worth naming as a real future option, not worth building speculatively now.

## Checkpoint

*Write the cycle-detection function from a blank page, state its time complexity.* — see `hasCycle` above; **O(V+E)**, for the reasons in the complexity section.
