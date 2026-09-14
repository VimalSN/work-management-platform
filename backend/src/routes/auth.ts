import { Response, Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  REFRESH_TOKEN_TTL_DAYS,
  generateRefreshTokenValue,
  hashToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from '../lib/tokens';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function publicUser(user: { id: string; name: string; email: string; role: Role; organizationId: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId };
}

const registerSchema = z.object({
  organizationName: z.string().min(2).max(100),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { organizationName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: organizationName } });
    return tx.user.create({
      data: {
        organizationId: organization.id,
        name,
        email,
        passwordHash,
        role: Role.ADMIN,
      },
    });
  });

  const accessToken = signAccessToken({ sub: user.id, organizationId: user.organizationId, role: user.role });
  const refreshValue = generateRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshValue),
      userId: user.id,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  setRefreshCookie(res, refreshValue);
  res.status(201).json({ accessToken, user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const accessToken = signAccessToken({ sub: user.id, organizationId: user.organizationId, role: user.role });
  const refreshValue = generateRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshValue),
      userId: user.id,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  setRefreshCookie(res, refreshValue);
  res.json({ accessToken, user: publicUser(user) });
});

router.post('/refresh', async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }

  const tokenHash = hashToken(raw);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!stored) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  if (stored.revokedAt || stored.expiresAt < new Date()) {
    // This token was already rotated away (or has expired) but is being
    // presented again - either a harmless double-submit, or someone replaying
    // a stolen token. We can't tell which, so we treat it as theft: kill
    // every active session for this user, forcing a fresh login everywhere.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
    res.status(401).json({ error: 'Refresh token reuse detected, please log in again' });
    return;
  }

  const newRefreshValue = generateRefreshTokenValue();
  const newTokenHash = hashToken(newRefreshValue);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: stored.userId,
        expiresAt: refreshTokenExpiryDate(),
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: stored.user.id,
    organizationId: stored.user.organizationId,
    role: stored.user.role,
  });

  setRefreshCookie(res, newRefreshValue);
  res.json({ accessToken });
});

router.post('/logout', async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
  res.status(204).send();
});

const forgotPasswordSchema = z.object({ email: z.string().email() });

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (user) {
    const resetValue = generateRefreshTokenValue();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(resetValue),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    // No email provider is set up (this project stays zero-cost) - log the
    // link so it's usable during local development and demos.
    console.log(`[password reset] http://localhost:5173/reset-password?token=${resetValue}`);
  }

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { token, newPassword } = parsed.data;
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    // Changing the password invalidates every existing session, not just
    // the device making this request.
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.status(200).json({ message: 'Password has been reset' });
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(publicUser(user));
});

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.nativeEnum(Role),
});

// Admin-only: add a teammate directly into the caller's own organization.
// There's no invite-by-email flow yet (out of scope for this phase) - the
// admin sets an initial password and shares it with the teammate directly.
router.post('/users', authenticate, authorize(Role.ADMIN), async (req: AuthenticatedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      organizationId: req.user!.organizationId,
      name,
      email,
      passwordHash,
      role,
    },
  });

  res.status(201).json(publicUser(user));
});

export default router;
