import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getIo } from '../socket';
import { AuctionStatus } from '@prisma/client';
import { NotificationType } from '@prisma/client';

const router = Router();

const placeBidSchema = z.object({
  auctionId: z.string().uuid(),
  amount: z.number().positive(),
  isAutoBid: z.boolean().optional(),
  maxAutoBid: z.number().positive().optional(),
});

// Get bid history for an auction
router.get('/auction/:auctionId', async (req, res: Response) => {
  const bids = await prisma.bid.findMany({
    where: { auctionId: req.params.auctionId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { buyer: { include: { user: { select: { name: true } } } } },
  });
  return res.json(
    bids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      isAutoBid: b.isAutoBid,
      bidderName: b.buyer.user.name,
      createdAt: b.createdAt,
    }))
  );
});

// Place bid (authenticated)
router.post(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const body = placeBidSchema.parse(req.body);
    const buyer = await prisma.buyer.findUnique({ where: { userId: req.authUser!.userId } });
    if (!buyer) return res.status(403).json({ error: 'Buyer profile required' });

    const auction = await prisma.auction.findUnique({
      where: { id: body.auctionId },
      include: { seller: { include: { user: { select: { id: true } } } } },
    });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status !== AuctionStatus.LIVE) {
      return res.status(400).json({ error: 'Auction is not live' });
    }
    if (auction.seller.user.id === req.authUser!.userId) {
      return res.status(400).json({ error: 'Cannot bid on your own auction' });
    }
    if (new Date() >= auction.endTime) {
      return res.status(400).json({ error: 'Auction has ended' });
    }

    const minBid = Number(auction.currentBid) + Number(auction.minIncrement);
    if (body.amount < minBid) {
      return res.status(400).json({
        error: `Minimum bid is ${minBid} (current + increment)`,
        minBid,
      });
    }

    const bid = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Auction" WHERE id = ${auction.id} FOR UPDATE`;
      const b = await tx.bid.create({
        data: {
          auctionId: auction.id,
          buyerId: buyer.id,
          amount: new Decimal(body.amount),
          isAutoBid: body.isAutoBid ?? false,
          maxAutoBid: body.maxAutoBid ? new Decimal(body.maxAutoBid) : null,
        },
        include: { buyer: { include: { user: { select: { name: true, id: true } } } } },
      });
      await tx.auction.update({
        where: { id: auction.id },
        data: { currentBid: new Decimal(body.amount) },
      });
      if (body.isAutoBid && body.maxAutoBid) {
        await tx.autoBid.upsert({
          where: {
            auctionId_buyerId: { auctionId: auction.id, buyerId: buyer.id },
          },
          create: {
            auctionId: auction.id,
            buyerId: buyer.id,
            maxAmount: new Decimal(body.maxAutoBid),
          },
          update: { maxAmount: new Decimal(body.maxAutoBid) },
        });
      }
      return b;
    });

    // Notify previous highest bidder (outbid)
    const previousBids = await prisma.bid.findMany({
      where: { auctionId: auction.id },
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: { buyer: { include: { user: true } } },
    });
    const previousWinner = previousBids[1];
    if (previousWinner && previousWinner.buyer.user.id !== req.authUser!.userId) {
      await prisma.notification.create({
        data: {
          userId: previousWinner.buyer.user.id,
          type: NotificationType.OUTBID,
          title: "You've been outbid",
          body: `Your bid on "${auction.title}" was exceeded. Current bid: ${body.amount} BDT`,
          link: `/auctions/${auction.id}`,
          metadata: { auctionId: auction.id, newBid: body.amount },
        },
      });
    }

    const io = getIo();
    if (io) {
      io.to(`auction:${auction.id}`).emit('newBid', {
        bid: {
          id: bid.id,
          amount: Number(bid.amount),
          bidderName: bid.buyer.user.name,
          createdAt: bid.createdAt,
        },
        currentBid: body.amount,
      });
    }

    // Auto-bid: if another user has auto-bid set, trigger it
    const autoBidders = await prisma.autoBid.findMany({
      where: {
        auctionId: auction.id,
        buyerId: { not: buyer.id },
        maxAmount: { gte: new Decimal(minBid + Number(auction.minIncrement)) },
      },
    });
    for (const ab of autoBidders) {
      const nextAmount = minBid + Number(auction.minIncrement);
      if (Number(ab.maxAmount) >= nextAmount) {
        // Create auto-bid in background (simplified: one round only to avoid loop)
        const existingBid = await prisma.bid.findFirst({
          where: { auctionId: auction.id, buyerId: ab.buyerId },
          orderBy: { createdAt: 'desc' },
        });
        const currentHigh = await prisma.auction.findUnique({
          where: { id: auction.id },
          select: { currentBid: true },
        });
        const currentHighNum = currentHigh ? Number(currentHigh.currentBid) : body.amount;
        const autoBidAmount = Math.min(nextAmount, Number(ab.maxAmount));
        if (autoBidAmount > currentHighNum) {
          const autoBid = await prisma.bid.create({
            data: {
              auctionId: auction.id,
              buyerId: ab.buyerId,
              amount: new Decimal(autoBidAmount),
              isAutoBid: true,
              maxAutoBid: ab.maxAmount,
            },
            include: { buyer: { include: { user: { select: { name: true } } } } },
          });
          await prisma.auction.update({
            where: { id: auction.id },
            data: { currentBid: new Decimal(autoBidAmount) },
          });
          if (io) {
            io.to(`auction:${auction.id}`).emit('newBid', {
              bid: {
                id: autoBid.id,
                amount: autoBidAmount,
                bidderName: autoBid.buyer.user.name,
                createdAt: autoBid.createdAt,
                isAutoBid: true,
              },
              currentBid: autoBidAmount,
            });
          }
          break; // one auto-bid response per new bid to avoid chain
        }
      }
    }

    return res.status(201).json({
      bid: {
        id: bid.id,
        amount: Number(bid.amount),
        createdAt: bid.createdAt,
      },
      currentBid: body.amount,
    });
  }
);

