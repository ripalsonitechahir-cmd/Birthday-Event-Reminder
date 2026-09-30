const test = require('node:test');
const assert = require('node:assert/strict');
const { nextOccurrence, relativeLabel } = require('../src/domain/recurrence');
const dates = require('../src/domain/dates');

const ev = (eventDate, recurrence = 'NONE', recurrenceEnd = null) => ({ eventDate, recurrence, recurrenceEnd });

test('one-time: today counts, past is null', () => {
  assert.equal(nextOccurrence(ev('2026-09-30'), '2026-09-30'), '2026-09-30');
  assert.equal(nextOccurrence(ev('2026-09-29'), '2026-09-30'), null);
  assert.equal(nextOccurrence(ev('2030-01-01'), '2026-09-30'), '2030-01-01');
});

test('yearly: birthday yesterday rolls to next year', () => {
  assert.equal(nextOccurrence(ev('1990-09-29', 'YEARLY'), '2026-09-30'), '2027-09-29');
  assert.equal(nextOccurrence(ev('1990-09-30', 'YEARLY'), '2026-09-30'), '2026-09-30');
  assert.equal(nextOccurrence(ev('1990-10-02', 'YEARLY'), '2026-09-30'), '2026-10-02');
});

test('yearly: year boundary', () => {
  assert.equal(nextOccurrence(ev('2000-01-05', 'YEARLY'), '2026-12-31'), '2027-01-05');
  assert.equal(nextOccurrence(ev('2000-12-31', 'YEARLY'), '2026-12-31'), '2026-12-31');
});

test('yearly: series does not start before its first date', () => {
  assert.equal(nextOccurrence(ev('2030-03-15', 'YEARLY'), '2026-01-01'), '2030-03-15');
});

test('yearly: leap day falls on 28 Feb in non-leap years', () => {
  const e = ev('2000-02-29', 'YEARLY');
  assert.equal(nextOccurrence(e, '2026-01-01'), '2026-02-28');
  assert.equal(nextOccurrence(e, '2027-03-01'), '2028-02-29');
  assert.equal(nextOccurrence(e, '2028-02-29'), '2028-02-29');
});

test('monthly: clamps to month end and crosses year', () => {
  const e = ev('2026-01-31', 'MONTHLY');
  assert.equal(nextOccurrence(e, '2026-02-01'), '2026-02-28');
  assert.equal(nextOccurrence(e, '2026-04-15'), '2026-04-30');
  assert.equal(nextOccurrence(ev('2026-11-10', 'MONTHLY'), '2026-12-11'), '2027-01-10');
});

test('weekly: steps of seven days from the start date', () => {
  const e = ev('2026-09-01', 'WEEKLY');
  assert.equal(nextOccurrence(e, '2026-09-01'), '2026-09-01');
  assert.equal(nextOccurrence(e, '2026-09-02'), '2026-09-08');
  assert.equal(nextOccurrence(e, '2026-09-30'), '2026-10-06');
  assert.equal(nextOccurrence(ev('2027-01-05', 'WEEKLY'), '2026-09-30'), '2027-01-05');
});

test('recurrence end stops the series', () => {
  const e = ev('2020-05-01', 'YEARLY', '2026-12-31');
  assert.equal(nextOccurrence(e, '2026-06-01'), null);
  assert.equal(nextOccurrence(e, '2026-04-01'), '2026-05-01');
});

test('date helpers', () => {
  assert.equal(dates.isValidDateString('2026-02-29'), false);
  assert.equal(dates.isValidDateString('2028-02-29'), true);
  assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dates.diffDays('2026-09-30', '2026-10-02'), 2);
  assert.equal(dates.todayInZone('Pacific/Kiritimati', new Date('2026-09-30T12:00:00Z')), '2026-10-01');
  assert.equal(dates.todayInZone('Pacific/Pago_Pago', new Date('2026-09-30T05:00:00Z')), '2026-09-29');
});

test('relative labels', () => {
  assert.equal(relativeLabel('2026-09-30', '2026-09-30'), 'Today');
  assert.equal(relativeLabel('2026-10-01', '2026-09-30'), 'Tomorrow');
  assert.equal(relativeLabel('2026-10-05', '2026-09-30'), 'in 5 days');
});
