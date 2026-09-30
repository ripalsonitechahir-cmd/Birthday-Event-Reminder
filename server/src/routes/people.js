const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const { HttpError, wrap, requireAuth, parse } = require('../middleware/common');

const router = express.Router();
router.use(requireAuth);

const optional = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const personSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  nickname: optional(60),
  relationship: optional(60),
  email: z.string().trim().max(200).optional().nullable()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email address')
    .transform((v) => v || null),
  phone: optional(40),
  notes: optional(2000),
});

async function ownedPerson(userId, id) {
  const person = await prisma.person.findFirst({ where: { id, userId } });
  if (!person) throw new HttpError(404, 'Person not found');
  return person;
}

router.get('/', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const people = await prisma.person.findMany({
    where: {
      userId: req.user.id,
      ...(q && { OR: [{ name: { contains: q } }, { nickname: { contains: q } }, { relationship: { contains: q } }] }),
    },
    include: { _count: { select: { events: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ people });
}));

router.post('/', wrap(async (req, res) => {
  const data = parse(personSchema, req.body);
  const person = await prisma.person.create({ data: { ...data, userId: req.user.id } });
  res.status(201).json({ person });
}));

router.get('/:id', wrap(async (req, res) => {
  await ownedPerson(req.user.id, req.params.id);
  const person = await prisma.person.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { events: { include: { category: true }, orderBy: { eventDate: 'asc' } } },
  });
  res.json({ person });
}));

router.put('/:id', wrap(async (req, res) => {
  await ownedPerson(req.user.id, req.params.id);
  const data = parse(personSchema, req.body);
  const person = await prisma.person.update({ where: { id: req.params.id }, data });
  res.json({ person });
}));

// By default linked events are kept as independent records; ?deleteEvents=true removes them too.
router.delete('/:id', wrap(async (req, res) => {
  await ownedPerson(req.user.id, req.params.id);
  const deleteEvents = req.query.deleteEvents === 'true';
  await prisma.$transaction([
    ...(deleteEvents ? [prisma.event.deleteMany({ where: { personId: req.params.id, userId: req.user.id } })] : []),
    prisma.person.delete({ where: { id: req.params.id } }),
  ]);
  res.status(204).end();
}));

module.exports = router;