// My bids (buyer)
router.get('/my-bids', authenticate, async (req: AuthRequest, res: Response) => {
  const buyer = await prisma.buyer.findUnique({ where: { userId: req.authUser!.userId } });
  if (!buyer) return res.json({ bids: [] });
  const bids = await prisma.bid.findMany({
    where: { buyerId: buyer.id },
    orderBy: { createdAt: 'desc' },
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          status: true,
          endTime: true,
          currentBid: true,
          images: { take: 1, orderBy: { order: 'asc' } },
        },
      },
    },
  });
  return res.json({
    bids: bids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      isAutoBid: b.isAutoBid,
      createdAt: b.createdAt,
      auction: {
        ...b.auction,
        currentBid: Number(b.auction.currentBid),
        image: b.auction.images[0]?.url,
      },
    })),
  });
});

// Set/update auto-bid
router.post(
  '/auto-bid',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { auctionId, maxAmount } = z
      .object({ auctionId: z.string().uuid(), maxAmount: z.number().positive() })
      .parse(req.body);
    const buyer = await prisma.buyer.findUnique({ where: { userId: req.authUser!.userId } });
    if (!buyer) return res.status(403).json({ error: 'Buyer profile required' });
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.status !== AuctionStatus.LIVE) {
      return res.status(400).json({ error: 'Auction not found or not live' });
    }
    const minAmount = Number(auction.currentBid) + Number(auction.minIncrement);
    if (maxAmount < minAmount) {
      return res.status(400).json({ error: `Max auto-bid must be at least ${minAmount}` });
    }
    await prisma.autoBid.upsert({
      where: { auctionId_buyerId: { auctionId, buyerId: buyer.id } },
      create: { auctionId, buyerId: buyer.id, maxAmount: new Decimal(maxAmount) },
      update: { maxAmount: new Decimal(maxAmount) },
    });
    return res.json({ message: 'Auto-bid updated', maxAmount });
  }
);

export default router;
