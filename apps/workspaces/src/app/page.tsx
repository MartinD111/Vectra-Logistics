'use client';

import { Briefcase, Store, FileText, ArrowRight } from 'lucide-react';
import { crossAppUrl } from '@vectra/ui';

// The home page is a launcher: pick a Vectra application. Each opens in a new
// tab. Marketplace and CMR are usable without signing in (Marketplace is
// view-only until you sign in to book; CMR is fully usable signed out).
const apps = [
  {
    key: 'workspace',
    name: 'Workspace',
    description:
      'Your company cockpit — programs, fleet, automations, KPIs, and CMR history. Sign in required.',
    icon: Briefcase,
    href: '/dashboard',
    sameTab: true,
    accent: 'from-primary-500 to-primary-700',
  },
  {
    key: 'marketplace',
    name: 'Marketplace',
    description:
      'Browse available freight and capacity on the Vectra network. View as a guest; sign in to book.',
    icon: Store,
    href: crossAppUrl('marketplace', '/board'),
    sameTab: false,
    accent: 'from-blue-500 to-blue-700',
  },
  {
    key: 'cmr',
    name: 'CMR Manager',
    description:
      'Create and manage e-CMR consignment notes. No account needed — sign in to keep a history.',
    icon: FileText,
    href: crossAppUrl('cmr', '/'),
    sameTab: false,
    accent: 'from-amber-500 to-amber-700',
  },
];

export default function HomeLauncher() {
  return (
    <div className="bg-white dark:bg-dark-bg transition-colors min-h-[calc(100vh-64px)]">
      <section className="mx-auto max-w-5xl px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Welcome to Vectra
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose an application to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <a
                key={app.key}
                href={app.href}
                target={app.sameTab ? undefined : '_blank'}
                rel={app.sameTab ? undefined : 'noopener noreferrer'}
                className="group saas-card flex flex-col items-start hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                <div
                  className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${app.accent} mb-5 shadow-lg`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {app.name}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                  {app.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 group-hover:gap-2.5 transition-all">
                  Open {app.name} <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
