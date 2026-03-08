import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const body = createReviewSchema.parse(req.body);
  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { buyer: true, seller: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer.userId !== req.authUser!.userId) return res.status(403).json({ error: 'Not your order' });
  if (order.status !== 'RELEASED') return res.status(400).json({ error: 'Order must be completed first' });

  const revieweeId = order.seller.userId;
  const existing = await prisma.review.findUnique({
    where: {
      orderId_reviewerId: { orderId: body.orderId, reviewerId: req.authUser!.userId },
    },
  });
  if (existing) return res.status(400).json({ error: 'Already reviewed this order' });

  const review = await prisma.review.create({
    data: {
      orderId: body.orderId,
      reviewerId: req.authUser!.userId,
      revieweeId,
      rating: body.rating,
      comment: body.comment,
    },
    include: {
      reviewer: { select: { name: true } },
    },
  });
  return res.status(201).json(review);
});

router.get('/auction/:auctionId', async (req, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { auctionId: req.params.auctionId, status: 'RELEASED' },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const reviews = await prisma.review.findMany({
    where: { orderId: { in: orderIds } },
    include: { reviewer: { select: { name: true } } },
  });
  return res.json({ reviews });
});

router.get('/user/:userId', async (req, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: req.params.userId },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json({ reviews });
});

export default router;
