import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
});

router.get('/', async (_req, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { auctions: true } } },
  });
  return res.json({ categories });
});

router.get('/:slug', async (req, res: Response) => {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: { _count: { select: { auctions: true } } },
  });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  return res.json(category);
});

router.post(
  '/',
  authenticate,
  requireRole(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const body = createCategorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        imageUrl: body.imageUrl,
      },
    });
    return res.status(201).json(category);
  }
);

export default router;
