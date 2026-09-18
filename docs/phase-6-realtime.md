# Phase 6: Real-Time Collaboration & Responsiveness

## WebSockets vs. polling

**Polling** means the client repeatedly asks "anything new?" on a timer (every few seconds), whether or not anything actually changed. Simple, but wasteful — most polls come back empty, and there's an unavoidable delay between something happening and the client finding out (up to one full poll interval). **Long-polling** is a variant where the server holds the request open until something happens (or a timeout), reducing empty responses but still re-opening a new HTTP request-response cycle every time.

A **WebSocket** is a single persistent, bidirectional connection, established once (via an HTTP "upgrade" handshake) and then kept open. Either side can send a message at any moment with no request/response ceremony — the server can push "this task changed" the instant it happens, with no polling delay and no wasted empty-check requests. The cost is holding one open connection per client for as long as they're around, versus the stateless, connection-per-request model plain HTTP normally uses. For a feature that's fundamentally about "notify me the moment something changes," that tradeoff is the right one — the brief's choice of Socket.IO (a WebSocket library with automatic fallbacks and reconnection built in) fits this exactly.

## Rooms: why not just broadcast to everyone

[backend/src/realtime.ts](../backend/src/realtime.ts) scopes every event to `project:${projectId}`, a Socket.IO "room" — a named group of connected sockets:

```ts
export function emitToProject(projectId: string, event: string, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
}
```

A client only joins a project's room when actually viewing that project ([frontend/src/pages/ProjectDetailPage.tsx](../frontend/src/pages/ProjectDetailPage.tsx)'s `join-project` emit on mount), and leaves when navigating away. If we broadcast globally instead, every connected client — regardless of what they're looking at — would receive every event happening anywhere in the platform, forcing every browser tab to filter out the vast majority of irrelevant noise itself. Rooms move that filtering to the server, where it's one `io.to(room)` call instead of thousands of clients each independently discarding messages they didn't need. It also keeps the client-side code simpler: a component only ever hears about the one project it's rendering.

**Room membership doubles as multi-tenancy enforcement, not just an efficiency trick** — the same principle from Phase 3, applied to sockets:

```ts
socket.on('join-project', async (projectId: unknown) => {
  if (typeof projectId !== 'string') return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
  });
  if (!project) return; // silently ignore
  socket.join(`project:${projectId}`);
});
```

Without this check, "rooms" would only be a broadcast-efficiency mechanism — a socket could join *any* room name it liked, including another organization's project, and start receiving that org's live task/comment data. The `organizationId` filter here is exactly as load-bearing as it is in every REST route.

## Authentication: once at handshake, not per-message

An HTTP request carries its own `Authorization` header every time — a WebSocket connection is established once and then just... exists. [backend/src/realtime.ts](../backend/src/realtime.ts) verifies the JWT once, during the connection handshake:

```ts
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // ...verify, attach socket.data.user, next() or reject
});
```

This project deliberately doesn't re-verify the token on every subsequent message — a reasonable simplification given how short-lived access tokens already are (15 minutes) and that reconnects (which do re-run this handshake) happen automatically and often. [frontend/src/socket/SocketContext.tsx](../frontend/src/socket/SocketContext.tsx) passes `auth` as a **function**, not a fixed object, specifically so a reconnect years... well, minutes later picks up whatever the *current* access token is at that moment, rather than the one that was live when the socket first opened:

```ts
const newSocket = io(API_URL, {
  auth: (cb) => cb({ token: getAccessToken() }),
});
```

## Disconnect and reconnect: what happens, and the "missed events" problem

Socket.IO's client reconnects automatically after a dropped connection, with backoff. But **a reconnect is a brand-new connection as far as the server is concerned** — room membership isn't remembered across the gap, and the client may have missed any events broadcast while it was offline. Two things handle this, both in [ProjectDetailPage.tsx](../frontend/src/pages/ProjectDetailPage.tsx):

```ts
function join() {
  socket!.emit('join-project', id);
}
join();                    // on mount
socket.on('connect', join); // 'connect' fires again on every reconnect
```

Rejoining the room on every `connect` (not just once on mount) is what makes events start flowing again after a reconnect. As for events that were missed *while disconnected* — this project doesn't try to replay or queue them server-side (a much heavier feature: tracking a "since when" cursor per client, storing an event log, etc.). Instead, the React Query cache the socket events invalidate is the same cache the initial page load populated from the REST API — so **any REST refetch already reflects the true current state**, missed events or not. A reconnect doesn't need to know what it missed; it just needs to ask "what's true right now," which the existing `GET /projects/:id/tasks` call already answers correctly. The socket is a live nudge on top of a REST API that's still the actual source of truth, not a replacement for it.

## Responsiveness: debouncing and optimistic UI

**Debounce.** A burst of task events landing within milliseconds of each other (e.g. someone bulk-editing several tasks) would otherwise trigger one cache invalidation - and one refetch - per event:

```ts
const refetchTasks = debounce(() => {
  queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
}, 300);
socket.on('task:created', refetchTasks);
socket.on('task:updated', refetchTasks);
socket.on('task:deleted', refetchTasks);
```
[frontend/src/lib/debounce.ts](../frontend/src/lib/debounce.ts) collapses a burst into a single refetch, fired once things settle for 300ms — not one round-trip per event.

**Optimistic UI.** Changing a task's status previously waited for the server's response before updating anything on screen. Now the change is applied to the local cache the instant the dropdown fires, and only rolled back if the server actually rejects it:

```ts
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: ['projects', id, 'tasks'] });
  const previousTasks = queryClient.getQueryData<Task[]>(['projects', id, 'tasks']);
  queryClient.setQueryData<Task[]>(['projects', id, 'tasks'], (old) =>
    old?.map((t) => (t.id === vars.taskId ? { ...t, ...vars.data } : t)),
  );
  return { previousTasks };
},
onError: (err, _vars, context) => {
  if (context?.previousTasks) {
    queryClient.setQueryData(['projects', id, 'tasks'], context.previousTasks);
  }
  // ...409 handling as before
},
```
This is the same "assume success, reconcile after" idea behind optimistic concurrency from Phase 5, applied to the UI layer instead of the database: most updates succeed, so the snappy feeling of an instant update is worth occasionally having to visibly snap back when one doesn't.

## Checkpoint

*WebSockets vs. polling; disconnect/reconnect; why rooms* — see the three sections above.
