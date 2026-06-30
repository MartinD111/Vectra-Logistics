'use client';

import { ReactNode, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@vectra/auth';
import { crossAppUrl } from '@vectra/ui';

/**
 * Gate for write actions on the Marketplace (post shipment, add capacity).
 * Browsing is public; these pages require sign-in. Guests are sent to the
 * Workspaces app's auth page and returned here afterward.
 */
export default function RequireSignIn({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || user || typeof window === 'undefined') return;
    const returnTo = window.location.href;
    window.location.href = crossAppUrl(
      'workspaces',
      `/auth?next=${encodeURIComponent(returnTo)}`,
    );
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-32">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking your session…
      </div>
    );
  }
  return <>{children}</>;
}
