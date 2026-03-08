import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { authenticate, AuthRequest, JwtPayload } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';
import { Role } from '@prisma/client';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['BUYER', 'SELLER']).default('BUYER'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({ refreshToken: z.string() });
const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});
const verifyEmailSchema = z.object({ token: z.string() });

function generateTokens(payload: JwtPayload) {
  const access = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
  const refresh = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
  return { accessToken: access, refreshToken: refresh };
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const verificationToken = uuidv4();
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        role: body.role as Role,
        emailVerified: false,
      },
    });

    await prisma.emailVerification.create({
      data: {
        email: user.email,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    if (body.role === 'BUYER') {
      await prisma.buyer.create({ data: { userId: user.id } });
    } else {
      await prisma.seller.create({ data: { userId: user.id } });
    }

    try {
      await sendVerificationEmail(user.email, verificationToken, user.name);
    } catch (_) {}

    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: e.errors });
    }
    throw e;
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: e.errors });
    }
    throw e;
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const payload: JwtPayload = {
      userId: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
    };
    const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);

    return res.json({
      accessToken,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
        avatar: stored.user.avatar,
        emailVerified: stored.user.emailVerified,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    throw e;
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(200).json({ message: 'If the email exists, a reset link was sent.' });

    const token = uuidv4();
    await prisma.passwordReset.create({
      data: {
        email: user.email,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    try {
      await sendPasswordResetEmail(user.email, token, user.name);
    } catch (_) {}
    return res.status(200).json({ message: 'If the email exists, a reset link was sent.' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    throw e;
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email: reset.email },
      data: { passwordHash },
    });
    await prisma.passwordReset.delete({ where: { id: reset.id } });
    return res.json({ message: 'Password reset successful' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    throw e;
  }
});

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const verification = await prisma.emailVerification.findFirst({
      where: { token },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification || verification.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    await prisma.user.update({
      where: { email: verification.email },
      data: { emailVerified: true },
    });
    await prisma.emailVerification.deleteMany({ where: { email: verification.email } });
    return res.json({ message: 'Email verified successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed' });
    throw e;
  }
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  return res.json({ userId: req.authUser!.userId, email: req.authUser!.email, role: req.authUser!.role });
});

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string; email: string; name: string; role: Role } }).user;
    if (!user) return res.redirect(`${config.frontendUrl}/login?error=auth`);
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    res.redirect(
      `${config.frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
  }
);

export default router;
