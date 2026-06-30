'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Settings, Truck, Zap, BarChart3, FileText,
  Boxes, LayoutTemplate, FolderArchive,
} from 'lucide-react';
import { crossAppUrl } from '@vectra/ui';
import { useCurrentWorkspace } from '@/lib/hooks/useTenantWorkspace';

interface SidebarItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Generic module key that enables this item; omit for always-on items. */
  module?: string;
  /** External (cross-app) link — opens in a new tab. */
  external?: boolean;
}

// Module-keyed nav. Which items show is driven by the union of enabled_modules
// from the workspace's selected type(s). Dashboard + Settings are always on.
const ITEMS: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Records', href: '/records', icon: Boxes, module: 'records' },
  { name: 'Programs', href: '/automations', icon: Zap, module: 'programs' },
  { name: 'Templates', href: '/templates', icon: LayoutTemplate, module: 'templates' },
  { name: 'Automations', href: '/automations', icon: Zap, module: 'automations' },
  { name: 'My Fleet', href: '/fleet', icon: Truck, module: 'fleet' },
  { name: 'Marketplace Intelligence', href: '/marketplace', icon: BarChart3, module: 'marketplace' },
  { name: 'Metrics', href: '/dashboard', icon: BarChart3, module: 'metrics' },
  { name: 'Documents', href: '/archive', icon: FolderArchive, module: 'documents' },
  // CMR history lives in the CMR app (cross-app); always offered as a convenience.
  { name: 'CMR Manager', href: crossAppUrl('cmr', '/'), icon: FileText, external: true },
];

const ALWAYS_BOTTOM: SidebarItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const { data: workspace } = useCurrentWorkspace();
  const enabled = new Set(workspace?.enabled_modules ?? []);

  // Show an item if it's always-on (no module) or its module is enabled.
  // De-dupe by href so overlapping module keys don't double-list a route.
  const seen = new Set<string>();
  const visible = ITEMS.filter((it) => {
    if (it.module && !enabled.has(it.module)) return false;
    if (seen.has(it.href + it.name)) return false;
    seen.add(it.href + it.name);
    return true;
  });

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const renderItem = (it: SidebarItem) => {
    const Icon = it.icon;
    const active = !it.external && isActive(it.href);
    const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
    }`;
    if (it.external) {
      return (
        <a key={it.name} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>
          <Icon className="w-4 h-4 flex-shrink-0" /> {it.name}
        </a>
      );
    }
    return (
      <Link key={it.name} href={it.href} className={cls}>
        <Icon className="w-4 h-4 flex-shrink-0" /> {it.name}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-gray-200 dark:border-dark-border bg-white/50 dark:bg-dark-bg/50 px-3 py-5 gap-1">
      <nav className="flex-1 space-y-1">{visible.map(renderItem)}</nav>
      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border space-y-1">
        {ALWAYS_BOTTOM.map(renderItem)}
      </div>
    </aside>
  );
}
