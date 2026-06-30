'use client';

// App-local AuthProvider wrapper. The implementation lives in @vectra/auth
// (shared across all three apps for SSO); this wrapper wires in the
// workspaces-app socket so logging in/out (re)connects realtime as before.
// Existing imports (`@/context/AuthContext`) keep working unchanged.

import { ReactNode, useCallback } from 'react';
import { AuthProvider as SharedAuthProvider, useAuth } from '@vectra/auth';

export type { AuthUser, SignupData, UserRole } from '@vectra/types';
export { useAuth };

export function AuthProvider({ children }: { children: ReactNode }) {
  const handleSession = useCallback(() => {
    void import('@/lib/socket').then(({ reconnectSocket }) => reconnectSocket());
  }, []);

  const handleLogout = useCallback(() => {
    void import('@/lib/socket').then(({ disconnectSocket }) => disconnectSocket());
  }, []);

  return (
    <SharedAuthProvider onSession={handleSession} onLogout={handleLogout}>
      {children}
    </SharedAuthProvider>
  );
}
