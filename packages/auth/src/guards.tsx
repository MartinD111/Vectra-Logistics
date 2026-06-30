'use client';

import { ReactNode, useEffect } from 'react';
import type { UserRole } from '@vectra/types';
import { useAuth } from './AuthContext';

export interface RequireAuthProps {
  children: ReactNode;
  /** Where to send unauthenticated users. Defaults to the app's /auth page. */
  redirectTo?: string;
  /** Rendered while the session is being validated. */
  fallback?: ReactNode;
}

/** Gate that requires any authenticated user. */
export function RequireAuth({ children, redirectTo = '/auth', fallback = null }: RequireAuthProps) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  }, [isLoading, user, redirectTo]);

  if (isLoading) return <>{fallback}</>;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}

export interface RequireRoleProps extends RequireAuthProps {
  roles: UserRole[];
  /** Rendered when the user is signed in but lacks the required role. */
  deniedFallback?: ReactNode;
}

/** Gate that requires the authenticated user to hold one of `roles`. */
export function RequireRole({
  children,
  roles,
  redirectTo = '/auth',
  fallback = null,
  deniedFallback = null,
}: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  }, [isLoading, user, redirectTo]);

  if (isLoading) return <>{fallback}</>;
  if (!user) return <>{fallback}</>;
  if (!roles.includes(user.role)) return <>{deniedFallback}</>;
  return <>{children}</>;
}

export interface RequireWorkspaceProps extends RequireAuthProps {
  /** Where to send users who have no workspace yet (onboarding). */
  setupRedirect?: string;
}

/**
 * Gate that requires the authenticated user's company to have a workspace.
 * A user without a `company_id` is routed to setup. The workspace-existence
 * check itself is completed in Phase 3 once the workspaces API lands; for now
 * this guards on company association so the Workspaces app can adopt it early.
 */
export function RequireWorkspace({
  children,
  redirectTo = '/auth',
  setupRedirect = '/setup',
  fallback = null,
}: RequireWorkspaceProps) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    if (!user) {
      window.location.href = redirectTo;
    } else if (!user.company_id) {
      window.location.href = setupRedirect;
    }
  }, [isLoading, user, redirectTo, setupRedirect]);

  if (isLoading) return <>{fallback}</>;
  if (!user || !user.company_id) return <>{fallback}</>;
  return <>{children}</>;
}
