import { useEffect, useState } from 'react';
import { Alert, Button, ButtonGroup, Card } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { EmptyState, ErrorAlert, Loading } from '../components/common';
import EventRow, { EventTags, iconFor } from '../components/EventRow';
import { formatDate, timeRange, weekday } from '../format';

const WINDOWS = [
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Next 7 days' },
  { key: '30', label: 'Next 30 days' },
  { key: 'all', label: 'All upcoming' },
];

function NextUp({ next, sameDay }) {
  const { user } = useAuth();
  const date = next.nextOccurrence;
  return (
    <Card className="next-up-card shadow-sm mb-4" aria-labelledby="next-up-heading">
      <Card.Body>
        <div id="next-up-heading" className="text-uppercase text-primary fw-bold small mb-2">Next up</div>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h2 className="h3 mb-1">
              <span aria-hidden="true">{iconFor(next)} </span>
              <Link to={`/events/${next.id}`} className="text-decoration-none text-reset">{next.title}</Link>
            </h2>
            <div className="text-muted">
              {weekday(date)}, {formatDate(date, user.dateFormat)} · {timeRange(next)}
              {next.age > 0 && <> · turns {next.age}</>}
            </div>
            <div className="mt-2"><EventTags event={next} /></div>
          </div>
          <div className={`fs-4 fw-bold ${next.isToday ? 'text-warning-emphasis' : 'text-primary'}`}>{next.relative}</div>
        </div>
        {sameDay.length > 1 && (
          <div className="mt-3 pt-3 border-top small">
            Also on the same day: {sameDay.filter((e) => e.id !== next.id).map((e, i) => (
              <span key={e.id}>{i > 0 && ', '}<Link to={`/events/${e.id}`}>{e.title}</Link></span>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default function Dashboard() {
  const flash = useLocation().state?.flash;
  const [win, setWin] = useState('30');
  const [next, setNext] = useState(null);
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/events/next').then(setNext).catch(setError);
  }, []);
  useEffect(() => {
    let cancelled = false;
    api.get(`/events${qs({ window: win })}`)
      .then((r) => { if (!cancelled) setList(r.events); })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [win]);

  if (error) return <ErrorAlert error={error} />;
  if (!next || !list) return <Loading />;

  const firstUse = !next.next;

  return (
    <>
      {flash && <Alert variant="success" dismissible role="status">{flash}</Alert>}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <Button as={Link} to="/events/new?type=birthday">🎂 Add Birthday</Button>
        <Button as={Link} to="/events/new" variant="outline-primary">📅 Add Event</Button>
        <Button as={Link} to="/people" variant="outline-secondary">👤 People</Button>
        <Button as={Link} to="/events" variant="outline-secondary">All upcoming</Button>
      </div>

      {firstUse ? (
        <Card body className="shadow-sm">
          <EmptyState
            icon="🎂"
            title="Nothing coming up yet"
            action={<Button as={Link} to="/events/new?type=birthday">Add your first birthday</Button>}
          >
            Save birthdays, anniversaries and appointments, and this page will always show what's next.
          </EmptyState>
        </Card>
      ) : (
        <>
          {next.next && <NextUp next={next.next} sameDay={next.sameDay} />}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
            <h2 className="h5 mb-0">Upcoming</h2>
            <ButtonGroup size="sm" aria-label="Time window">
              {WINDOWS.map((w) => (
                <Button key={w.key} variant={win === w.key ? 'primary' : 'outline-primary'} onClick={() => setWin(w.key)} aria-pressed={win === w.key}>
                  {w.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
          <Card className="shadow-sm overflow-hidden">
            {list.length === 0
              ? <EmptyState title="Nothing in this period">Try a wider time window.</EmptyState>
              : list.map((e) => <EventRow key={e.id} event={e} />)}
          </Card>
        </>
      )}
    </>
  );
}
