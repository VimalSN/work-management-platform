// Run this against your LIVE local server (docker compose up + npm run dev),
// not on the office laptop - it needs the real DB/Redis behind the API.
//
// Usage:
//   npx ts-node scripts/benchmark-load.ts health [count] [concurrency]
//   npx ts-node scripts/benchmark-load.ts concurrent-auth <email> <password> [count] [concurrency]
//   npx ts-node scripts/benchmark-load.ts idempotency <email> <password>
//
// email/password must be an existing account (e.g. one you registered
// through the UI) with ADMIN or MANAGER role for the idempotency mode,
// since it POSTs to /projects.

import 'dotenv/config';
import { performance } from 'node:perf_hooks';

const API_URL = process.env.BENCHMARK_API_URL || 'http://localhost:4000';

type Timing = { status: number; ms: number };

async function timedFetch(url: string, init?: RequestInit): Promise<Timing> {
  const start = performance.now();
  const res = await fetch(url, init);
  await res.text();
  return { status: res.status, ms: performance.now() - start };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function summarize(label: string, timings: Timing[]) {
  const ms = timings.map((t) => t.ms).sort((a, b) => a - b);
  const failed = timings.filter((t) => t.status >= 400).length;
  console.log(`\n${label}`);
  console.log(`  requests: ${timings.length}  failed: ${failed}`);
  console.log(
    `  min: ${ms[0].toFixed(2)}ms  p50: ${percentile(ms, 50).toFixed(2)}ms  ` +
      `p95: ${percentile(ms, 95).toFixed(2)}ms  max: ${ms[ms.length - 1].toFixed(2)}ms`,
  );
}

async function runConcurrent(count: number, concurrency: number, makeRequest: () => Promise<Timing>) {
  const results: Timing[] = [];
  let next = 0;
  const start = performance.now();

  async function worker() {
    while (next < count) {
      next++;
      results.push(await makeRequest());
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  const totalMs = performance.now() - start;
  console.log(`  wall time: ${totalMs.toFixed(1)}ms  throughput: ${(count / (totalMs / 1000)).toFixed(1)} req/sec`);
  return results;
}

async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ accessToken: string }>;
}

async function healthMode(count: number, concurrency: number) {
  console.log(`GET /health - ${count} requests, concurrency ${concurrency}`);
  const results = await runConcurrent(count, concurrency, () => timedFetch(`${API_URL}/health`));
  summarize('GET /health', results);
}

async function concurrentAuthMode(email: string, password: string, count: number, concurrency: number) {
  const { accessToken } = await login(email, password);
  console.log(`GET /projects (authenticated) - ${count} requests, concurrency ${concurrency}`);
  const results = await runConcurrent(count, concurrency, () =>
    timedFetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  );
  summarize('GET /projects', results);
}

async function idempotencyMode(email: string, password: string) {
  const { accessToken } = await login(email, password);
  const key = `benchmark-${Date.now()}`;
  const body = JSON.stringify({ name: `Benchmark project ${Date.now()}` });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'Idempotency-Key': key,
  };

  const first = await timedFetch(`${API_URL}/projects`, { method: 'POST', headers, body });
  // Same Idempotency-Key, same body, sent again - this should be served
  // straight from the Redis cache set up by middleware/idempotency.ts,
  // never reaching the route handler or the database a second time.
  const second = await timedFetch(`${API_URL}/projects`, { method: 'POST', headers, body });

  console.log(`\nIdempotency-Key comparison (identical key + body sent twice)`);
  console.log(`  1st call (real handler runs, writes to DB):      ${first.ms.toFixed(2)}ms  [${first.status}]`);
  console.log(`  2nd call (served from Redis cache, no DB write): ${second.ms.toFixed(2)}ms  [${second.status}]`);
  console.log(`  speedup: ${(first.ms / second.ms).toFixed(1)}x faster on the cached repeat`);
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  switch (mode) {
    case 'health': {
      const [count = '200', concurrency = '20'] = rest;
      await healthMode(Number(count), Number(concurrency));
      break;
    }
    case 'concurrent-auth': {
      const [email, password, count = '200', concurrency = '20'] = rest;
      if (!email || !password) throw new Error('Usage: concurrent-auth <email> <password> [count] [concurrency]');
      await concurrentAuthMode(email, password, Number(count), Number(concurrency));
      break;
    }
    case 'idempotency': {
      const [email, password] = rest;
      if (!email || !password) throw new Error('Usage: idempotency <email> <password>');
      await idempotencyMode(email, password);
      break;
    }
    default:
      console.log('Usage: ts-node scripts/benchmark-load.ts <health|concurrent-auth|idempotency> [...args]');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
