'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Settings, Truck, Zap, BarChart3, FileText,
  Boxes, LayoutTemplate, FolderArchive, Plus, FolderKanban,
} from 'lucide-react';
import { crossAppUrl } from '@vectra/ui';
import { useCurrentWorkspace } from '@/lib/hooks/useTenantWorkspace';
import { useProjects } from '@/lib/hooks/useProjects';

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
  const { data: projects } = useProjects();
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

  const projectActive = (id: string) => pathname.startsWith(`/projects/${id}`);

  return (
    <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-gray-200 dark:border-dark-border bg-white/50 dark:bg-dark-bg/50 px-3 py-5 gap-1 overflow-y-auto">
      <nav className="space-y-1">{visible.map(renderItem)}</nav>

      {/* Projects — user-created containers that organize programs + stats */}
      <div className="mt-5 flex-1">
        <div className="flex items-center justify-between px-3 mb-1.5">
          <Link
            href="/projects"
            className="text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1.5"
          >
            <FolderKanban className="w-3.5 h-3.5" /> Projects
          </Link>
          <Link
            href="/projects?new=1"
            title="New project"
            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            <Plus className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-0.5">
          {(projects ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                projectActive(p.id)
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color ?? '#94a3b8' }}
              />
              <span className="truncate flex-1">{p.name}</span>
              {typeof p.program_count === 'number' && p.program_count > 0 && (
                <span className="text-[10px] text-gray-400">{p.program_count}</span>
              )}
            </Link>
          ))}
          {(projects ?? []).length === 0 && (
            <Link
              href="/projects?new=1"
              className="block px-3 py-1.5 text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              + Create your first project
            </Link>
          )}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border space-y-1">
        {ALWAYS_BOTTOM.map(renderItem)}
      </div>
    </aside>
  );
}
