import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role, TaskStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth';
import { hasCycle } from '../lib/graph';
import type { Edge } from '../lib/graph';
import { emitToProject } from '../realtime';
import { enqueueNotification } from '../queue/notifications';

const router = Router();

router.use(authenticate);

const listTasksQuerySchema = z.object({
  search: z.string().max(200).optional(),
  assigneeId: z.string().optional(),
});

// Used by the frontend's "link to another task" picker (dependencies can
// cross projects, so this isn't scoped to a single project like
// GET /projects/:id/tasks is) and by the dashboard's "my tasks" view
// (assigneeId filter - filtering server-side rather than fetching
// everything and checking client-side means a user's tasks are found even
// if the org has more than the `take` limit below).
router.get('/', async (req: AuthenticatedRequest, res) => {
  const parsedQuery = listTasksQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.flatten() });
    return;
  }

  const tasks = await prisma.task.findMany({
    where: {
      organizationId: req.user!.organizationId,
      assigneeId: parsedQuery.data.assigneeId,
      ...(parsedQuery.data.search
        ? { title: { contains: parsedQuery.data.search, mode: 'insensitive' as const } }
        : {}),
    },
    select: { id: true, title: true, status: true, projectId: true, assigneeId: true, estimatedHours: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(tasks);
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const task = await prisma.task.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  estimatedHours: z.number().positive().max(1000).nullable().optional(),
  // Required: the version the client last read, so a stale write can be
  // rejected instead of silently overwriting someone else's change.
  version: z.number().int(),
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const task = await prisma.task.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { role, id: userId } = req.user!;
  const isManager = role === Role.ADMIN || role === Role.MANAGER;
  // Role-based RBAC (authorize()) only answers "is this role ever allowed to
  // hit this route." Whether THIS particular Developer may edit THIS
  // particular task depends on the resource itself - who it's assigned to -
  // which can only be known after loading it. That's why this check lives
  // here, in the handler, rather than in route-level middleware.
  const isOwnTask = role === Role.DEVELOPER && task.assigneeId === userId;

  if (!isManager && !isOwnTask) {
    res.status(403).json({ error: 'You can only update tasks assigned to you' });
    return;
  }

  const { version: clientVersion, ...data } = parsed.data;
  if (!isManager) {
    // A Developer may update status/description on their own task, but
    // renaming it or reassigning it to someone else is a Manager/Admin action.
    delete data.title;
    delete data.assigneeId;
  }

  if (data.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: data.assigneeId, organizationId: req.user!.organizationId },
    });
    if (!assignee) {
      res.status(400).json({ error: 'Assignee not found in this organization' });
      return;
    }
  }

  // A single conditional UPDATE ... WHERE id = ? AND version = ? is what
  // actually closes the race: there's no separate read-then-write gap for
  // two concurrent requests to both slip through. If another update landed
  // between when this client read the task and now, version won't match,
  // count will be 0, and this request loses cleanly instead of silently
  // overwriting the other change.
  const result = await prisma.task.updateMany({
    where: { id: task.id, version: clientVersion },
    data: { ...data, version: { increment: 1 } },
  });

  if (result.count === 0) {
    // The task itself was already confirmed to exist above, so reaching
    // count 0 here can only mean the version didn't match - not a 404.
    const current = await prisma.task.findUnique({ where: { id: task.id } });
    res.status(409).json({
      error: 'This task was modified by someone else. Refresh and try again.',
      current,
    });
    return;
  }

  const updated = await prisma.task.findUnique({ where: { id: task.id } });
  emitToProject(task.projectId, 'task:updated', updated);

  const assigneeChanged = 'assigneeId' in data && data.assigneeId !== task.assigneeId;
  if (assigneeChanged && data.assigneeId && data.assigneeId !== req.user!.id) {
    await enqueueNotification({
      userId: data.assigneeId,
      organizationId: req.user!.organizationId,
      type: 'TASK_ASSIGNED',
      message: `You were assigned to "${updated!.title}"`,
      taskId: task.id,
    });
  }

  res.json(updated);
});

router.delete('/:id', authorize(Role.ADMIN, Role.MANAGER), async (req: AuthenticatedRequest, res) => {
  const task = await prisma.task.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
  });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  await prisma.task.delete({ where: { id: task.id } });
  emitToProject(task.projectId, 'task:deleted', { id: task.id });
  res.status(204).send();
});

const taskSummarySelect = { id: true, title: true, status: true, projectId: true } as const;

