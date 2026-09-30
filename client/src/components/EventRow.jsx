import { Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { dayAndMonth, formatDate, RECURRENCE_LABELS, timeRange, weekday } from '../format';

const CATEGORY_ICONS = { Birthday: '🎂', Anniversary: '💍', Appointment: '📅', Holiday: '🎉', Meeting: '👥', Reminder: '⏰' };

export const iconFor = (event) => CATEGORY_ICONS[event.category?.name] || '📌';

export function EventTags({ event }) {
  return (
    <>
      <Badge bg="secondary" className="me-1">{event.category?.name || 'Event'}</Badge>
      {event.recurrence !== 'NONE' && <Badge bg="info" text="dark" className="me-1">↻ {RECURRENCE_LABELS[event.recurrence]}</Badge>}
      {event.reminders?.some((r) => r.enabled) && <Badge bg="light" text="dark" className="border me-1">🔔 Reminder</Badge>}
      {event.status !== 'ACTIVE' && <Badge bg="dark" className="me-1">{event.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}</Badge>}
    </>
  );
}

export default function EventRow({ event }) {
  const { user } = useAuth();
  const date = event.nextOccurrence || event.eventDate;
  const { day, month } = dayAndMonth(date);
  return (
    <div className={`event-row d-flex align-items-center gap-3 p-3 border-bottom ${event.isToday ? 'is-today' : ''}`}>
      <div className="date-chip rounded border bg-white p-2">
        <div className="day">{day}</div>
        <div className="month">{month}</div>
      </div>
      <div className="flex-grow-1">
        <div className="stretched-title fw-semibold">
          <span aria-hidden="true">{iconFor(event)} </span>
          <Link to={`/events/${event.id}`}>{event.title}</Link>
          {event.age > 0 && <span className="text-muted fw-normal"> · turns {event.age}</span>}
        </div>
        <div className="small text-muted">
          {weekday(date)}, {formatDate(date, user.dateFormat)} · {timeRange(event)}
          {event.person && <> · <Link to={`/people/${event.person.id}`}>{event.person.name}</Link></>}
        </div>
        <div className="mt-1"><EventTags event={event} /></div>
      </div>
      <div className="text-end">
        <Badge bg={event.isToday ? 'warning' : event.isPast ? 'secondary' : 'primary'} text={event.isToday ? 'dark' : undefined}>
          {event.relative}
        </Badge>
      </div>
    </div>
  );
}
