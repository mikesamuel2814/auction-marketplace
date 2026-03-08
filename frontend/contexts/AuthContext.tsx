'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role: 'BUYER' | 'SELLER' }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const r = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (t) setToken(t);
    if (t && r) {
      authApi.refresh(r)
        .then((data) => {
          setToken((data as { accessToken: string }).accessToken);
          setUser((data as { user: User }).user as User);
          localStorage.setItem('accessToken', (data as { accessToken: string }).accessToken);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    const d = data as { accessToken: string; refreshToken: string; user: User };
    localStorage.setItem('accessToken', d.accessToken);
    localStorage.setItem('refreshToken', d.refreshToken);
    setToken(d.accessToken);
    setUser(d.user as User);
  };

  const register = async (data: { email: string; password: string; name: string; role: 'BUYER' | 'SELLER' }) => {
    const res = await authApi.register(data);
    const d = res as { accessToken: string; refreshToken: string; user: User };
    localStorage.setItem('accessToken', d.accessToken);
    localStorage.setItem('refreshToken', d.refreshToken);
    setToken(d.accessToken);
    setUser(d.user as User);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const r = localStorage.getItem('refreshToken');
    if (!r) return;
    const data = await authApi.refresh(r);
    const d = data as { accessToken: string; user: User };
    setToken(d.accessToken);
    setUser(d.user as User);
    localStorage.setItem('accessToken', d.accessToken);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
