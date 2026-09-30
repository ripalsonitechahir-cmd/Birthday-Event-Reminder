import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { EmptyState, ErrorAlert, Loading } from '../components/common';
import EventRow from '../components/EventRow';
import { formatDate, weekday } from '../format';

const BLANK = { q: '', window: 'all', categoryId: '', personId: '', recurring: '', from: '', to: '', includePast: false, status: '' };

export default function EventList() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(BLANK);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [events, setEvents] = useState(null);
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/people')])
      .then(([c, p]) => { setCategories(c.categories); setPeople(p.people); })
      .catch(setError);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.q), 250);
    return () => clearTimeout(id);
  }, [filters.q]);

  const { q: _q, ...rest } = filters;
  const key = JSON.stringify({ ...rest, q: debouncedQ });
  useEffect(() => {
    let cancelled = false;
    api.get(`/events${qs({ ...rest, q: debouncedQ })}`)
      .then((r) => { if (!cancelled) { setEvents(r.events); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(BLANK);

  // Group by date so events on the same day are visibly together.
  const groups = [];
  (events || []).forEach((e) => {
    const d = e.nextOccurrence || e.eventDate;
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.items.push(e);
    else groups.push({ date: d, items: [e] });
  });

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">All upcoming</h1>
        <Button as={Link} to="/events/new">Add event</Button>
      </div>

      <Card body className="shadow-sm mb-3">
        <Form onSubmit={(e) => e.preventDefault()} role="search" aria-label="Search and filter events">
          <Row className="g-2">
            <Col md={6} lg={4}>
              <Form.Label htmlFor="f-q" className="small mb-1">Search</Form.Label>
              <Form.Control id="f-q" type="search" placeholder="Person, title, category, notes…" value={filters.q} onChange={set('q')} />
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-window" className="small mb-1">When</Form.Label>
              <Form.Select id="f-window" value={filters.window} onChange={set('window')}>
                <option value="all">All upcoming</option>
                <option value="today">Today</option>
                <option value="7">Next 7 days</option>
                <option value="30">Next 30 days</option>
                <option value="90">Next 90 days</option>
              </Form.Select>
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-cat" className="small mb-1">Category</Form.Label>
              <Form.Select id="f-cat" value={filters.categoryId} onChange={set('categoryId')}>
                <option value="">Any</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-person" className="small mb-1">Person</Form.Label>
              <Form.Select id="f-person" value={filters.personId} onChange={set('personId')}>
                <option value="">Anyone</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Form.Select>
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-rec" className="small mb-1">Repeats</Form.Label>
              <Form.Select id="f-rec" value={filters.recurring} onChange={set('recurring')}>
                <option value="">Either</option>
                <option value="true">Recurring</option>
                <option value="false">One-time</option>
              </Form.Select>
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-from" className="small mb-1">From</Form.Label>
              <Form.Control id="f-from" type="date" value={filters.from} onChange={set('from')} />
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-to" className="small mb-1">To</Form.Label>
              <Form.Control id="f-to" type="date" value={filters.to} onChange={set('to')} />
            </Col>
            <Col sm={6} md={3} lg={2}>
              <Form.Label htmlFor="f-status" className="small mb-1">Status</Form.Label>
              <Form.Select id="f-status" value={filters.status} onChange={set('status')}>
                <option value="">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="all">Any</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={4} className="d-flex align-items-end gap-3">
              <Form.Check id="f-past" type="checkbox" label="Include past" checked={filters.includePast} onChange={set('includePast')} />
              {isFiltered && <Button variant="link" size="sm" onClick={() => setFilters(BLANK)}>Clear filters</Button>}
            </Col>
          </Row>
        </Form>
      </Card>

      <ErrorAlert error={error} />
      {!events && !error && <Loading />}
      {events && (
        <div aria-live="polite">
          <div className="small text-muted mb-2">{events.length} {events.length === 1 ? 'event' : 'events'}</div>
          {events.length === 0 ? (
            <Card body className="shadow-sm">
              {isFiltered ? (
                <EmptyState icon="🔍" title="No matching events" action={<Button onClick={() => setFilters(BLANK)}>Reset search and filters</Button>}>
                  Nothing matches your search. Try different words or clear the filters.
                </EmptyState>
              ) : (
                <EmptyState title="No upcoming events" action={<Button as={Link} to="/events/new">Add event</Button>}>
                  Add an event to see it here.
                </EmptyState>
              )}
            </Card>
          ) : groups.map((g) => (
            <section key={g.date} className="mb-3" aria-label={formatDate(g.date, user.dateFormat)}>
              <h2 className="h6 text-muted text-uppercase mb-1">{weekday(g.date)} · {formatDate(g.date, user.dateFormat)}</h2>
              <Card className="shadow-sm overflow-hidden">
                {g.items.map((e) => <EventRow key={e.id} event={e} />)}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
