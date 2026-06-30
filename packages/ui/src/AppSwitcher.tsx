'use client';

import { useState } from 'react';
import { Grid3x3, Store, Briefcase, FileText, Check } from 'lucide-react';
import { appUrls, type VectraApp } from './appUrls';

interface AppDef {
  key: VectraApp;
  name: string;
  icon: typeof Store;
}

const APPS: AppDef[] = [
  { key: 'marketplace', name: 'Marketplace', icon: Store },
  { key: 'workspaces', name: 'Workspaces', icon: Briefcase },
  { key: 'cmr', name: 'CMR Manager', icon: FileText },
];

export interface AppSwitcherProps {
  /** The app this switcher is rendered in (marked as current). */
  current: VectraApp;
}

/** Switches between the three Vectra surfaces via absolute cross-app URLs. */
export function AppSwitcher({ current }: AppSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch Vectra app"
        className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <Grid3x3 className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border py-1 animate-fade-in">
            <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Vectra
            </p>
            {APPS.map((app) => {
              const Icon = app.icon;
              const isCurrent = app.key === current;
              return (
                <a
                  key={app.key}
                  href={appUrls[app.key]}
                  className="flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" /> {app.name}
                  </span>
                  {isCurrent && <Check className="h-4 w-4 text-primary-500" />}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
