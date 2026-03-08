import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role, AuctionStatus } from '@prisma/client';

const router = Router();

const adminAuth = [authenticate, requireRole(Role.ADMIN)];

router.get('/dashboard', ...adminAuth, async (_req: AuthRequest, res: Response) => {
  const [usersCount, auctionsCount, liveCount, endedCount] = await Promise.all([
    prisma.user.count(),
    prisma.auction.count(),
    prisma.auction.count({ where: { status: AuctionStatus.LIVE } }),
    prisma.auction.count({ where: { status: AuctionStatus.ENDED } }),
  ]);
  return res.json({
    usersCount,
    auctionsCount,
    liveAuctions: liveCount,
    endedAuctions: endedCount,
  });
});

router.get('/auctions', ...adminAuth, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, parseInt(String(req.query.limit)) || 20);
  const status = req.query.status as string | undefined;
  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where: status ? { status: status as AuctionStatus } : undefined,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { include: { user: { select: { name: true, email: true } } } },
        images: { take: 1 },
      },
    }),
    prisma.auction.count({ where: status ? { status: status as AuctionStatus } : undefined }),
  ]);
  return res.json({
    auctions: auctions.map((a) => ({
      ...a,
      startingBid: Number(a.startingBid),
      currentBid: Number(a.currentBid),
    })),
    total,
    page,
    limit,
  });
});

router.get('/disputes', ...adminAuth, async (_req: AuthRequest, res: Response) => {
  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json({ disputes });
});

router.post('/disputes/:id/resolve', ...adminAuth, async (req: AuthRequest, res: Response) => {
  const { resolution } = req.body as { resolution: string };
  await prisma.dispute.update({
    where: { id: req.params.id },
    data: { status: 'RESOLVED', resolution: resolution || 'Resolved by admin' },
  });
  return res.json({ message: 'Dispute resolved' });
});

router.post('/users/:userId/suspend', ...adminAuth, async (req: AuthRequest, res: Response) => {
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { suspended: true },
  });
  return res.json({ message: 'User suspended' });
});

router.post('/users/:userId/unsuspend', ...adminAuth, async (req: AuthRequest, res: Response) => {
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { suspended: false },
  });
  return res.json({ message: 'User unsuspended' });
});

router.delete('/auctions/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  const auction = await prisma.auction.findUnique({ where: { id: req.params.id } });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  await prisma.auction.update({
    where: { id: req.params.id },
    data: { status: AuctionStatus.CANCELLED },
  });
  return res.json({ message: 'Auction cancelled' });
});

export default router;
