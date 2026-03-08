import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// —— Saved searches ——
const saveSearchSchema = z.object({ query: z.string().min(1), filters: z.record(z.unknown()).optional() });

router.post('/saved-searches', authenticate, async (req: AuthRequest, res: Response) => {
  const body = saveSearchSchema.parse(req.body);
  const saved = await prisma.savedSearch.create({
    data: { userId: req.authUser!.userId, query: body.query, filters: body.filters ?? undefined },
  });
  return res.status(201).json(saved);
});

router.get('/saved-searches', authenticate, async (req: AuthRequest, res: Response) => {
  const list = await prisma.savedSearch.findMany({
    where: { userId: req.authUser!.userId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ items: list });
});

router.delete('/saved-searches/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.savedSearch.deleteMany({
    where: { id: req.params.id, userId: req.authUser!.userId },
  });
  return res.json({ message: 'Deleted' });
});

// —— Price alerts ——
const priceAlertSchema = z.object({ auctionId: z.string().uuid(), maxPrice: z.number().positive() });

router.post('/price-alerts', authenticate, async (req: AuthRequest, res: Response) => {
  const body = priceAlertSchema.parse(req.body);
  const alert = await prisma.priceAlert.upsert({
    where: {
      userId_auctionId: { userId: req.authUser!.userId, auctionId: body.auctionId },
    },
    create: {
      userId: req.authUser!.userId,
      auctionId: body.auctionId,
      maxPrice: new Decimal(body.maxPrice),
    },
    update: { maxPrice: new Decimal(body.maxPrice), notified: false },
  });
  return res.status(201).json({
    id: alert.id,
    auctionId: alert.auctionId,
    maxPrice: Number(alert.maxPrice),
    notified: alert.notified,
  });
});

router.get('/price-alerts', authenticate, async (req: AuthRequest, res: Response) => {
  const list = await prisma.priceAlert.findMany({
    where: { userId: req.authUser!.userId },
    include: { auction: { select: { id: true, title: true, currentBid: true, endTime: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({
    items: list.map((a) => ({
      id: a.id,
      auctionId: a.auctionId,
      maxPrice: Number(a.maxPrice),
      notified: a.notified,
      auction: {
        ...a.auction,
        currentBid: Number(a.auction.currentBid),
      },
    })),
  });
});

router.delete('/price-alerts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.priceAlert.deleteMany({
    where: { id: req.params.id, userId: req.authUser!.userId },
  });
  return res.json({ message: 'Deleted' });
});

// —— Recently viewed (record + list) ——
router.post('/recently-viewed', authenticate, async (req: AuthRequest, res: Response) => {
  const { auctionId } = z.object({ auctionId: z.string().uuid() }).parse(req.body);
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  await prisma.recentlyViewed.upsert({
    where: {
      userId_auctionId: { userId: req.authUser!.userId, auctionId },
    },
    create: { userId: req.authUser!.userId, auctionId },
    update: { viewedAt: new Date() },
  });
  return res.json({ message: 'Recorded' });
});

router.get('/recently-viewed', authenticate, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const items = await prisma.recentlyViewed.findMany({
    where: { userId: req.authUser!.userId },
    orderBy: { viewedAt: 'desc' },
    take: limit,
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          currentBid: true,
          endTime: true,
          status: true,
          images: { orderBy: { order: 'asc' }, take: 1 },
        },
      },
    },
  });
  return res.json({
    items: items.map((r) => ({
      id: r.id,
      viewedAt: r.viewedAt,
      auction: {
        ...r.auction,
        currentBid: Number(r.auction.currentBid),
        image: r.auction.images[0]?.url,
      },
    })),
  });
});

export default router;
