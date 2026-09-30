import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, ListGroup, Modal } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, qs } from '../api';
import { ConfirmModal, EmptyState, ErrorAlert, Field, Loading } from '../components/common';
import EventRow from '../components/EventRow';

const BLANK = { name: '', nickname: '', relationship: '', email: '', phone: '', notes: '' };

function PersonModal({ show, person, onClose, onSaved }) {
  const [v, setV] = useState(BLANK);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields || {};

  useEffect(() => {
    if (show) { setV(person ? { ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, person[k] || ''])) } : BLANK); setError(null); }
  }, [show, person]);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = person ? await api.put(`/people/${person.id}`, v) : await api.post('/people', v);
      onSaved(r.person);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const text = (k, label, props = {}) => (
    <Field id={`p-${k}`} label={label} error={fields[k]}>
      <Form.Control value={v[k]} onChange={set(k)} isInvalid={!!fields[k]} {...props} />
    </Field>
  );

  return (
    <Modal show={show} onHide={onClose} centered>
      <Form onSubmit={submit} noValidate>
        <Modal.Header closeButton><Modal.Title>{person ? 'Edit person' : 'Add person'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <ErrorAlert error={error && !Object.keys(fields).length ? error : null} />
          {text('name', 'Name', { required: true, autoFocus: true })}
          {text('nickname', 'Nickname (optional)')}
          {text('relationship', 'Relationship (optional)', { placeholder: 'e.g. Mother, Colleague' })}
          {text('email', 'Email (optional)', { type: 'email' })}
          {text('phone', 'Phone (optional)', { type: 'tel' })}
          <Field id="p-notes" label="Notes (optional)" error={fields.notes}>
            <Form.Control as="textarea" rows={3} value={v.notes} onChange={set('notes')} />
          </Field>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function DeletePersonModal({ person, onClose, onDeleted }) {
  const [deleteEvents, setDeleteEvents] = useState(false);
  useEffect(() => setDeleteEvents(false), [person]);
  if (!person) return null;
  const count = person._count?.events ?? person.events?.length ?? 0;
  return (
    <ConfirmModal show title={`Delete ${person.name}?`} onCancel={onClose}
      onConfirm={async () => { await api.del(`/people/${person.id}${qs({ deleteEvents })}`); onDeleted(); }}>
      {count === 0 ? <p>This person has no linked events.</p> : (
        <>
          <p>{person.name} has <strong>{count}</strong> linked {count === 1 ? 'event' : 'events'}. What should happen to {count === 1 ? 'it' : 'them'}?</p>
          <Form.Check type="radio" id="del-keep" name="del" label="Keep the events (they become independent events)" checked={!deleteEvents} onChange={() => setDeleteEvents(false)} />
          <Form.Check type="radio" id="del-all" name="del" label="Delete the events too" checked={deleteEvents} onChange={() => setDeleteEvents(true)} />
        </>
      )}
    </ConfirmModal>
  );
}

export function PeoplePage() {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    api.get(`/people${qs({ q })}`).then((r) => setPeople(r.people)).catch(setError);
  }, [q]);
  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">People</h1>
        <Button onClick={() => setEditing(null)}>Add person</Button>
      </div>
      <Form.Control type="search" className="mb-3" style={{ maxWidth: 360 }} placeholder="Search people…" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorAlert error={error} />
      {!people && !error && <Loading />}
      {people && (people.length === 0 ? (
        <Card body className="shadow-sm">
          {q
            ? <EmptyState icon="🔍" title="No people found" action={<Button onClick={() => setQ('')}>Clear search</Button>}>No one matches “{q}”.</EmptyState>
            : <EmptyState icon="👤" title="No people yet" action={<Button onClick={() => setEditing(null)}>Add person</Button>}>Add friends and family to link birthdays and events to them.</EmptyState>}
        </Card>
      ) : (
        <ListGroup className="shadow-sm">
          {people.map((p) => (
            <ListGroup.Item key={p.id} className="d-flex align-items-center gap-3">
              <div className="flex-grow-1">
                <Link to={`/people/${p.id}`} className="fw-semibold text-decoration-none">{p.name}</Link>
                {p.nickname && <span className="text-muted"> “{p.nickname}”</span>}
                <div className="small text-muted">{[p.relationship, `${p._count.events} ${p._count.events === 1 ? 'event' : 'events'}`].filter(Boolean).join(' · ')}</div>
              </div>
              <Button size="sm" variant="outline-secondary" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>Edit</Button>
              <Button size="sm" variant="outline-danger" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>Delete</Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      ))}
      <PersonModal show={editing !== undefined} person={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
      <DeletePersonModal person={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); }} />
    </>
  );
}

export function PersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [events, setEvents] = useState([]);

  const load = useCallback(() => {
    Promise.all([api.get(`/people/${id}`), api.get(`/events${qs({ personId: id, status: 'all', includePast: true })}`)])
      .then(([p, e]) => { setPerson(p.person); setEvents(e.events); })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorAlert error={error} />;
  if (!person) return <Loading />;

  return (
    <div style={{ maxWidth: 760 }}>
      <nav aria-label="Breadcrumb" className="small mb-2"><Link to="/people">← People</Link></nav>
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <h1 className="h3">{person.name}{person.nickname && <small className="text-muted"> “{person.nickname}”</small>}</h1>
          <dl className="row mb-0">
            {person.relationship && (<><dt className="col-sm-3">Relationship</dt><dd className="col-sm-9">{person.relationship}</dd></>)}
            {person.email && (<><dt className="col-sm-3">Email</dt><dd className="col-sm-9">{person.email}</dd></>)}
            {person.phone && (<><dt className="col-sm-3">Phone</dt><dd className="col-sm-9">{person.phone}</dd></>)}
            {person.notes && (<><dt className="col-sm-3">Notes</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{person.notes}</dd></>)}
          </dl>
        </Card.Body>
        <Card.Footer className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`/events/new?type=birthday&personId=${person.id}`}>🎂 Add birthday</Button>
          <Button as={Link} to={`/events/new?personId=${person.id}`} variant="outline-primary">Add event</Button>
          <Button variant="outline-secondary" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="outline-danger" className="ms-auto" onClick={() => setDeleting(true)}>Delete</Button>
        </Card.Footer>
      </Card>

      <h2 className="h5">Events</h2>
      <Card className="shadow-sm overflow-hidden">
        {events.length === 0
          ? <EmptyState title="No events yet">Add a birthday or event for {person.name}.</EmptyState>
          : events.map((e) => <EventRow key={e.id} event={e} />)}
      </Card>

      <PersonModal show={editing} person={person} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      {deleting && <DeletePersonModal person={person} onClose={() => setDeleting(false)} onDeleted={() => navigate('/people')} />}
    </div>
  );
}
