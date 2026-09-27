// Run this against your LIVE local server (docker compose up + npm run dev)
// - it needs a running Redis AND a running worker process to actually drain
// the jobs this script enqueues. This script only PRODUCES jobs and then
// watches Redis for completion events; the dev server you already have
// running (`npm run dev`) is what's CONSUMING them via startNotificationsWorker().
//
// Usage:
//   npx ts-node scripts/benchmark-queue.ts <jobCount> <email> <password>

import 'dotenv/config';
import { QueueEvents } from 'bullmq';
import { performance } from 'node:perf_hooks';
import { enqueueNotification } from '../src/queue/notifications';
import { queueConnection } from '../src/queue/connection';

const API_URL = process.env.BENCHMARK_API_URL || 'http://localhost:4000';

async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ accessToken: string; user: { id: string; organizationId: string } }>;
}

async function main() {
  const jobCount = Number(process.argv[2] ?? 200);
  const email = process.argv[3];
  const password = process.argv[4];
  if (!email || !password) {
    throw new Error('Usage: ts-node scripts/benchmark-queue.ts <jobCount> <email> <password>');
  }

  const { user } = await login(email, password);

  // A separate connection from the one the API's own worker uses - QueueEvents
  // listens on Redis pub/sub independently of who happens to be processing jobs.
  const events = new QueueEvents('notifications', { connection: queueConnection.duplicate() });
  await events.waitUntilReady();

  let completed = 0;
  const start = performance.now();
  const allDone = new Promise<void>((resolve) => {
    events.on('completed', () => {
      completed++;
      if (completed >= jobCount) resolve();
    });
  });

  for (let i = 0; i < jobCount; i++) {
    await enqueueNotification({
      userId: user.id,
      organizationId: user.organizationId,
      type: 'TASK_ASSIGNED',
      message: `Benchmark notification #${i}`,
    });
  }
  const enqueuedAt = performance.now();
  console.log(`Enqueued ${jobCount} jobs in ${(enqueuedAt - start).toFixed(1)}ms - waiting for the worker to drain them...`);

  await allDone;
  const drainedAt = performance.now();

  console.log(`\nAll ${jobCount} jobs processed by the running worker.`);
  console.log(`  total wall time (enqueue -> last job completed): ${(drainedAt - start).toFixed(1)}ms`);
  console.log(`  effective throughput: ${(jobCount / ((drainedAt - start) / 1000)).toFixed(1)} jobs/sec`);

  await events.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
