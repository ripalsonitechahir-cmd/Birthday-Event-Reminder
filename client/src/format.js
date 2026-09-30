const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DATE_FORMATS = ['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const split = (s) => s.split('-').map(Number);

// Formats a YYYY-MM-DD string using the user's preferred format (never unambiguous-numeric by default).
export function formatDate(s, fmt = 'DD MMM YYYY') {
  if (!s) return '';
  const [y, m, d] = split(s);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  switch (fmt) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${y}`;
    case 'MM/DD/YYYY': return `${mm}/${dd}/${y}`;
    case 'YYYY-MM-DD': return s;
    default: return `${dd} ${MONTHS[m - 1]} ${y}`;
  }
}

export function weekday(s) {
  const [y, m, d] = split(s);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function dayAndMonth(s) {
  const [, m, d] = split(s);
  return { day: d, month: MONTHS[m - 1] };
}

export const RECURRENCE_LABELS = { NONE: 'One-time', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };

export function reminderLabel(days) {
  if (days === 0) return 'On the day';
  if (days === 1) return '1 day before';
  if (days === 7) return '1 week before';
  return `${days} days before`;
}

export function timeRange(e) {
  if (e.isAllDay) return 'All day';
  return e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime;
}
