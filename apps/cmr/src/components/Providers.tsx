'use client';

import { ReactNode } from 'react';
import { AppProviders } from '@vectra/ui';
import { AuthProvider } from '@vectra/auth';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AuthProvider>{children}</AuthProvider>
    </AppProviders>
  );
}
