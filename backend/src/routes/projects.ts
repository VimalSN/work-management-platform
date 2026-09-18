import { Router } from 'express';
import { z } from 'zod';
import { Role, TaskStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';

const router = Router();

// Every route below requires a valid access token - even read-only ones,
// since "Viewer" is still an authenticated role, not a public one.
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(projects);
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

router.post('/', authorize(Role.ADMIN, Role.MANAGER), idempotent, async (req: AuthenticatedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, organizationId: req.user!.organizationId },
  });
  res.status(201).json(project);
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  // id + organizationId in the SAME query: a project belonging to a
  // different organization looks identical to a non-existent one - 404
  // either way, never a 403 that would confirm the ID exists elsewhere.
  const project = await prisma.project.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

router.patch('/:id', authorize(Role.ADMIN, Role.MANAGER), async (req: AuthenticatedRequest, res) => {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.project.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const project = await prisma.project.update({ where: { id: existing.id }, data: parsed.data });
  res.json(project);
});

router.delete('/:id', authorize(Role.ADMIN, Role.MANAGER), async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.project.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (existing._count.tasks > 0) {
    res.status(409).json({ error: 'Cannot delete a project that still has tasks' });
    return;
  }

  await prisma.project.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const listTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().optional(),
});

router.get('/:id/tasks', async (req: AuthenticatedRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsedQuery = listTasksQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.flatten() });
    return;
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      organizationId: req.user!.organizationId,
      status: parsedQuery.data.status,
      assigneeId: parsedQuery.data.assigneeId,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().optional(),
});

router.post(
  '/:id/tasks',
  authorize(Role.ADMIN, Role.MANAGER),
  idempotent,
  async (req: AuthenticatedRequest, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (parsed.data.assigneeId) {
      // The assignee must belong to the SAME org - otherwise a Manager in
      // org A could assign a task to a user id they guessed from org B.
      const assignee = await prisma.user.findFirst({
        where: { id: parsed.data.assigneeId, organizationId: req.user!.organizationId },
      });
      if (!assignee) {
        res.status(400).json({ error: 'Assignee not found in this organization' });
        return;
      }
    }

    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        assigneeId: parsed.data.assigneeId,
        projectId: project.id,
        organizationId: req.user!.organizationId,
      },
    });
    res.status(201).json(task);
  },
);

export default router;
