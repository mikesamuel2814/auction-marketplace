import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { calculatePlatformFee, calculateSellerAmount } from './stripe';
import { AuctionStatus, TransactionStatus } from '@prisma/client';
import { NotificationType } from '@prisma/client';
import { getIo } from '../socket';

export async function closeAuctionAndCreateOrder(auctionId: string): Promise<{ orderId: string | null; winnerId: string | null }> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { seller: true, bids: { orderBy: { amount: 'desc' }, take: 1 } },
  });
  if (!auction || auction.status !== AuctionStatus.LIVE) return { orderId: null, winnerId: null };
  if (new Date() < auction.endTime) return { orderId: null, winnerId: null };

  const winningBid = auction.bids[0];
  if (!winningBid) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.ENDED },
    });
    return { orderId: null, winnerId: null };
  }

  const amount = Number(winningBid.amount);
  const platformFee = calculatePlatformFee(amount);
  const sellerAmount = calculateSellerAmount(amount);

  const order = await prisma.order.create({
    data: {
      auctionId: auction.id,
      buyerId: winningBid.buyerId,
      sellerId: auction.sellerId,
      winningBidId: winningBid.id,
      amount: new Decimal(amount),
      platformFee: new Decimal(platformFee),
      sellerAmount: new Decimal(sellerAmount),
      status: TransactionStatus.PENDING,
    },
  });

  await prisma.auction.update({
    where: { id: auctionId },
    data: { status: AuctionStatus.ENDED },
  });

  const buyerRecord = await prisma.buyer.findUnique({ where: { id: winningBid.buyerId } });
  const winnerUserId = buyerRecord!.userId;

  await prisma.notification.create({
    data: {
      userId: winnerUserId,
      type: NotificationType.AUCTION_WON,
      title: 'You won the auction!',
      body: `You won "${auction.title}" at ${amount} BDT. Complete payment in your dashboard.`,
      link: `/dashboard/orders`,
      metadata: { orderId: order.id, auctionId },
    },
  });

  const io = getIo();
  if (io) {
    io.to(`auction:${auctionId}`).emit('auctionEnded', {
      winnerId: winningBid.buyerId,
      orderId: order.id,
      amount,
    });
  }

  return { orderId: order.id, winnerId: winnerUserId };
}

export async function processEndedAuctions(): Promise<void> {
  const now = new Date();
  const liveAuctions = await prisma.auction.findMany({
    where: { status: AuctionStatus.LIVE, endTime: { lte: now } },
    select: { id: true },
  });
  for (const a of liveAuctions) {
    await closeAuctionAndCreateOrder(a.id);
  }
}

export async function startUpcomingAuctions(): Promise<void> {
  const now = new Date();
  await prisma.auction.updateMany({
    where: { status: AuctionStatus.UPCOMING, startTime: { lte: now }, endTime: { gt: now } },
    data: { status: AuctionStatus.LIVE },
  });
}
