import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Loading } from './components/common';
import Layout from './components/Layout';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import EventFormPage from './pages/EventForm';
import EventList from './pages/EventList';
import { PeoplePage, PersonDetail } from './pages/People';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="events" element={<EventList />} />
        <Route path="events/new" element={<EventFormPage />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="events/:id/edit" element={<EventFormPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<PersonDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<p>Page not found. <Link to="/">Back to dashboard</Link></p>} />
      </Route>
    </Routes>
  );
}
