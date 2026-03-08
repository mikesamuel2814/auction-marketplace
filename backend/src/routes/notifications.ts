import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const unreadOnly = req.query.unread === 'true';
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: req.authUser!.userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({
      where: {
        userId: req.authUser!.userId,
        ...(unreadOnly ? { read: false } : {}),
      },
    }),
  ]);
  return res.json({ notifications, total, page, limit });
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.authUser!.userId },
    data: { read: true },
  });
  return res.json({ message: 'Marked as read' });
});

router.post('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.authUser!.userId },
    data: { read: true },
  });
  return res.json({ message: 'All marked as read' });
});

export default router;
