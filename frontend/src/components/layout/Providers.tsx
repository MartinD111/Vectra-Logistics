'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import { PlatformProvider } from '@/context/PlatformContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <PlatformProvider>
          {children}
        </PlatformProvider>
      </AuthProvider>
    </NextThemesProvider>
  );
}
