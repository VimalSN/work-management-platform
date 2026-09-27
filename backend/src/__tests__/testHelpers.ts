import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma';
import { redis } from '../redis';
import { queueConnection } from '../queue/connection';
import { notificationsQueue } from '../queue/notifications';

// Deleted in child-to-parent order so this works regardless of which FKs
// happen to cascade - explicit is safer than relying on cascade behavior
// staying in sync with this list as the schema grows.
export async function resetDb() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.taskDependency.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}

// Integration tests import connections these routes open as a side effect
// (Prisma, the app's Redis client, BullMQ's queue + its own Redis
// connection) - none of them are ever closed on their own since in the real
// app they're meant to live for the process's whole lifetime. Without this,
// Jest hangs waiting for the test process to exit.
export async function closeTestConnections() {
  await notificationsQueue.close();
  await queueConnection.quit();
  await redis.quit();
  await prisma.$disconnect();
}

export type RegisteredUser = {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string; organizationId: string };
};

let counter = 0;

// Every call registers a brand new organization (registering always creates
// one, as its own Admin) - unique email per call avoids collisions between
// tests in the same file.
export async function registerOrgAdmin(overrides: Partial<{ organizationName: string; name: string; email: string; password: string }> = {}): Promise<RegisteredUser> {
  counter += 1;
  const res = await request(app)
    .post('/auth/register')
    .send({
      organizationName: overrides.organizationName ?? `Test Org ${counter}`,
      name: overrides.name ?? `Admin ${counter}`,
      email: overrides.email ?? `admin${counter}@example.com`,
      password: overrides.password ?? 'password123',
    });
  if (res.status !== 201) {
    throw new Error(`registerOrgAdmin failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// Adds a second user (e.g. a Developer) to an existing admin's organization,
// via the admin-only POST /auth/users route - not a second /register call,
// which would create a whole separate organization instead.
export async function addTeamMember(
  adminToken: string,
  overrides: Partial<{ name: string; email: string; password: string; role: string }> = {},
) {
  counter += 1;
  const res = await request(app)
    .post('/auth/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: overrides.name ?? `User ${counter}`,
      email: overrides.email ?? `user${counter}@example.com`,
      password: overrides.password ?? 'password123',
      role: overrides.role ?? 'DEVELOPER',
    });
  if (res.status !== 201) {
    throw new Error(`addTeamMember failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as { id: string; name: string; email: string; role: string };
}
