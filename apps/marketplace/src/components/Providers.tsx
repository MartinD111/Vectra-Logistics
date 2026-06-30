'use client';

import { ReactNode, useCallback } from 'react';
import { AppProviders } from '@vectra/ui';
import { AuthProvider } from '@vectra/auth';
import { reconnectSocket, disconnectSocket } from '@vectra/data';

export function Providers({ children }: { children: ReactNode }) {
  const handleSession = useCallback(() => reconnectSocket(), []);
  const handleLogout = useCallback(() => disconnectSocket(), []);

  return (
    <AppProviders>
      <AuthProvider onSession={handleSession} onLogout={handleLogout}>
        {children}
      </AuthProvider>
    </AppProviders>
  );
}
