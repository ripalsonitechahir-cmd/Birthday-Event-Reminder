import { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorAlert, Field } from '../components/common';

function Shell({ title, children, footer }) {
  return (
    <Container style={{ maxWidth: 440 }} className="py-5">
      <div className="text-center mb-4">
        <div style={{ fontSize: '3rem' }} aria-hidden="true">🎂</div>
        <h1 className="h3">Upcoming</h1>
        <p className="text-muted mb-0">Never miss a birthday or important date.</p>
      </div>
      <Card body className="shadow-sm">
        <h2 className="h5 mb-3">{title}</h2>
        {children}
      </Card>
      <div className="text-center mt-3 small">{footer}</div>
    </Container>
  );
}

function useForm(initial, submit) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit(values);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { values, set, error, busy, onSubmit, fields: error?.fields || {} };
}

export function Login() {
  const { user, login } = useAuth();
  const f = useForm({ email: '', password: '' }, (v) => login(v.email, v.password));
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Sign in" footer={<><Link to="/register">Create an account</Link> · <Link to="/forgot-password">Forgot password?</Link></>}>
      <Form onSubmit={f.onSubmit} noValidate>
        <ErrorAlert error={f.error} />
        <Field id="email" label="Email" error={f.fields.email}>
          <Form.Control type="email" autoComplete="email" value={f.values.email} onChange={f.set('email')} isInvalid={!!f.fields.email} required />
        </Field>
        <Field id="password" label="Password" error={f.fields.password}>
          <Form.Control type="password" autoComplete="current-password" value={f.values.password} onChange={f.set('password')} isInvalid={!!f.fields.password} required />
        </Field>
        <Button type="submit" className="w-100" disabled={f.busy}>{f.busy ? 'Signing in…' : 'Sign in'}</Button>
      </Form>
    </Shell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const f = useForm({ displayName: '', email: '', password: '' }, (v) => register(v));
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Create your account" footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
      <Form onSubmit={f.onSubmit} noValidate>
        <ErrorAlert error={f.error && !Object.keys(f.fields).length ? f.error : null} />
        <Field id="displayName" label="Your name" error={f.fields.displayName}>
          <Form.Control autoComplete="name" value={f.values.displayName} onChange={f.set('displayName')} isInvalid={!!f.fields.displayName} required />
        </Field>
        <Field id="email" label="Email" error={f.fields.email}>
          <Form.Control type="email" autoComplete="email" value={f.values.email} onChange={f.set('email')} isInvalid={!!f.fields.email} required />
        </Field>
        <Field id="password" label="Password" hint="At least 8 characters" error={f.fields.password}>
          <Form.Control type="password" autoComplete="new-password" value={f.values.password} onChange={f.set('password')} isInvalid={!!f.fields.password} required />
        </Field>
        <Button type="submit" className="w-100" disabled={f.busy}>{f.busy ? 'Creating…' : 'Create account'}</Button>
      </Form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [result, setResult] = useState(null);
  const f = useForm({ email: '' }, async (v) => setResult(await api.post('/auth/forgot-password', v)));
  return (
    <Shell title="Recover access" footer={<Link to="/login">Back to sign in</Link>}>
      {result ? (
        <Alert variant="success">
          {result.message}
          {result.devResetToken && (
            <div className="mt-2 small">
              Email delivery isn't configured, so in development you can{' '}
              <Link to={`/reset-password?token=${result.devResetToken}`}>reset your password here</Link>.
            </div>
          )}
        </Alert>
      ) : (
        <Form onSubmit={f.onSubmit} noValidate>
          <ErrorAlert error={f.error} />
          <Field id="email" label="Account email" error={f.fields.email}>
            <Form.Control type="email" value={f.values.email} onChange={f.set('email')} isInvalid={!!f.fields.email} required />
          </Field>
          <Button type="submit" className="w-100" disabled={f.busy}>Send reset link</Button>
        </Form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const f = useForm({ password: '' }, async (v) => {
    await api.post('/auth/reset-password', { token: params.get('token') || '', password: v.password });
    setDone(true);
    setTimeout(() => navigate('/login'), 1500);
  });
  return (
    <Shell title="Choose a new password" footer={<Link to="/login">Back to sign in</Link>}>
      {done ? <Alert variant="success">Password updated. Redirecting to sign in…</Alert> : (
        <Form onSubmit={f.onSubmit} noValidate>
          <ErrorAlert error={f.error && !f.fields.password ? f.error : null} />
          <Field id="password" label="New password" hint="At least 8 characters" error={f.fields.password}>
            <Form.Control type="password" autoComplete="new-password" value={f.values.password} onChange={f.set('password')} isInvalid={!!f.fields.password} required />
          </Field>
          <Button type="submit" className="w-100" disabled={f.busy}>Update password</Button>
        </Form>
      )}
    </Shell>
  );
}
