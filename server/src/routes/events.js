const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const dates = require('../domain/dates');
const { RECURRENCES, nextOccurrence, relativeLabel } = require('../domain/recurrence');
const { HttpError, wrap, requireAuth, parse } = require('../middleware/common');

const router = express.Router();
router.use(requireAuth);

const INCLUDE = { person: true, category: true, reminders: { orderBy: { daysBefore: 'asc' } } };

const dateString = (label) => z.string().refine(dates.isValidDateString, `${label} must be a valid date`);
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour) time');
const text = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const eventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  eventDate: dateString('Date'),
  personId: z.string().optional().nullable().transform((v) => v || null),
  categoryId: z.string().optional().nullable().transform((v) => v || null),
  isAllDay: z.boolean().default(true),
  startTime: timeString.optional().nullable().transform((v) => v || null),
  endTime: timeString.optional().nullable().transform((v) => v || null),
  description: text(2000),
  location: text(200),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable().transform((v) => v || null),
  recurrence: z.enum(RECURRENCES).default('NONE'),
  recurrenceEnd: dateString('Recurrence end').optional().nullable().transform((v) => v || null),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  reminders: z.array(z.object({
    daysBefore: z.number().int().min(0, 'Reminder cannot be negative').max(365, 'Reminder is too far ahead'),
    enabled: z.boolean().default(true),
  })).max(10, 'At most 10 reminders per event').default([]),
}).superRefine((v, ctx) => {
  const fail = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (!v.isAllDay) {
    if (!v.startTime) fail('startTime', 'Start time is required for timed events');
    if (v.startTime && v.endTime && v.endTime < v.startTime) fail('endTime', 'End time cannot be earlier than start time');
  }
  if (v.recurrenceEnd) {
    if (v.recurrence === 'NONE') fail('recurrenceEnd', 'Only recurring events can have an end date');
    else if (v.recurrenceEnd < v.eventDate) fail('recurrenceEnd', 'End date cannot be before the event date');
  }
  const days = v.reminders.map((r) => r.daysBefore);
  if (new Set(days).size !== days.length) fail('reminders', 'Duplicate reminder intervals');
});

// Adds computed occurrence info. Returns null occurrence for finished one-time/ended series.
function decorate(event, today) {
  const occ = nextOccurrence(event, today);
  const shown = occ || event.eventDate;
  let age = null;
  if (event.birthYear && event.recurrence === 'YEARLY') age = Number(shown.slice(0, 4)) - event.birthYear;
  return {
    ...event,
    nextOccurrence: occ,
    isPast: !occ,
    daysUntil: occ ? dates.diffDays(today, occ) : null,
    relative: occ ? relativeLabel(occ, today) : 'Past',
    isToday: occ === today,
    age,
  };
}

