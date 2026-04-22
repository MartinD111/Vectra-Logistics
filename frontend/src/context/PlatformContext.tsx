'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type Platform = 'marketplace' | 'fleet' | 'routes' | 'workspace';

interface PlatformContextValue {
  activePlatform: Platform | null;
  setActivePlatform: (platform: Platform) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

const PATHNAME_TO_PLATFORM: Record<string, Platform> = {
  '/marketplace': 'marketplace',
  '/fleet':       'fleet',
  '/routes':      'routes',
  '/workspaces':  'workspace',
};

function resolvePlatform(pathname: string): Platform | null {
  for (const [prefix, platform] of Object.entries(PATHNAME_TO_PLATFORM)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return platform;
  }
  return null;
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activePlatform, setActivePlatform] = useState<Platform | null>(
    resolvePlatform(pathname),
  );

  useEffect(() => {
    const resolved = resolvePlatform(pathname);
    if (resolved !== null) setActivePlatform(resolved);
  }, [pathname]);

  return (
    <PlatformContext.Provider value={{ activePlatform, setActivePlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within a PlatformProvider');
  return ctx;
}
