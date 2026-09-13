import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: () => 1000,
});

// Without a listener, ioredis rethrows connection errors as uncaught exceptions
// and crashes the process. The /health endpoint already reports redis status.
redis.on('error', () => {});
