import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api.get('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [logout]);

  const value = useMemo(() => ({
    user,
    loading,
    logout,
    setUser,
    async login(email, password) {
      const r = await api.post('/auth/login', { email, password });
      setToken(r.token);
      setUser(r.user);
    },
    async register(form) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await api.post('/auth/register', { ...form, timeZone });
      setToken(r.token);
      setUser(r.user);
    },
  }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
