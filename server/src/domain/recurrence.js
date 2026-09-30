const dates = require('./dates');

const RECURRENCES = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'];

// Product rule: a 29 February event falls on 28 February in non-leap years.
function yearlyOn(startMonth, startDay, year) {
  if (startMonth === 2 && startDay === 29 && !dates.isLeapYear(year)) return dates.format(year, 2, 28);
  return dates.format(year, startMonth, startDay);
}

// Monthly events on the 29th-31st fall on the last day of shorter months.
function monthlyOn(startDay, year, month) {
  return dates.format(year, month, Math.min(startDay, dates.daysInMonth(year, month)));
}

/**
 * Next occurrence on or after `from` (YYYY-MM-DD) of an event series, or null when none remains.
 * event: { eventDate, recurrence, recurrenceEnd }
 */
function nextOccurrence(event, from) {
  const { eventDate, recurrence = 'NONE', recurrenceEnd = null } = event;
  const start = dates.parse(eventDate);
  const floor = eventDate > from ? eventDate : from;
  let result = null;

  if (recurrence === 'NONE') {
    result = eventDate >= from ? eventDate : null;
  } else if (recurrence === 'WEEKLY') {
    const steps = Math.ceil(dates.diffDays(eventDate, floor) / 7);
    result = dates.addDays(eventDate, Math.max(0, steps) * 7);
  } else if (recurrence === 'MONTHLY') {
    let { y, m } = dates.parse(floor);
    for (let i = 0; i < 14; i++) {
      const candidate = monthlyOn(start.d, y, m);
      if (candidate >= floor) { result = candidate; break; }
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  } else if (recurrence === 'YEARLY') {
    const { y } = dates.parse(floor);
    for (let i = 0; i < 3; i++) {
      const candidate = yearlyOn(start.m, start.d, y + i);
      if (candidate >= floor) { result = candidate; break; }
    }
  }

  if (result && recurrenceEnd && result > recurrenceEnd) return null;
  return result;
}

// Human-friendly relative label for an occurrence relative to today.
function relativeLabel(occurrence, today) {
  const n = dates.diffDays(today, occurrence);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `in ${n} days`;
  if (n === -1) return 'Yesterday';
  return `${-n} days ago`;
}

module.exports = { RECURRENCES, nextOccurrence, relativeLabel };
