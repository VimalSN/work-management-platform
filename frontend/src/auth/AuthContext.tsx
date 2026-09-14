import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setAccessToken } from '../lib/api';

export type Role = 'ADMIN' | 'MANAGER' | 'DEVELOPER' | 'VIEWER';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (organizationName: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No access token exists in memory yet on a fresh page load - but a
    // valid refresh-token cookie may still be sitting in the browser from
    // an earlier session. Try silently exchanging it for a new access token
    // before deciding the user is logged out.
    api
      .post('/auth/refresh')
      .then(async (res) => {
        setAccessToken(res.data.accessToken);
        const me = await api.get<User>('/auth/me');
        setUser(me.data);
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }

  async function register(organizationName: string, name: string, email: string, password: string) {
    const res = await api.post('/auth/register', { organizationName, name, email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