router.get('/:id/dependencies', async (req: AuthenticatedRequest, res) => {
  const taskId = String(req.params.id);
  const organizationId = req.user!.organizationId;

  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // BLOCKS/DUPLICATES are directional (stored from one specific side), so
  // each needs two queries - one for "this task is the source" and one for
  // "this task is the target" - to reconstruct both human-facing labels
  // (e.g. "Blocks" vs "Blocked by") from the single stored direction.
  // RELATES_TO is symmetric, so both directions feed the same list.
  const [blocks, blockedBy, relatesOut, relatesIn, duplicates, duplicatedBy] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { taskId, type: 'BLOCKS' },
      include: { relatedTask: { select: taskSummarySelect } },
    }),
    prisma.taskDependency.findMany({
      where: { relatedTaskId: taskId, type: 'BLOCKS' },
      include: { task: { select: taskSummarySelect } },
    }),
    prisma.taskDependency.findMany({
      where: { taskId, type: 'RELATES_TO' },
      include: { relatedTask: { select: taskSummarySelect } },
    }),
    prisma.taskDependency.findMany({
      where: { relatedTaskId: taskId, type: 'RELATES_TO' },
      include: { task: { select: taskSummarySelect } },
    }),
    prisma.taskDependency.findMany({
      where: { taskId, type: 'DUPLICATES' },
      include: { relatedTask: { select: taskSummarySelect } },
    }),
    prisma.taskDependency.findMany({
      where: { relatedTaskId: taskId, type: 'DUPLICATES' },
      include: { task: { select: taskSummarySelect } },
    }),
  ]);

  res.json({
    blocks: blocks.map((d) => ({ dependencyId: d.id, task: d.relatedTask })),
    blockedBy: blockedBy.map((d) => ({ dependencyId: d.id, task: d.task })),
    relatesTo: [
      ...relatesOut.map((d) => ({ dependencyId: d.id, task: d.relatedTask })),
      ...relatesIn.map((d) => ({ dependencyId: d.id, task: d.task })),
    ],
    duplicates: duplicates.map((d) => ({ dependencyId: d.id, task: d.relatedTask })),
    duplicatedBy: duplicatedBy.map((d) => ({ dependencyId: d.id, task: d.task })),
  });
});

const createDependencySchema = z.object({
  relatedTaskId: z.string().min(1),
  type: z.enum(['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES']),
});

router.post(
  '/:id/dependencies',
  authorize(Role.ADMIN, Role.MANAGER),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createDependencySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const taskId = String(req.params.id);
    const { relatedTaskId, type } = parsed.data;
    const organizationId = req.user!.organizationId;

    if (relatedTaskId === taskId) {
      res.status(400).json({ error: 'A task cannot depend on itself' });
      return;
    }

    const [task, relatedTask] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, organizationId } }),
      prisma.task.findFirst({ where: { id: relatedTaskId, organizationId } }),
    ]);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (!relatedTask) {
      res.status(400).json({ error: 'Related task not found in this organization' });
      return;
    }

    // BLOCKS and BLOCKED_BY describe the same edge from opposite ends - only
    // the direction differs, so both collapse to one stored type.
    const storedType = type === 'BLOCKED_BY' ? 'BLOCKS' : type;
    const sourceTaskId = type === 'BLOCKED_BY' ? relatedTaskId : taskId;
    const targetTaskId = type === 'BLOCKED_BY' ? taskId : relatedTaskId;

    if (storedType === 'BLOCKS') {
      const existingBlocksEdges = await prisma.taskDependency.findMany({
        where: { organizationId, type: 'BLOCKS' },
        select: { taskId: true, relatedTaskId: true },
      });
      const candidateEdges: Edge[] = [
        ...existingBlocksEdges.map((e) => ({ from: e.taskId, to: e.relatedTaskId })),
        { from: sourceTaskId, to: targetTaskId },
      ];
      if (hasCycle(candidateEdges)) {
        res.status(409).json({ error: 'This would create a circular dependency' });
        return;
      }
    }

    try {
      const dependency = await prisma.taskDependency.create({
        data: { organizationId, taskId: sourceTaskId, relatedTaskId: targetTaskId, type: storedType },
      });
      res.status(201).json(dependency);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'This dependency already exists' });
        return;
      }
      throw err;
    }
  },
);

router.delete(
  '/:id/dependencies/:dependencyId',
  authorize(Role.ADMIN, Role.MANAGER),
  async (req: AuthenticatedRequest, res) => {
    const taskId = String(req.params.id);
    const dependencyId = String(req.params.dependencyId);
    const organizationId = req.user!.organizationId;

    const dependency = await prisma.taskDependency.findFirst({
      where: { id: dependencyId, organizationId, OR: [{ taskId }, { relatedTaskId: taskId }] },
    });
    if (!dependency) {
      res.status(404).json({ error: 'Dependency not found' });
      return;
    }

    await prisma.taskDependency.delete({ where: { id: dependency.id } });
    res.status(204).send();
  },
);

router.get('/:id/comments', async (req: AuthenticatedRequest, res) => {
  const taskId = String(req.params.id);
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: req.user!.organizationId },
  });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments);
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

// Viewer is deliberately excluded - "read-only access to project progress"
// (from the brief's role descriptions) means exactly that; posting a comment
// is a write, even though it isn't a project/task management action.
router.post(
  '/:id/comments',
  authorize(Role.ADMIN, Role.MANAGER, Role.DEVELOPER),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const taskId = String(req.params.id);
    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId: req.user!.organizationId },
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        body: parsed.data.body,
        taskId,
        authorId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    emitToProject(task.projectId, 'comment:created', comment);

    if (task.assigneeId && task.assigneeId !== req.user!.id) {
      await enqueueNotification({
        userId: task.assigneeId,
        organizationId: req.user!.organizationId,
        type: 'NEW_COMMENT',
        message: `New comment on "${task.title}"`,
        taskId: task.id,
      });
    }

    res.status(201).json(comment);
  },
);

export default router;