function byOccurrence(a, b) {
  const da = a.nextOccurrence || a.eventDate;
  const db = b.nextOccurrence || b.eventDate;
  if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
  if (da !== db) return a.isPast ? (da < db ? 1 : -1) : (da < db ? -1 : 1);
  const ta = a.startTime || '';
  const tb = b.startTime || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

// Every relation id must belong to the caller (or be a system/own category).
async function checkRelations(user, data) {
  const fields = {};
  if (data.personId && !(await prisma.person.findFirst({ where: { id: data.personId, userId: user.id } }))) {
    fields.personId = 'Person not found';
  }
  if (data.categoryId && !(await prisma.category.findFirst({
    where: { id: data.categoryId, active: true, OR: [{ userId: null }, { userId: user.id }] },
  }))) {
    fields.categoryId = 'Category not found';
  }
  if (Object.keys(fields).length) throw new HttpError(400, 'Please correct the highlighted fields', fields);
}

async function ownedEvent(userId, id) {
  const event = await prisma.event.findFirst({ where: { id, userId }, include: INCLUDE });
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

function toDbData(data) {
  const { reminders, ...rest } = data;
  if (rest.isAllDay) { rest.startTime = null; rest.endTime = null; }
  if (rest.recurrence !== 'YEARLY') rest.birthYear = null;
  return { rest, reminders };
}

const todayFor = (user) => dates.todayInZone(user.timeZone);

router.get('/', wrap(async (req, res) => {
  const today = todayFor(req.user);
  const { q, categoryId, personId, recurring, status, window: win = 'all', from, to, includePast } = req.query;

  const where = { userId: req.user.id };
  if (categoryId) where.categoryId = String(categoryId);
  if (personId) where.personId = String(personId);
  if (recurring === 'true') where.recurrence = { not: 'NONE' };
  if (recurring === 'false') where.recurrence = 'NONE';
  if (status !== 'all') where.status = status ? String(status) : 'ACTIVE';
  const term = String(q || '').trim();
  if (term) {
    where.OR = [
      { title: { contains: term } },
      { description: { contains: term } },
      { location: { contains: term } },
      { person: { name: { contains: term } } },
      { person: { nickname: { contains: term } } },
      { category: { name: { contains: term } } },
    ];
  }

  let events = (await prisma.event.findMany({ where, include: INCLUDE })).map((e) => decorate(e, today));

  if (includePast !== 'true') events = events.filter((e) => !e.isPast);

  let start = from && dates.isValidDateString(String(from)) ? String(from) : null;
  let end = to && dates.isValidDateString(String(to)) ? String(to) : null;
  if (win === 'today') end = today;
  else if (win === '7') end = dates.addDays(today, 7);
  else if (win === '30') end = dates.addDays(today, 30);
  else if (win === '90') end = dates.addDays(today, 90);
  if (start || end) {
    events = events.filter((e) => {
      const d = e.nextOccurrence || e.eventDate;
      return (!start || d >= start) && (!end || d <= end);
    });
  }

  events.sort(byOccurrence);
  res.json({ today, events });
}));

router.get('/next', wrap(async (req, res) => {
  const today = todayFor(req.user);
  const events = (await prisma.event.findMany({ where: { userId: req.user.id, status: 'ACTIVE' }, include: INCLUDE }))
    .map((e) => decorate(e, today))
    .filter((e) => !e.isPast)
    .sort(byOccurrence);
  const next = events[0] || null;
  // Everything sharing the soonest date, so ties are shown together.
  const sameDay = next ? events.filter((e) => e.nextOccurrence === next.nextOccurrence) : [];
  res.json({ today, next, sameDay });
}));

router.get('/:id', wrap(async (req, res) => {
  const event = await ownedEvent(req.user.id, req.params.id);
  res.json({ event: decorate(event, todayFor(req.user)) });
}));

router.post('/', wrap(async (req, res) => {
  const data = parse(eventSchema, req.body);
  await checkRelations(req.user, data);
  const { rest, reminders } = toDbData(data);
  const event = await prisma.event.create({
    data: { ...rest, userId: req.user.id, reminders: { create: reminders } },
    include: INCLUDE,
  });
  res.status(201).json({ event: decorate(event, todayFor(req.user)) });
}));

router.put('/:id', wrap(async (req, res) => {
  await ownedEvent(req.user.id, req.params.id);
  const data = parse(eventSchema, req.body);
  await checkRelations(req.user, data);
  const { rest, reminders } = toDbData(data);
  const event = await prisma.$transaction(async (tx) => {
    // Replace reminders; notifications already sent for removed ones are cascaded away.
    await tx.reminder.deleteMany({ where: { eventId: req.params.id } });
    return tx.event.update({
      where: { id: req.params.id },
      data: { ...rest, reminders: { create: reminders } },
      include: INCLUDE,
    });
  });
  res.json({ event: decorate(event, todayFor(req.user)) });
}));

router.post('/:id/duplicate', wrap(async (req, res) => {
  const src = await ownedEvent(req.user.id, req.params.id);
  const copy = await prisma.event.create({
    data: {
      userId: req.user.id,
      personId: src.personId,
      categoryId: src.categoryId,
      title: `${src.title} (copy)`.slice(0, 150),
      eventDate: src.eventDate,
      startTime: src.startTime,
      endTime: src.endTime,
      isAllDay: src.isAllDay,
      description: src.description,
      location: src.location,
      birthYear: src.birthYear,
      recurrence: src.recurrence,
      recurrenceEnd: src.recurrenceEnd,
      reminders: { create: src.reminders.map((r) => ({ daysBefore: r.daysBefore, enabled: r.enabled })) },
    },
    include: INCLUDE,
  });
  res.status(201).json({ event: decorate(copy, todayFor(req.user)) });
}));

// Ends a recurring series before the given date; earlier occurrences are left untouched.
router.post('/:id/stop-recurrence', wrap(async (req, res) => {
  const event = await ownedEvent(req.user.id, req.params.id);
  if (event.recurrence === 'NONE') throw new HttpError(400, 'This event does not repeat');
  const { from } = parse(z.object({ from: dateString('Date') }), req.body);
  if (from <= event.eventDate) throw new HttpError(400, 'Choose a date after the first occurrence, or delete the event instead');
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { recurrenceEnd: dates.addDays(from, -1) },
    include: INCLUDE,
  });
  res.json({ event: decorate(updated, todayFor(req.user)) });
}));

router.delete('/:id', wrap(async (req, res) => {
  await ownedEvent(req.user.id, req.params.id);
  await prisma.event.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
