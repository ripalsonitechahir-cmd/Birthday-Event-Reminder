const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../db');
const config = require('../config');
const { isValidTimeZone } = require('../domain/dates');
const { HttpError, wrap, signToken, requireAuth, parse } = require('../middleware/common');

const router = express.Router();

// Brute-force protection for credential-sensitive endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const timeZone = z.string().refine(isValidTimeZone, 'Unknown time zone');

const publicUser = (u) => ({
  id: u.id,
  displayName: u.displayName,
  email: u.email,
  timeZone: u.timeZone,
  dateFormat: u.dateFormat,
  firstDayOfWeek: u.firstDayOfWeek,
  remindersEnabled: u.remindersEnabled,
});

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

router.post('/register', authLimiter, wrap(async (req, res) => {
  const data = parse(z.object({
    displayName: z.string().trim().min(1, 'Name is required').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password,
    timeZone: timeZone.optional(),
  }), req.body);

  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new HttpError(409, 'An account with this email already exists', { email: 'Email already registered' });
  }
  const user = await prisma.user.create({
    data: {
      displayName: data.displayName,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      timeZone: data.timeZone || 'UTC',
    },
  });
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}));

router.post('/login', authLimiter, wrap(async (req, res) => {
  const data = parse(z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
  }), req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

// Access recovery. There is no email channel in the first release, so outside production
// the reset token is returned (and logged) to make the flow usable during development.
router.post('/forgot-password', authLimiter, wrap(async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address') }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const response = { message: 'If that account exists, a reset link has been generated.' };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) },
    });
    if (!config.isProd) {
      console.log(`[dev] Password reset token for ${email}: ${token}`);
      response.devResetToken = token;
    }
  }
  res.json(response);
}));

router.post('/reset-password', authLimiter, wrap(async (req, res) => {
  const data = parse(z.object({ token: z.string().min(1, 'Reset token is required'), password }), req.body);
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashToken(data.token), resetTokenExpires: { gt: new Date() } },
  });
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(data.password, 10), resetTokenHash: null, resetTokenExpires: null },
  });
  res.json({ message: 'Password updated. You can now sign in.' });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/me', requireAuth, wrap(async (req, res) => {
  const data = parse(z.object({
    displayName: z.string().trim().min(1, 'Name is required').max(80).optional(),
    timeZone: timeZone.optional(),
    dateFormat: z.enum(['DD MMM YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    firstDayOfWeek: z.number().int().min(0).max(6).optional(),
    remindersEnabled: z.boolean().optional(),
  }), req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
}));

// Sensitive operation: requires the current password.
router.post('/change-password', requireAuth, authLimiter, wrap(async (req, res) => {
  const data = parse(z.object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: password }), req.body);
  if (!(await bcrypt.compare(data.currentPassword, req.user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect', { currentPassword: 'Incorrect password' });
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(data.newPassword, 10) } });
  res.json({ message: 'Password changed' });
}));

module.exports = router;
