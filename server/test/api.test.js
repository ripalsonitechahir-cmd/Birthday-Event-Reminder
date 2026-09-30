const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Isolated database for the test run.
const dbFile = path.join(__dirname, '..', 'prisma', 'test.db');
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret';
for (const f of [dbFile, `${dbFile}-journal`]) fs.rmSync(f, { force: true });
execFileSync(process.execPath, [path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--skip-generate'], {
  cwd: path.join(__dirname, '..'), env: process.env, stdio: 'ignore',
});

const prisma = require('../src/db');
const app = require('../src/app');
const dates = require('../src/domain/dates');
const { processReminders } = require('../src/jobs/reminders');

let server;
let base;

test.before(async () => {
  await prisma.category.create({ data: { name: 'Birthday' } });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  fs.rmSync(dbFile, { force: true });
});

async function call(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(email) {
  const r = await call('POST', '/auth/register', { displayName: email.split('@')[0], email, password: 'password123', timeZone: 'UTC' });
  assert.equal(r.status, 201);
  return r.body.token;
}

const today = () => dates.todayInZone('UTC');

test('auth: register, login, wrong password, validation', async () => {
  await register('a@example.com');
  assert.equal((await call('POST', '/auth/register', { displayName: 'x', email: 'a@example.com', password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { email: 'a@example.com', password: 'nope' })).status, 401);
  const ok = await call('POST', '/auth/login', { email: 'a@example.com', password: 'password123' });
  assert.equal(ok.status, 200);
  const bad = await call('POST', '/auth/register', { displayName: '', email: 'bad', password: 'short' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fields.email && bad.body.fields.password && bad.body.fields.displayName);
  assert.equal((await call('GET', '/events')).status, 401);
});

test('events: validation rules', async () => {
  const t = await register('validate@example.com');
  const r = await call('POST', '/events', { title: '', eventDate: '2026-02-30' }, t);
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.title && r.body.fields.eventDate);
  const times = await call('POST', '/events', { title: 'x', eventDate: today(), isAllDay: false, startTime: '10:00', endTime: '09:00' }, t);
  assert.ok(times.body.fields.endTime);
  const rec = await call('POST', '/events', { title: 'x', eventDate: today(), recurrence: 'NONE', recurrenceEnd: today() }, t);
  assert.ok(rec.body.fields.recurrenceEnd);
});

test('upcoming: ordered chronologically, next event first, yearly rolls forward', async () => {
  const t = await register('order@example.com');
  const d = (n) => dates.addDays(today(), n);
  await call('POST', '/events', { title: 'Later', eventDate: d(20) }, t);
  await call('POST', '/events', { title: 'Soon', eventDate: d(2) }, t);
  await call('POST', '/events', { title: 'Yesterday one-time', eventDate: d(-1) }, t);
  const past = dates.addDays(today(), -1);
  await call('POST', '/events', { title: 'Old birthday', eventDate: `1990${past.slice(4)}`, recurrence: 'YEARLY', birthYear: 1990 }, t);

  const list = await call('GET', '/events', null, t);
  assert.deepEqual(list.body.events.map((e) => e.title), ['Soon', 'Later', 'Old birthday']);
  const bday = list.body.events.find((e) => e.title === 'Old birthday');
  assert.ok(bday.nextOccurrence > today());
  assert.ok(bday.age >= 36);

  const next = await call('GET', '/events/next', null, t);
  assert.equal(next.body.next.title, 'Soon');
  assert.equal(next.body.next.relative, 'in 2 days');

  const week = await call('GET', '/events?window=7', null, t);
  assert.deepEqual(week.body.events.map((e) => e.title), ['Soon']);
  const search = await call('GET', '/events?q=later', null, t);
  assert.deepEqual(search.body.events.map((e) => e.title), ['Later']);
  const withPast = await call('GET', '/events?includePast=true', null, t);
  assert.equal(withPast.body.events.at(-1).title, 'Yesterday one-time');
});

test('isolation: users cannot read or change each other’s data', async () => {
  const a = await register('owner@example.com');
  const b = await register('intruder@example.com');
  const ev = (await call('POST', '/events', { title: 'Private', eventDate: today() }, a)).body.event;
  const person = (await call('POST', '/people', { name: 'Secret Friend' }, a)).body.person;

  assert.equal((await call('GET', `/events/${ev.id}`, null, b)).status, 404);
  assert.equal((await call('PUT', `/events/${ev.id}`, { title: 'Hacked', eventDate: today() }, b)).status, 404);
  assert.equal((await call('DELETE', `/events/${ev.id}`, null, b)).status, 404);
  assert.equal((await call('GET', `/people/${person.id}`, null, b)).status, 404);
  assert.equal((await call('DELETE', `/people/${person.id}`, null, b)).status, 404);
  assert.equal((await call('POST', '/events', { title: 'Link', eventDate: today(), personId: person.id }, b)).status, 400);
  assert.equal((await call('GET', '/events', null, b)).body.events.length, 0);
  assert.equal((await call('GET', `/events/${ev.id}`, null, a)).status, 200);
});

test('people: deleting keeps linked events by default, can delete them', async () => {
  const t = await register('people@example.com');
  const p1 = (await call('POST', '/people', { name: 'Keep' }, t)).body.person;
  const p2 = (await call('POST', '/people', { name: 'Drop' }, t)).body.person;
  await call('POST', '/events', { title: 'Kept event', eventDate: today(), personId: p1.id }, t);
  await call('POST', '/events', { title: 'Dropped event', eventDate: today(), personId: p2.id }, t);
  assert.equal((await call('DELETE', `/people/${p1.id}`, null, t)).status, 204);
  assert.equal((await call('DELETE', `/people/${p2.id}?deleteEvents=true`, null, t)).status, 204);
  const titles = (await call('GET', '/events', null, t)).body.events.map((e) => e.title);
  assert.deepEqual(titles, ['Kept event']);
});

test('reminders: generated once per occurrence, respect global switch', async () => {
  const t = await register('remind@example.com');
  const ev = (await call('POST', '/events', {
    title: 'Anniversary', eventDate: dates.addDays(today(), 1), reminders: [{ daysBefore: 1 }, { daysBefore: 7 }],
  }, t)).body.event;
  assert.equal(ev.reminders.length, 2);

  const first = await processReminders();
  const second = await processReminders();
  assert.equal(first, 2);
  assert.equal(second, 0);
  const inbox = await call('GET', '/notifications', null, t);
  assert.equal(inbox.body.notifications.length, 2);
  assert.equal(inbox.body.unread, 2);

  await call('POST', '/notifications/read-all', null, t);
  assert.equal((await call('GET', '/notifications', null, t)).body.unread, 0);

  // Reminder not yet due, and globally disabled users get nothing.
  await call('POST', '/events', { title: 'Far', eventDate: dates.addDays(today(), 30), reminders: [{ daysBefore: 1 }] }, t);
  assert.equal(await processReminders(), 0);
  await call('PUT', '/auth/me', { remindersEnabled: false }, t);
  await call('POST', '/events', { title: 'Tomorrow again', eventDate: dates.addDays(today(), 1), reminders: [{ daysBefore: 1 }] }, t);
  assert.equal(await processReminders(), 0);
});

test('recurrence: stop from a date keeps earlier occurrences', async () => {
  const t = await register('stop@example.com');
  const ev = (await call('POST', '/events', { title: 'Weekly', eventDate: dates.addDays(today(), -14), recurrence: 'WEEKLY' }, t)).body.event;
  const stopFrom = dates.addDays(today(), 30);
  const r = await call('POST', `/events/${ev.id}/stop-recurrence`, { from: stopFrom }, t);
  assert.equal(r.status, 200);
  assert.equal(r.body.event.recurrenceEnd, dates.addDays(stopFrom, -1));
  assert.ok(r.body.event.nextOccurrence <= r.body.event.recurrenceEnd);
});
