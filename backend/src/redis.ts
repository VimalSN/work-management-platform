import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: () => 1000,
  // Default is 20 - meaning a command issued while disconnected can sit
  // queued for many seconds before finally rejecting. Callers that treat
  // Redis as best-effort (idempotency checks, caching) need a command to
  // fail fast so "fall back to normal behavior" is actually fast, not a
  // multi-second stall on top of whatever the fallback does anyway.
  maxRetriesPerRequest: 1,
});

// Without a listener, ioredis rethrows connection errors as uncaught exceptions
// and crashes the process. The /health endpoint already reports redis status.
redis.on('error', () => {});
