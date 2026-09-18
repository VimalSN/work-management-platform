import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const organizationId = req.user!.organizationId;

  const [users, grouped] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, role: true, weeklyCapacityHours: true },
      orderBy: { name: 'asc' },
    }),
    // A GROUP BY at the database level - not "load every task and sum in
    // JS" - stays a single fast query regardless of how many tasks exist.
    // Only non-DONE tasks count: completed work no longer weighs on anyone.
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { organizationId, status: { not: 'DONE' }, assigneeId: { not: null } },
      _sum: { estimatedHours: true },
    }),
  ]);

  const hoursByUser = new Map(grouped.map((g) => [g.assigneeId, g._sum.estimatedHours ?? 0]));

  const workload = users.map((u) => ({
    userId: u.id,
    name: u.name,
    role: u.role,
    assignedHours: hoursByUser.get(u.id) ?? 0,
    capacityHours: u.weeklyCapacityHours,
  }));

  res.json(workload);
});

export default router;
