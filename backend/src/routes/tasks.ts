import { Router } from 'express';
import { z } from 'zod';
import { Role, TaskStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

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

  const data = { ...parsed.data };
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

  const updated = await prisma.task.update({ where: { id: task.id }, data });
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
  res.status(204).send();
});

export default router;
