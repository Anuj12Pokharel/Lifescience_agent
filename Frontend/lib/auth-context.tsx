'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, getAccessToken } from './api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  is_verified: boolean;
  company_name?: string | null;
  profile?: Record<string, unknown>;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ role: string }>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  updateToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Wrap setUser to add debugging
  const setUser = useCallback((userData: UserProfile | null) => {
    console.log('[AuthContext] setUser called with:', userData);
    setUserState(userData);
  }, []);

  useEffect(() => {
    // Try to load user from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user');
      const token = getAccessToken();
      console.log('[AuthContext] Stored user:', stored);
      console.log('[AuthContext] Stored token:', token);
      
      if (stored && token) {
        try {
          const parsedUser = JSON.parse(stored);
          console.log('[AuthContext] Parsed user:', parsedUser);
          setUser(parsedUser);
        } catch {
          console.log('[AuthContext] Failed to parse stored user');
        }
      } else {
        console.log('[AuthContext] No stored user or token found');
      }
    }
    setLoading(false);
  }, [setUser]);

  const login = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] Delegating to authApi.login...');
    // authApi.login handles setting user and token
    const res = await api.post('/api/v1/auth/login/', { email, password });
    const data = res.data?.data;
    return { role: data.user.role };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout/', {});
    } catch {
      // ignore logout errors
    }
    setAccessToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }, []);

  const updateToken = useCallback((token: string) => {
    setAccessToken(token);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
