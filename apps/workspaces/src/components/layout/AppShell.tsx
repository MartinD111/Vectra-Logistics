'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import WorkspaceSidebar from './WorkspaceSidebar';

// Routes that are full-width with NO sidebar: the home launcher, auth, and the
// first-run setup wizard.
const NO_SIDEBAR = ['/', '/auth', '/setup', '/how-it-works'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const hideSidebar =
    NO_SIDEBAR.some((p) => pathname === p || (p !== '/' && pathname.startsWith(p))) || !user;

  if (hideSidebar) {
    return <main className="flex-1 w-full relative">{children}</main>;
  }

  return (
    <div className="flex flex-1 w-full">
      <WorkspaceSidebar />
      <main className="flex-1 min-w-0 relative">{children}</main>
    </div>
  );
}
