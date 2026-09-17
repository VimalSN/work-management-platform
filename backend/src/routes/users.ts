import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Any authenticated role can list their own org's members - needed so the
// frontend can offer an assignee picker when creating/editing a task.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const users = await prisma.user.findMany({
    where: { organizationId: req.user!.organizationId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

export default router;
