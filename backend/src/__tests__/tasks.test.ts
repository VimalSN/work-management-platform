import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma';
import { closeTestConnections, registerOrgAdmin, resetDb } from './testHelpers';
import type { RegisteredUser } from './testHelpers';

beforeEach(resetDb);
afterAll(closeTestConnections);

async function createProject(admin: RegisteredUser, name = 'Test Project') {
  const res = await request(app)
    .post('/projects')
    .set('Authorization', `Bearer ${admin.accessToken}`)
    .send({ name });
  if (res.status !== 201) throw new Error(`createProject failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

async function createTask(admin: RegisteredUser, projectId: string, title: string) {
  const res = await request(app)
    .post(`/projects/${projectId}/tasks`)
    .set('Authorization', `Bearer ${admin.accessToken}`)
    .send({ title });
  if (res.status !== 201) throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; version: number; status: string };
}

describe('optimistic concurrency (PATCH /tasks/:id)', () => {
  it('accepts an update when the client presents the current version', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const task = await createTask(admin, project.id, 'Ship the feature');

    const res = await request(app)
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'IN_PROGRESS', version: task.version });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.version).toBe(task.version + 1);
  });

  it('rejects an update with a stale version and reports the current state', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const task = await createTask(admin, project.id, 'Ship the feature');

    // First writer succeeds and moves the version forward...
    await request(app)
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'IN_PROGRESS', version: task.version });

    // ...a second writer, still holding the ORIGINAL version, loses.
    const stale = await request(app)
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'DONE', version: task.version });

    expect(stale.status).toBe(409);
    expect(stale.body.current.status).toBe('IN_PROGRESS');
  });
});

describe('cycle detection (POST /tasks/:id/dependencies)', () => {
  it('allows a BLOCKS link between two unrelated tasks', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const taskA = await createTask(admin, project.id, 'Task A');
    const taskB = await createTask(admin, project.id, 'Task B');

    const res = await request(app)
      .post(`/tasks/${taskA.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: taskB.id, type: 'BLOCKS' });

    expect(res.status).toBe(201);
  });

  it('rejects a link that would close a circular dependency', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const taskA = await createTask(admin, project.id, 'Task A');
    const taskB = await createTask(admin, project.id, 'Task B');

    // A blocks B...
    await request(app)
      .post(`/tasks/${taskA.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: taskB.id, type: 'BLOCKS' });

    // ...so B blocking A back would close a 2-node cycle - must be rejected.
    const res = await request(app)
      .post(`/tasks/${taskB.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: taskA.id, type: 'BLOCKS' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/circular/i);
  });

  it('rejects a longer cycle spanning more than two tasks', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const [a, b, c] = await Promise.all([
      createTask(admin, project.id, 'A'),
      createTask(admin, project.id, 'B'),
      createTask(admin, project.id, 'C'),
    ]);

    // A -> B -> C, then C -> A would close the loop.
    await request(app)
      .post(`/tasks/${a.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: b.id, type: 'BLOCKS' });
    await request(app)
      .post(`/tasks/${b.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: c.id, type: 'BLOCKS' });

    const res = await request(app)
      .post(`/tasks/${c.id}/dependencies`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ relatedTaskId: a.id, type: 'BLOCKS' });

    expect(res.status).toBe(409);
  });
});

describe('idempotency (POST /projects/:id/tasks with an Idempotency-Key)', () => {
  it('returns the same task and only creates one row when the same key is replayed', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);
    const idempotencyKey = 'test-key-123';

    const first = await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ title: 'Only once, please' });

    const second = await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ title: 'Only once, please' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const count = await prisma.task.count({ where: { projectId: project.id } });
    expect(count).toBe(1);
  });

  it('creates a second task when no Idempotency-Key is given at all', async () => {
    const admin = await registerOrgAdmin();
    const project = await createProject(admin);

    await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: 'Task one' });
    await request(app)
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: 'Task two' });

    const count = await prisma.task.count({ where: { projectId: project.id } });
    expect(count).toBe(2);
  });
});
