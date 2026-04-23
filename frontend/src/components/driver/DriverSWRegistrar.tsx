'use client';

import { useServiceWorker } from '@/hooks/useServiceWorker';

// Thin client component that triggers SW registration inside the driver shell
export function DriverSWRegistrar() {
  useServiceWorker();
  return null;
}
