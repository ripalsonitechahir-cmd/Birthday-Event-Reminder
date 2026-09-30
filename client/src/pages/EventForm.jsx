import { useEffect, useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Col, Form, Row } from 'react-bootstrap';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorAlert, Field, Loading } from '../components/common';
import ReminderPicker from '../components/ReminderPicker';
import { MONTH_NAMES, RECURRENCE_LABELS } from '../format';

const daysIn = (month, year) => new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();

const blankEvent = (personId = '') => ({
  title: '', eventDate: '', personId, categoryId: '', isAllDay: true, startTime: '', endTime: '',
  description: '', location: '', birthYear: '', recurrence: 'NONE', recurrenceEnd: '', status: 'ACTIVE', reminders: [],
});

function fromEvent(e) {
  return {
    title: e.title, eventDate: e.eventDate, personId: e.personId || '', categoryId: e.categoryId || '',
    isAllDay: e.isAllDay, startTime: e.startTime || '', endTime: e.endTime || '', description: e.description || '',
    location: e.location || '', birthYear: e.birthYear || '', recurrence: e.recurrence, recurrenceEnd: e.recurrenceEnd || '',
    status: e.status, reminders: e.reminders.filter((r) => r.enabled).map((r) => r.daysBefore),
  };
}

function toPayload(v) {
  return {
    title: v.title,
    eventDate: v.eventDate,
    personId: v.personId || null,
    categoryId: v.categoryId || null,
    isAllDay: v.isAllDay,
    startTime: v.isAllDay ? null : v.startTime || null,
    endTime: v.isAllDay ? null : v.endTime || null,
    description: v.description || null,
    location: v.location || null,
    birthYear: v.recurrence === 'YEARLY' && v.birthYear ? Number(v.birthYear) : null,
    recurrence: v.recurrence,
    recurrenceEnd: v.recurrence !== 'NONE' && v.recurrenceEnd ? v.recurrenceEnd : null,
    status: v.status,
    reminders: v.reminders.map((d) => ({ daysBefore: d, enabled: true })),
  };
}

function PersonSelect({ id, people, value, onChange, allowNew, label = 'Person' }) {
  return (
    <Field id={id} label={label}>
      <Form.Select value={value} onChange={onChange}>
        <option value="">{allowNew ? 'Choose a person…' : 'None'}</option>
        {allowNew && <option value="__new">+ New person</option>}
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Form.Select>
    </Field>
  );
}

