const express = require('express');
const prisma = require('../db');
const { HttpError, wrap, requireAuth } = require('../middleware/common');

const categories = express.Router();
categories.use(requireAuth);

categories.get('/', wrap(async (req, res) => {
  const list = await prisma.category.findMany({
    where: { active: true, OR: [{ userId: null }, { userId: req.user.id }] },
    orderBy: { name: 'asc' },
  });
  res.json({ categories: list });
}));

const notifications = express.Router();
notifications.use(requireAuth);

notifications.get('/', wrap(async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  res.json({ notifications: items, unread });
}));

notifications.post('/read-all', wrap(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
}));

notifications.post('/:id/read', wrap(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0 && !(await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } }))) {
    throw new HttpError(404, 'Notification not found');
  }
  res.status(204).end();
}));

module.exports = { categories, notifications };
