import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5).max(200),
  description: z.string().max(2000).optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { buyer: true, seller: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isBuyer = order.buyer.userId === req.authUser!.userId;
  const isSeller = order.seller.userId === req.authUser!.userId;
  if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Not your order' });
  const existing = await prisma.dispute.findFirst({ where: { orderId: body.orderId } });
  if (existing) return res.status(400).json({ error: 'Dispute already raised for this order' });
  const dispute = await prisma.dispute.create({
    data: {
      orderId: body.orderId,
      raisedBy: req.authUser!.userId,
      reason: body.reason,
      description: body.description,
    },
  });
  return res.status(201).json({ dispute });
});

router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { buyer: { userId: req.authUser!.userId } },
        { seller: { userId: req.authUser!.userId } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const disputes = await prisma.dispute.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ disputes });
});

export default router;
