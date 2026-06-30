'use client';

import { useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { PlatformProvider } from '@/context/PlatformContext';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useState ensures a new QueryClient is NOT created on every render while
  // still being unique per server-render boundary (important for RSC/streaming).
  const [queryClient] = useState(makeQueryClient);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PlatformProvider>
            {children}
          </PlatformProvider>
        </AuthProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
