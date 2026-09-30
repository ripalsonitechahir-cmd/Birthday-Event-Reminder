const cron = require('node-cron');
const prisma = require('../db');
const dates = require('../domain/dates');
const { nextOccurrence, relativeLabel } = require('../domain/recurrence');

/**
 * Creates in-app notifications for reminders that are due.
 * A reminder is due once today (in the owner's time zone) is on/after
 * `occurrence - daysBefore` and the occurrence has not passed. The unique
 * (reminderId, occurrenceDate) constraint makes this safe to run repeatedly:
 * a reminder is delivered at most once per occurrence, and a failed run is
 * simply retried on the next tick without touching the event itself.
 */
async function processReminders(now = new Date()) {
  const reminders = await prisma.reminder.findMany({
    where: { enabled: true, event: { status: 'ACTIVE', user: { remindersEnabled: true } } },
    include: { event: { include: { user: true, person: true } } },
  });

  let created = 0;
  for (const reminder of reminders) {
    const { event } = reminder;
    try {
      const today = dates.todayInZone(event.user.timeZone, now);
      const occurrence = nextOccurrence(event, today);
      if (!occurrence) continue;
      if (today < dates.addDays(occurrence, -reminder.daysBefore)) continue;

      const when = relativeLabel(occurrence, today);
      await prisma.notification.create({
        data: {
          userId: event.userId,
          reminderId: reminder.id,
          eventId: event.id,
          occurrenceDate: occurrence,
          title: event.title,
          message: `${event.title} — ${when === 'Today' || when === 'Tomorrow' ? when.toLowerCase() : when} (${occurrence})`,
        },
      });
      created += 1;
    } catch (err) {
      if (err.code === 'P2002') continue; // already delivered for this occurrence
      console.error(`[reminders] failed for reminder ${reminder.id}: ${err.message}`);
    }
  }
  return created;
}

function startReminderJob() {
  processReminders().catch((e) => console.error('[reminders] initial run failed:', e.message));
  return cron.schedule('*/15 * * * *', () => {
    processReminders().catch((e) => console.error('[reminders] run failed:', e.message));
  });
}

module.exports = { processReminders, startReminderJob };
