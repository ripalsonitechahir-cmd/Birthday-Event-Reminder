import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorAlert, Field } from '../components/common';
import { DATE_FORMATS, formatDate } from '../format';

const ZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC']; }
})();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ProfileForm() {
  const { user, setUser } = useAuth();
  const [v, setV] = useState({
    displayName: user.displayName, timeZone: user.timeZone, dateFormat: user.dateFormat,
    firstDayOfWeek: user.firstDayOfWeek, remindersEnabled: user.remindersEnabled,
  });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields || {};
  const set = (k, conv = (x) => x) => (e) => { setSaved(false); setV((s) => ({ ...s, [k]: conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value) })); };
  const zones = ZONES.includes(v.timeZone) ? ZONES : [v.timeZone, ...ZONES];

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.put('/auth/me', v);
      setUser(r.user);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card body className="shadow-sm mb-4">
      <h2 className="h5 mb-3">Profile &amp; preferences</h2>
      <Form onSubmit={submit} noValidate>
        <ErrorAlert error={error && !Object.keys(fields).length ? error : null} />
        {saved && <Alert variant="success" role="status">Preferences saved.</Alert>}
        <Field id="s-name" label="Display name" error={fields.displayName}>
          <Form.Control value={v.displayName} onChange={set('displayName')} isInvalid={!!fields.displayName} />
        </Field>
        <Field id="s-tz" label="Time zone" hint="“Today” and reminders follow this time zone." error={fields.timeZone}>
          <Form.Select value={v.timeZone} onChange={set('timeZone')}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </Form.Select>
        </Field>
        <Row>
          <Col md={6}>
            <Field id="s-fmt" label="Date format">
              <Form.Select value={v.dateFormat} onChange={set('dateFormat')}>
                {DATE_FORMATS.map((f) => <option key={f} value={f}>{f} — {formatDate('2026-03-15', f)}</option>)}
              </Form.Select>
            </Field>
          </Col>
          <Col md={6}>
            <Field id="s-dow" label="First day of week">
              <Form.Select value={v.firstDayOfWeek} onChange={set('firstDayOfWeek', Number)}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Form.Select>
            </Field>
          </Col>
        </Row>
        <Form.Check id="s-rem" type="switch" className="mb-3" label="Send me reminders for upcoming events" checked={v.remindersEnabled} onChange={set('remindersEnabled')} />
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</Button>
      </Form>
    </Card>
  );
}

function PasswordForm() {
  const [v, setV] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields || {};
  const set = (k) => (e) => { setDone(false); setV((s) => ({ ...s, [k]: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/change-password', v);
      setV({ currentPassword: '', newPassword: '' });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card body className="shadow-sm">
      <h2 className="h5 mb-3">Change password</h2>
      <Form onSubmit={submit} noValidate>
        <ErrorAlert error={error && !Object.keys(fields).length ? error : null} />
        {done && <Alert variant="success" role="status">Password changed.</Alert>}
        <Field id="pw-current" label="Current password" error={fields.currentPassword}>
          <Form.Control type="password" autoComplete="current-password" value={v.currentPassword} onChange={set('currentPassword')} isInvalid={!!fields.currentPassword} />
        </Field>
        <Field id="pw-new" label="New password" hint="At least 8 characters" error={fields.newPassword}>
          <Form.Control type="password" autoComplete="new-password" value={v.newPassword} onChange={set('newPassword')} isInvalid={!!fields.newPassword} />
        </Field>
        <Button type="submit" variant="outline-primary" disabled={busy}>Change password</Button>
      </Form>
    </Card>
  );
}

export default function Settings() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-3">Settings</h1>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
