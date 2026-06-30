'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { AuthUser, SignupData } from '@vectra/types';
import { getToken, getStoredUser, setSession, clearSession } from './session';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';

export interface AuthProviderProps {
  children: ReactNode;
  /** Called after a successful login or restored session (e.g. to (re)connect a socket). */
  onSession?: () => void;
  /** Called on logout (e.g. to disconnect a socket). */
  onLogout?: () => void;
}

export function AuthProvider({ children, onSession, onLogout }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount, then validate it server-side via /auth/me. This
  // confirms the token is real (not just a client-decoded value) and refreshes
  // the user object — the basis for trustworthy cross-app SSO.
  useEffect(() => {
    const storedToken = getToken();
    const storedUser = getStoredUser<AuthUser>();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Optimistically restore from storage so the UI isn't blank during validation.
    setToken(storedToken);
    if (storedUser) setUser(storedUser);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { user: AuthUser };
          setUser(data.user);
          setSession(storedToken, data.user);
          onSession?.();
        } else {
          // Token rejected — clear the session.
          clearSession();
          setUser(null);
          setToken(null);
        }
      } catch {
        // Network error — keep the optimistic session; don't log the user out.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setSession(data.token, data.user);
      onSession?.();
    },
    [onSession],
  );

  const signup = useCallback(async (formData: SignupData) => {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Signup failed');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearSession();
    onLogout?.();
  }, [onLogout]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
