import { useCallback, useEffect, useState } from 'react';
import { Badge, Container, Dropdown, Nav, Navbar } from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

function NotificationBell() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const navigate = useNavigate();

  const load = useCallback(() => api.get('/notifications').then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const open = async (n) => {
    if (!n.readAt) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    load();
    if (n.eventId) navigate(`/events/${n.eventId}`);
  };
  const readAll = async () => { await api.post('/notifications/read-all'); load(); };

  return (
    <Dropdown align="end" onToggle={(show) => show && load()}>
      <Dropdown.Toggle variant="outline-light" size="sm" id="notifications-toggle" aria-label={`Notifications, ${data.unread} unread`}>
        🔔 {data.unread > 0 && <Badge bg="danger">{data.unread}</Badge>}
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ minWidth: 320, maxHeight: 400, overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center px-3 py-1">
          <strong>Reminders</strong>
          {data.unread > 0 && <button type="button" className="btn btn-link btn-sm p-0" onClick={readAll}>Mark all read</button>}
        </div>
        <Dropdown.Divider />
        {data.notifications.length === 0 && <div className="px-3 py-2 text-muted small">No reminders yet.</div>}
        {data.notifications.map((n) => (
          <Dropdown.Item key={n.id} as="button" onClick={() => open(n)} className="text-wrap">
            <div className={n.readAt ? 'text-muted' : 'fw-semibold'}>{!n.readAt && '● '}{n.message}</div>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="md" className="mb-4">
        <Container>
          <Navbar.Brand as={Link} to="/">🎂 Upcoming</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
              <Nav.Link as={NavLink} to="/events">All Upcoming</Nav.Link>
              <Nav.Link as={NavLink} to="/people">People</Nav.Link>
              <Nav.Link as={NavLink} to="/settings">Settings</Nav.Link>
            </Nav>
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
              <NotificationBell />
              <span className="navbar-text small d-none d-lg-inline">{user.displayName}</span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>Sign out</button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container as="main" className="pb-5">
        <Outlet />
      </Container>
    </>
  );
}
