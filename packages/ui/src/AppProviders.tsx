'use client';

import { ReactNode, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

/**
 * Shared theme + react-query providers used by every Vectra app. Each app nests
 * its own AuthProvider inside this (the Workspaces app's AuthProvider wires the
 * realtime socket; the Marketplace/CMR apps use the plain @vectra/auth one).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // useState keeps one QueryClient per render boundary (RSC/streaming safe).
  const [queryClient] = useState(makeQueryClient);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextThemesProvider>
  );
}
