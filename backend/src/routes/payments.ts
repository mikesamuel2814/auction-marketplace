import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createPaymentIntent, calculatePlatformFee, calculateSellerAmount } from '../services/stripe';
import { stripe } from '../services/stripe';
import { config } from '../config';
import { sendItemShippedEmail, sendItemDeliveredEmail } from '../services/email';
import { Role, TransactionStatus } from '@prisma/client';
import { NotificationType } from '@prisma/client';

const router = Router();

export function stripeWebhookHandler(req: Request, res: Response): void {
  const sig = req.headers['stripe-signature'] as string;
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    res.status(400).send(message);
    return;
  }
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as { id: string };
    prisma.order
      .updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: TransactionStatus.IN_ESCROW, paidAt: new Date() },
      })
      .then(() => {})
      .catch(() => {});
  }
  res.json({ received: true });
}

// Create payment intent for winning bidder (after auction ends)
router.post(
  '/create-intent',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { orderId } = z.object({ orderId: z.string().uuid() }).parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true, auction: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyer.userId !== req.authUser!.userId) {
      return res.status(403).json({ error: 'Not your order' });
    }
    if (order.status !== TransactionStatus.PENDING) {
      return res.status(400).json({ error: 'Order already paid or invalid' });
    }

    const amountCents = Math.round(Number(order.amount) * 100); // BDT often same as cents for demo; use 100 for USD
    const paymentIntent = await createPaymentIntent(
      amountCents,
      'bdt',
      { orderId: order.id, buyerId: order.buyerId }
    );

    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: config.stripe.publishableKey,
    });
  }
);

// Confirm payment (webhook or client callback) – webhook handles actual completion
router.post(
  '/confirm',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { paymentIntentId } = z.object({ paymentIntentId: z.string() }).parse(req.body);
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { buyer: true },
    });
    if (!order || order.buyer.userId !== req.authUser!.userId) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'succeeded') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: TransactionStatus.IN_ESCROW,
          paidAt: new Date(),
        },
      });
      return res.json({ status: 'succeeded', orderId: order.id });
    }
    return res.json({ status: intent.status });
  }
);

// Seller: mark as shipped
router.post(
  '/:orderId/ship',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { seller: true, auction: true, buyer: { include: { user: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.seller.userId !== req.authUser!.userId && req.authUser!.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Not your order' });
    }
    if (order.status !== TransactionStatus.IN_ESCROW) {
      return res.status(400).json({ error: 'Order must be paid first' });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { shippedAt: new Date() },
    });
    const buyerUser = order.buyer.user;
    await prisma.notification.create({
      data: {
        userId: buyerUser.id,
        type: NotificationType.ITEM_SHIPPED,
        title: 'Item shipped',
        body: `Your winning item "${order.auction.title}" has been shipped.`,
        link: '/dashboard/orders',
        metadata: { orderId: order.id },
      },
    });
    try {
      await sendItemShippedEmail(buyerUser.email, order.auction.title, order.id);
    } catch (_) {}
    return res.json({ message: 'Marked as shipped' });
  }
);

// Buyer: confirm delivery (release escrow to seller)
router.post(
  '/:orderId/confirm-delivery',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { buyer: { include: { user: true } }, seller: true, auction: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyer.userId !== req.authUser!.userId) return res.status(403).json({ error: 'Not your order' });
    if (order.status !== TransactionStatus.IN_ESCROW) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: TransactionStatus.RELEASED,
        deliveredAt: new Date(),
      },
    });

    try {
      await sendItemDeliveredEmail(order.buyer.user.email, order.auction.title);
    } catch (_) {}

    return res.json({
      message: 'Delivery confirmed. Payment released to seller.',
      sellerAmount: Number(order.sellerAmount),
      platformFee: Number(order.platformFee),
    });
  }
);

// My orders (buyer)
router.get('/orders', authenticate, async (req: AuthRequest, res: Response) => {
  const buyer = await prisma.buyer.findUnique({ where: { userId: req.authUser!.userId } });
  if (!buyer) return res.json({ orders: [] });
  const orders = await prisma.order.findMany({
    where: { buyerId: buyer.id },
    orderBy: { createdAt: 'desc' },
    include: {
      auction: { select: { id: true, title: true, images: { take: 1 } } },
      seller: { include: { user: { select: { name: true } } } },
    },
  });
  return res.json({
    orders: orders.map((o) => ({
      ...o,
      amount: Number(o.amount),
      platformFee: Number(o.platformFee),
      sellerAmount: Number(o.sellerAmount),
      auction: {
        ...o.auction,
        image: o.auction.images[0]?.url,
      },
    })),
  });
});

// Seller: sales / earnings
router.get('/sales', authenticate, requireRole(Role.SELLER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const seller = await prisma.seller.findUnique({ where: { userId: req.authUser!.userId } });
  if (!seller) return res.json({ sales: [] });
  const orders = await prisma.order.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: 'desc' },
    include: { auction: { select: { title: true } }, buyer: { include: { user: { select: { name: true } } } } },
  });
  return res.json({
    sales: orders.map((o) => ({
      id: o.id,
      amount: Number(o.amount),
      platformFee: Number(o.platformFee),
      sellerAmount: Number(o.sellerAmount),
      status: o.status,
      paidAt: o.paidAt,
      auctionTitle: o.auction.title,
      buyerName: o.buyer.user.name,
    })),
  });
});

export default router;
