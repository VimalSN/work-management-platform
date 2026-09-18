import IORedis from 'ioredis';

// BullMQ needs its OWN Redis connection, separate from the app's `redis`
// client in src/redis.ts. That client deliberately sets maxRetriesPerRequest
// to 1 so a Redis outage fails fast for best-effort uses (the idempotency
// check). BullMQ does the opposite on purpose: it issues long-lived blocking
// commands as part of how it waits for new jobs, and requires
// maxRetriesPerRequest: null so those commands aren't torn down mid-wait -
// it manages its own retry/backoff internally instead.
export const queueConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Same reasoning as src/redis.ts: without a listener, ioredis rethrows
// connection errors as uncaught exceptions and crashes the process. BullMQ
// itself handles Redis being unreachable by retrying the connection
// indefinitely in the background - this just stops that from also
// crashing the whole API server.
queueConnection.on('error', () => {});
