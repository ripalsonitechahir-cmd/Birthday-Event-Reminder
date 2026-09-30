import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ConfirmModal, ErrorAlert, Field, Loading } from '../components/common';
import { EventTags, iconFor } from '../components/EventRow';
import { formatDate, RECURRENCE_LABELS, reminderLabel, timeRange, weekday } from '../format';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const flash = useLocation().state?.flash;
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // 'delete' | 'stop'
  const [stopFrom, setStopFrom] = useState('');

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEvent(r.event)).catch(setError);
  }, [id]);

  if (error) return <ErrorAlert error={error} />;
  if (!event) return <Loading />;

  const fmt = (d) => `${weekday(d)}, ${formatDate(d, user.dateFormat)}`;
  const recurring = event.recurrence !== 'NONE';

  const duplicate = async () => {
    const r = await api.post(`/events/${id}/duplicate`);
    navigate(`/events/${r.event.id}/edit`);
  };
  const remove = async () => {
    await api.del(`/events/${id}`);
    navigate('/', { state: { flash: `Deleted “${event.title}”` } });
  };
  const stop = async () => {
    const r = await api.post(`/events/${id}/stop-recurrence`, { from: stopFrom });
    setEvent(r.event);
    setModal(null);
  };
  const setStatus = async (status) => {
    const { reminders, person, category, ...rest } = event;
    const r = await api.put(`/events/${id}`, {
      ...rest,
      status,
      reminders: reminders.filter((x) => x.enabled).map((x) => ({ daysBefore: x.daysBefore, enabled: true })),
    });
    setEvent(r.event);
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {flash && <Alert variant="success" dismissible>{flash}</Alert>}
      <nav aria-label="Breadcrumb" className="small mb-2"><Link to="/events">← All upcoming</Link></nav>
      <Card className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <h1 className="h3"><span aria-hidden="true">{iconFor(event)} </span>{event.title}</h1>
            <div className="fs-5 fw-semibold text-primary">{event.relative}</div>
          </div>
          <div className="mb-3"><EventTags event={event} /></div>

          <dl className="row mb-0">
            <dt className="col-sm-3">{event.isPast ? 'Date' : 'Next date'}</dt>
            <dd className="col-sm-9">
              {fmt(event.nextOccurrence || event.eventDate)} · {timeRange(event)}
              {event.age > 0 && <> · turns {event.age}</>}
            </dd>
            {recurring && (
              <>
                <dt className="col-sm-3">Repeats</dt>
                <dd className="col-sm-9">
                  {RECURRENCE_LABELS[event.recurrence]} — part of a series starting {fmt(event.eventDate)}
                  {event.recurrenceEnd && <>, ending {fmt(event.recurrenceEnd)}</>}
                </dd>
              </>
            )}
            {event.person && (<><dt className="col-sm-3">Person</dt><dd className="col-sm-9"><Link to={`/people/${event.person.id}`}>{event.person.name}</Link></dd></>)}
            {event.location && (<><dt className="col-sm-3">Location</dt><dd className="col-sm-9">{event.location}</dd></>)}
            {event.description && (<><dt className="col-sm-3">Notes</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{event.description}</dd></>)}
            <dt className="col-sm-3">Reminders</dt>
            <dd className="col-sm-9">
              {event.reminders.filter((r) => r.enabled).length
                ? event.reminders.filter((r) => r.enabled).map((r) => reminderLabel(r.daysBefore)).join(', ')
                : 'None'}
              {!user.remindersEnabled && <div className="text-warning-emphasis small">Reminders are switched off in your <Link to="/settings">settings</Link>.</div>}
            </dd>
          </dl>
        </Card.Body>
        <Card.Footer className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`/events/${id}/edit`}>Edit{recurring ? ' series' : ''}</Button>
          <Button variant="outline-secondary" onClick={duplicate}>Duplicate</Button>
          {event.status === 'ACTIVE'
            ? <Button variant="outline-success" onClick={() => setStatus('COMPLETED')}>Mark completed</Button>
            : <Button variant="outline-success" onClick={() => setStatus('ACTIVE')}>Reactivate</Button>}
          {recurring && !event.isPast && <Button variant="outline-warning" onClick={() => { setStopFrom(''); setModal('stop'); }}>Stop repeating…</Button>}
          <Button variant="outline-danger" className="ms-auto" onClick={() => setModal('delete')}>Delete</Button>
        </Card.Footer>
      </Card>

      <ConfirmModal show={modal === 'delete'} title={`Delete “${event.title}”?`} onConfirm={remove} onCancel={() => setModal(null)}>
        {recurring
          ? <p>This deletes the <strong>entire {RECURRENCE_LABELS[event.recurrence].toLowerCase()} series</strong>, including all future occurrences. To keep past occurrences, use “Stop repeating” instead.</p>
          : <p>This event will be permanently removed.</p>}
      </ConfirmModal>

      <ConfirmModal show={modal === 'stop'} title="Stop repeating" variant="warning" confirmLabel="Stop repeating" onConfirm={stop} onCancel={() => setModal(null)}>
        <p>Occurrences before the chosen date stay as they are; nothing from that date onward will appear.</p>
        <Field id="stop-from" label="Stop from (first date without this event)">
          <Form.Control type="date" value={stopFrom} min={event.nextOccurrence || undefined} onChange={(e) => setStopFrom(e.target.value)} />
        </Field>
      </ConfirmModal>
    </div>
  );
}
