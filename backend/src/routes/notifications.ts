import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id },
  });
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  res.json(updated);
});

router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.status(204).send();
});

export default router;
