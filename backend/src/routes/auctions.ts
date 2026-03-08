import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { getPublicUrl } from '../services/s3';
import { Role, AuctionStatus } from '@prisma/client';

const router = Router();

const createAuctionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  categoryId: z.string().uuid().optional(),
  startingBid: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  minIncrement: z.number().positive().default(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  imageUrls: z.array(z.string().url()).min(1).max(10).optional(),
  antiSnipingMinutes: z.number().min(0).max(15).default(5),
});

const updateAuctionSchema = createAuctionSchema.partial();

// Public: list auctions (browse) with filters and sort
router.get('/', async (req, res: Response) => {
  const status = (req.query.status as string) || 'LIVE';
  const categoryId = req.query.categoryId as string | undefined;
  const search = (req.query.search as string)?.trim();
  const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined;
  const sort = (req.query.sort as string) || 'endingSoon';
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 12));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { approved: true, draft: false };
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  const { Decimal } = await import('@prisma/client/runtime/library');
  if (minPrice != null && !Number.isNaN(minPrice) && maxPrice != null && !Number.isNaN(maxPrice)) {
    (where as Record<string, unknown>).currentBid = { gte: new Decimal(minPrice), lte: new Decimal(maxPrice) };
  } else if (minPrice != null && !Number.isNaN(minPrice)) {
    (where as Record<string, unknown>).currentBid = { gte: new Decimal(minPrice) };
  } else if (maxPrice != null && !Number.isNaN(maxPrice)) {
    (where as Record<string, unknown>).currentBid = { lte: new Decimal(maxPrice) };
  }

  type OrderByItem = { featured?: 'desc'; endTime?: 'asc' | 'desc'; createdAt?: 'desc'; currentBid?: 'desc' };
  const orderBy: OrderByItem[] =
    sort === 'newest'
      ? [{ featured: 'desc' }, { createdAt: 'desc' }]
      : sort === 'highestBid'
        ? [{ featured: 'desc' }, { currentBid: 'desc' }]
        : [{ featured: 'desc' }, { endTime: 'asc' }];

  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        images: { orderBy: { order: 'asc' }, take: 1 },
        seller: { include: { user: { select: { name: true } } } },
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.auction.count({ where }),
  ]);

  const items = auctions.map((a) => ({
    ...a,
    startingBid: Number(a.startingBid),
    currentBid: Number(a.currentBid),
    reservePrice: a.reservePrice ? Number(a.reservePrice) : null,
    minIncrement: Number(a.minIncrement),
  }));

  return res.json({ auctions: items, total, page, limit });
});

// Public: get single auction
router.get('/:id', async (req, res: Response) => {
  const auction = await prisma.auction.findUnique({
    where: { id: req.params.id },
    include: {
      images: { orderBy: { order: 'asc' } },
      seller: { include: { user: { select: { id: true, name: true } } } },
      category: true,
      bids: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { buyer: { include: { user: { select: { name: true } } } } },
      },
    },
  });
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  await prisma.auction.update({
    where: { id: req.params.id },
    data: { viewCount: { increment: 1 } },
  });
  return res.json({
    ...auction,
    viewCount: (auction.viewCount ?? 0) + 1,
    startingBid: Number(auction.startingBid),
    currentBid: Number(auction.currentBid),
    reservePrice: auction.reservePrice ? Number(auction.reservePrice) : null,
    minIncrement: Number(auction.minIncrement),
    bids: auction.bids.map((b) => ({
      ...b,
      amount: Number(b.amount),
      bidderName: b.buyer.user.name,
    })),
  });
});

// Seller: create auction
router.post(
  '/',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const seller = await prisma.seller.findUnique({ where: { userId: req.authUser!.userId } });
    if (!seller) return res.status(403).json({ error: 'Seller profile required' });
    const body = createAuctionSchema.parse(req.body);
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);
    if (endTime <= startTime) return res.status(400).json({ error: 'endTime must be after startTime' });

    const approved = req.authUser!.role === Role.ADMIN;
    const auction = await prisma.auction.create({
      data: {
        sellerId: seller.id,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description,
        startingBid: new Decimal(body.startingBid),
        currentBid: new Decimal(body.startingBid),
        reservePrice: body.reservePrice ? new Decimal(body.reservePrice) : null,
        minIncrement: new Decimal(body.minIncrement),
        startTime,
        endTime,
        status: startTime > new Date() ? AuctionStatus.UPCOMING : AuctionStatus.LIVE,
        approved,
        antiSnipingMinutes: body.antiSnipingMinutes,
        images: body.imageUrls?.length
          ? {
              create: body.imageUrls.map((url, i) => ({ url, order: i })),
            }
          : undefined,
      },
      include: {
        images: true,
        seller: { include: { user: { select: { name: true } } } },
      },
    });
    return res.status(201).json({
      ...auction,
      startingBid: Number(auction.startingBid),
      currentBid: Number(auction.currentBid),
      reservePrice: auction.reservePrice ? Number(auction.reservePrice) : null,
      minIncrement: Number(auction.minIncrement),
    });
  }
);

