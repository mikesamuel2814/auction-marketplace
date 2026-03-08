import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.authUser!.userId },
    include: {
      auction: {
        include: {
          images: { take: 1, orderBy: { order: 'asc' } },
          seller: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({
    items: items.map((i) => ({
      ...i,
      auction: {
        ...i.auction,
        startingBid: Number(i.auction.startingBid),
        currentBid: Number(i.auction.currentBid),
        image: i.auction.images[0]?.url,
      },
    })),
  });
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { auctionId } = z.object({ auctionId: z.string().uuid() }).parse(req.body);
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  await prisma.watchlistItem.upsert({
    where: {
      userId_auctionId: { userId: req.authUser!.userId, auctionId },
    },
    create: { userId: req.authUser!.userId, auctionId },
    update: {},
  });
  return res.status(201).json({ message: 'Added to watchlist' });
});

router.delete('/:auctionId', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.watchlistItem.deleteMany({
    where: { userId: req.authUser!.userId, auctionId: req.params.auctionId },
  });
  return res.json({ message: 'Removed from watchlist' });
});

export default router;
