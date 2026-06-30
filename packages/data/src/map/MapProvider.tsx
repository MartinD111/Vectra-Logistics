'use client';

import { useEffect, useState } from 'react';

/**
 * MapProvider acts as an abstraction layer.
 * MVP: Dynamically loads Leaflet to avoid SSR issues with Next.js.
 * Future: Swap this block to load Google Maps SDK instead.
 */
export default function MapProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Leaflet window fix for Next.js SSR
    setIsMounted(true);
    
    // Future: Initialize Google Maps SDK script here instead if switching provider
    return () => {};
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center">Loading Map...</div>;

  return <>{children}</>;
}
