import { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';

export function Loading() {
  return (
    <div className="text-center py-5" role="status">
      <Spinner animation="border" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}

export function EmptyState({ icon = '🗓️', title, children, action }) {
  return (
    <div className="text-center text-muted py-5 px-3">
      <div style={{ fontSize: '3rem' }} aria-hidden="true">{icon}</div>
      <h2 className="h5 mt-2">{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ErrorAlert({ error }) {
  if (!error) return null;
  return <Alert variant="danger" role="alert">{error.message || String(error)}</Alert>;
}

// Field with a label, control and accessible error message.
export function Field({ id, label, error, hint, children }) {
  return (
    <Form.Group className="mb-3" controlId={id}>
      {label && <Form.Label>{label}</Form.Label>}
      {children}
      {hint && <Form.Text muted>{hint}</Form.Text>}
      {error && <Form.Control.Feedback type="invalid" className="d-block">{error}</Form.Control.Feedback>}
    </Form.Group>
  );
}

// Confirmation dialog that names the item and explains the consequence.
export function ConfirmModal({ show, title, confirmLabel = 'Delete', variant = 'danger', onConfirm, onCancel, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        {children}
        <ErrorAlert error={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={variant} onClick={run} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}
