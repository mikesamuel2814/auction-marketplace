import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      sellerProfile: { select: { verified: true, kycVerified: true } },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional(),
});

router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const body = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.authUser!.userId },
    data: body,
    select: { id: true, email: true, name: true, avatar: true, role: true },
  });
  return res.json(user);
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.authUser!.userId } });
  if (!user?.passwordHash) return res.status(400).json({ error: 'Cannot change password for OAuth account' });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.json({ message: 'Password updated' });
});

// Admin: list users
router.get('/', authenticate, requireRole(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        sellerProfile: { select: { verified: true } },
      },
    }),
    prisma.user.count(),
  ]);
  return res.json({ users, total, page, limit });
});

// Admin: verify seller
router.post(
  '/:id/verify-seller',
  authenticate,
  requireRole(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const seller = await prisma.seller.findFirst({ where: { userId: id } });
    if (!seller) return res.status(404).json({ error: 'Seller not found' });
    await prisma.seller.update({ where: { id: seller.id }, data: { verified: true } });
    return res.json({ message: 'Seller verified' });
  }
);

export default router;