// Seller: update own auction
router.patch(
  '/:id',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const auction = await prisma.auction.findUnique({ where: { id: req.params.id } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    const seller = await prisma.seller.findUnique({ where: { userId: req.authUser!.userId } });
    if (req.authUser!.role !== Role.ADMIN && auction.sellerId !== seller?.id) {
      return res.status(403).json({ error: 'Not your auction' });
    }
    if (auction.status !== AuctionStatus.UPCOMING) {
      return res.status(400).json({ error: 'Can only edit upcoming auctions' });
    }
    const body = updateAuctionSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = body.title;
    if (body.description != null) data.description = body.description;
    if (body.categoryId != null) data.categoryId = body.categoryId;
    if (body.startingBid != null) data.startingBid = new Decimal(body.startingBid);
    if (body.reservePrice != null) data.reservePrice = new Decimal(body.reservePrice);
    if (body.minIncrement != null) data.minIncrement = new Decimal(body.minIncrement);
    if (body.startTime != null) data.startTime = new Date(body.startTime);
    if (body.endTime != null) data.endTime = new Date(body.endTime);
    if (body.antiSnipingMinutes != null) data.antiSnipingMinutes = body.antiSnipingMinutes;

    const updated = await prisma.auction.update({
      where: { id: req.params.id },
      data,
      include: { images: true, seller: { include: { user: { select: { name: true } } } } },
    });
    return res.json({
      ...updated,
      startingBid: Number(updated.startingBid),
      currentBid: Number(updated.currentBid),
      reservePrice: updated.reservePrice ? Number(updated.reservePrice) : null,
      minIncrement: Number(updated.minIncrement),
    });
  }
);

// Admin: approve listing
router.post(
  '/:id/approve',
  authenticate,
  requireRole(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    await prisma.auction.update({
      where: { id: req.params.id },
      data: { approved: true },
    });
    return res.json({ message: 'Auction approved' });
  }
);

// Admin: feature listing
router.post(
  '/:id/feature',
  authenticate,
  requireRole(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { startAt, endAt, priority } = req.body as { startAt?: string; endAt?: string; priority?: number };
    const auction = await prisma.auction.findUnique({ where: { id: req.params.id } });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    await prisma.auction.update({ where: { id: req.params.id }, data: { featured: true } });
    await prisma.featuredListing.upsert({
      where: { auctionId: req.params.id },
      create: {
        auctionId: req.params.id,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: priority ?? 0,
      },
      update: {
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        priority: priority ?? undefined,
      },
    });
    return res.json({ message: 'Auction featured' });
  }
);

// Seller: duplicate auction as draft
router.post(
  '/:id/duplicate',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const original = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: { images: true },
    });
    if (!original) return res.status(404).json({ error: 'Auction not found' });
    const seller = await prisma.seller.findUnique({ where: { userId: req.authUser!.userId } });
    if (!seller || original.sellerId !== seller.id) return res.status(403).json({ error: 'Not your auction' });
    const start = new Date();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const copy = await prisma.auction.create({
      data: {
        sellerId: original.sellerId,
        categoryId: original.categoryId,
        title: `${original.title} (Copy)`,
        description: original.description,
        startingBid: original.startingBid,
        currentBid: original.startingBid,
        reservePrice: original.reservePrice,
        minIncrement: original.minIncrement,
        startTime: start,
        endTime: end,
        status: AuctionStatus.UPCOMING,
        approved: false,
        featured: false,
        draft: true,
        antiSnipingMinutes: original.antiSnipingMinutes,
        images: {
          create: original.images.map((img) => ({ url: img.url, order: img.order })),
        },
      },
      include: { images: true },
    });
    return res.status(201).json({
      ...copy,
      startingBid: Number(copy.startingBid),
      currentBid: Number(copy.currentBid),
      reservePrice: copy.reservePrice ? Number(copy.reservePrice) : null,
      minIncrement: Number(copy.minIncrement),
    });
  }
);

// Upload URL for images (presigned S3)
router.post(
  '/upload-url',
  authenticate,
  requireRole(Role.SELLER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { getSignedUploadUrl } = await import('../services/s3');
    const key = `auctions/${req.authUser!.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const contentType = (req.body.contentType as string) || 'image/jpeg';
    const url = await getSignedUploadUrl(key, contentType);
    return res.json({ uploadUrl: url, key });
  }
);

export default router;
