import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { closeAuctionAndCreateOrder } from '../services/auctionClose';
import { Role } from '@prisma/client';

const router = Router();

// Internal/cron: end auction and create order for winner
router.post(
  '/close-auction',
  authenticate,
  requireRole(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { auctionId } = z.object({ auctionId: z.string().uuid() }).parse(req.body);
    const result = await closeAuctionAndCreateOrder(auctionId);
    return res.json(result);
  }
);

// Seller: my auctions
router.get(
  '/my-auctions',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const seller = await prisma.seller.findUnique({ where: { userId: req.authUser!.userId } });
    if (!seller) return res.json({ auctions: [] });
    const auctions = await prisma.auction.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        bids: { take: 1, orderBy: { amount: 'desc' } },
      },
    });
    return res.json({
      auctions: auctions.map((a) => ({
        ...a,
        startingBid: Number(a.startingBid),
        currentBid: Number(a.currentBid),
        reservePrice: a.reservePrice ? Number(a.reservePrice) : null,
        minIncrement: Number(a.minIncrement),
        image: a.images[0]?.url,
        bidCount: a.bids.length,
      })),
    });
  }
);

export default router;