function BirthdayForm({ people, categories, initialPersonId, onSaved }) {
  const [personId, setPersonId] = useState(initialPersonId || '');
  const [newName, setNewName] = useState('');
  const [createdPerson, setCreatedPerson] = useState(null);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState('');
  const [reminders, setReminders] = useState([1]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields || {};

  const maxDay = daysIn(month, year ? Number(year) : 2000);
  useEffect(() => { if (day > maxDay) setDay(maxDay); }, [maxDay, day]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let person = createdPerson || people.find((p) => p.id === personId);
      if (personId === '__new' && !createdPerson) {
        if (!newName.trim()) throw Object.assign(new Error('Enter the person\'s name'), { fields: { newName: 'Name is required' } });
        person = (await api.post('/people', { name: newName })).person;
        setCreatedPerson(person); // reused if the event save fails and the user retries
      }
      if (!person) throw Object.assign(new Error('Choose a person'), { fields: { personId: 'Choose a person or add a new one' } });
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const payload = toPayload({
        ...blankEvent(person.id),
        title: `${person.name}'s Birthday`,
        eventDate: `${year || 2000}-${mm}-${dd}`,
        categoryId: categories.find((c) => c.name === 'Birthday')?.id || '',
        recurrence: 'YEARLY',
        birthYear: year,
        reminders,
      });
      const { event } = await api.post('/events', payload);
      onSaved(event);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const showNew = personId === '__new' || createdPerson;
  return (
    <Form onSubmit={submit} noValidate>
      <ErrorAlert error={error && !Object.keys(fields).length ? error : null} />
      <PersonSelect id="bd-person" people={createdPerson ? [createdPerson, ...people] : people} allowNew={!createdPerson}
        value={createdPerson ? createdPerson.id : personId}
        onChange={(e) => setPersonId(e.target.value)} />
      {fields.personId && <div className="text-danger small mb-3">{fields.personId}</div>}
      {showNew && !createdPerson && (
        <Field id="bd-name" label="New person's name" error={fields.newName}>
          <Form.Control value={newName} onChange={(e) => setNewName(e.target.value)} isInvalid={!!fields.newName} autoFocus />
        </Field>
      )}
      <Row>
        <Col xs={6} md={4}>
          <Field id="bd-month" label="Month">
            <Form.Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Form.Select>
          </Field>
        </Col>
        <Col xs={6} md={3}>
          <Field id="bd-day" label="Day" error={fields.eventDate}>
            <Form.Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </Form.Select>
          </Field>
        </Col>
        <Col md={5}>
          <Field id="bd-year" label="Birth year (optional)" hint="Leave blank to skip age" error={fields.birthYear}>
            <Form.Control type="number" min="1900" max={new Date().getFullYear()} value={year} onChange={(e) => setYear(e.target.value)} isInvalid={!!fields.birthYear} />
          </Field>
        </Col>
      </Row>
      <ReminderPicker value={reminders} onChange={setReminders} error={fields.reminders} />
      <div className="d-flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save birthday'}</Button>
        <Button as={Link} to="/" variant="outline-secondary">Cancel</Button>
      </div>
    </Form>
  );
}

function FullEventForm({ initial, people, categories, isEdit, onSubmit }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields || {};
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(toPayload(v));
    } catch (err) {
      setError(err); // form data is kept so nothing is lost
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form onSubmit={submit} noValidate>
      <ErrorAlert error={error && !Object.keys(fields).length ? error : error && { message: `${error.message}. Your entries have been kept.` }} />
      <Field id="ev-title" label="Title" error={fields.title}>
        <Form.Control value={v.title} onChange={set('title')} isInvalid={!!fields.title} maxLength={150} required />
      </Field>
      <Row>
        <Col md={4}>
          <Field id="ev-date" label={v.recurrence === 'NONE' ? 'Date' : 'First date'} error={fields.eventDate}>
            <Form.Control type="date" value={v.eventDate} onChange={set('eventDate')} isInvalid={!!fields.eventDate} required />
          </Field>
        </Col>
        <Col md={4}>
          <Field id="ev-cat" label="Category" error={fields.categoryId}>
            <Form.Select value={v.categoryId} onChange={set('categoryId')} isInvalid={!!fields.categoryId}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </Field>
        </Col>
        <Col md={4}>
          <PersonSelect id="ev-person" people={people} value={v.personId} onChange={set('personId')} />
        </Col>
      </Row>

      <Form.Check id="ev-allday" type="checkbox" className="mb-3" label="All-day event" checked={v.isAllDay} onChange={set('isAllDay')} />
      {!v.isAllDay && (
        <Row>
          <Col sm={6} md={4}>
            <Field id="ev-start" label="Start time" error={fields.startTime}>
              <Form.Control type="time" value={v.startTime} onChange={set('startTime')} isInvalid={!!fields.startTime} />
            </Field>
          </Col>
          <Col sm={6} md={4}>
            <Field id="ev-end" label="End time (optional)" error={fields.endTime}>
              <Form.Control type="time" value={v.endTime} onChange={set('endTime')} isInvalid={!!fields.endTime} />
            </Field>
          </Col>
        </Row>
      )}

      <Row>
        <Col md={4}>
          <Field id="ev-rec" label="Repeats">
            <Form.Select value={v.recurrence} onChange={set('recurrence')}>
              {Object.entries(RECURRENCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Form.Select>
          </Field>
        </Col>
        {v.recurrence !== 'NONE' && (
          <Col md={4}>
            <Field id="ev-rec-end" label="Repeat until (optional)" error={fields.recurrenceEnd}>
              <Form.Control type="date" value={v.recurrenceEnd} onChange={set('recurrenceEnd')} isInvalid={!!fields.recurrenceEnd} />
            </Field>
          </Col>
        )}
        {v.recurrence === 'YEARLY' && (
          <Col md={4}>
            <Field id="ev-birth-year" label="Birth year (optional)" hint="Shows age on birthdays" error={fields.birthYear}>
              <Form.Control type="number" min="1900" max="2100" value={v.birthYear} onChange={set('birthYear')} isInvalid={!!fields.birthYear} />
            </Field>
          </Col>
        )}
      </Row>
      {v.recurrence !== 'NONE' && (
        <Alert variant="light" className="border small">
          Editing a repeating event changes the <strong>whole series</strong>. Use “Stop repeating” on the event page to end it from a chosen date.
        </Alert>
      )}

      <Field id="ev-loc" label="Location (optional)" error={fields.location}>
        <Form.Control value={v.location} onChange={set('location')} maxLength={200} />
      </Field>
      <Field id="ev-desc" label="Notes (optional)" error={fields.description}>
        <Form.Control as="textarea" rows={3} value={v.description} onChange={set('description')} maxLength={2000} />
      </Field>

      {isEdit && (
        <Field id="ev-status" label="Status">
          <Form.Select value={v.status} onChange={set('status')}>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Form.Select>
        </Field>
      )}

      <ReminderPicker value={v.reminders} onChange={(reminders) => setV((s) => ({ ...s, reminders }))} error={fields.reminders} />

      <div className="d-flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save event'}</Button>
        <Button as={Link} to={isEdit ? `/events/${initial.id || ''}` : '/'} variant="outline-secondary" onClick={(e) => { if (isEdit && !initial.id) e.preventDefault(); }}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}

export default function EventFormPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const type = params.get('type') === 'birthday' ? 'birthday' : 'event';

  const [people, setPeople] = useState(null);
  const [categories, setCategories] = useState(null);
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loads = [api.get('/people'), api.get('/categories')];
    if (isEdit) loads.push(api.get(`/events/${id}`));
    Promise.all(loads)
      .then(([p, c, e]) => { setPeople(p.people); setCategories(c.categories); if (e) setExisting(e.event); })
      .catch(setError);
  }, [id, isEdit]);

  if (error) return <ErrorAlert error={error} />;
  if (!people || !categories || (isEdit && !existing)) return <Loading />;

  const initialPersonId = params.get('personId') || '';

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="h3 mb-3">{isEdit ? 'Edit event' : type === 'birthday' ? 'Add a birthday' : 'Add an event'}</h1>
      {!isEdit && (
        <ButtonGroup className="mb-3" aria-label="What are you adding?">
          <Button variant={type === 'birthday' ? 'primary' : 'outline-primary'} onClick={() => setParams({ type: 'birthday', ...(initialPersonId && { personId: initialPersonId }) })}>🎂 Birthday</Button>
          <Button variant={type === 'event' ? 'primary' : 'outline-primary'} onClick={() => setParams(initialPersonId ? { personId: initialPersonId } : {})}>📅 Other event</Button>
        </ButtonGroup>
      )}
      <Card body className="shadow-sm">
        {!isEdit && type === 'birthday' ? (
          <BirthdayForm people={people} categories={categories} initialPersonId={initialPersonId}
            onSaved={(ev) => navigate('/', { state: { flash: `Saved “${ev.title}” — next on ${ev.nextOccurrence}` } })} />
        ) : (
          <FullEventForm
            key={existing?.id || 'new'}
            initial={existing ? { ...fromEvent(existing), id: existing.id } : blankEvent(initialPersonId)}
            people={people}
            categories={categories}
            isEdit={isEdit}
            onSubmit={async (payload) => {
              const r = isEdit ? await api.put(`/events/${id}`, payload) : await api.post('/events', payload);
              navigate(isEdit ? `/events/${id}` : '/', { state: { flash: `Saved “${r.event.title}”` } });
            }}
          />
        )}
      </Card>
    </div>
  );
}
