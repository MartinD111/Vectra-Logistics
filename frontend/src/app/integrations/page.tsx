'use client';

import { useState } from 'react';
import {
  Satellite,
  Package,
  Map,
  FileText,
  Layers,
  Zap,
  Radio,
  KeyRound,
  Lock,
  CheckCircle2,
  Clock,
  Wrench,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthType = 'oauth2' | 'apikey' | 'open' | 'apikey-oauth';
type StatusType = 'coming-soon' | 'planned';

interface Integration {
  name: string;
  description: string;
  authType: AuthType;
  status: StatusType;
}

interface TabCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  useCase?: string;
  dataFields?: string[];
  integrations: Integration[];
}

interface ArchitectureItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const TAB_CATEGORIES: TabCategory[] = [
  {
    id: 'telematics',
    label: 'Fleet Telematics',
    icon: Satellite,
    description: 'Real-time truck tracking. Data feeds directly into My Fleet module.',
    useCase:
      'truck tracking · capacity prediction · empty truck detection · automatic load suggestions',
    dataFields: ['truck ID', 'GPS location', 'speed', 'trip status', 'driver status'],
    integrations: [
      {
        name: 'Samsara',
        description: 'GPS tracking, driver behavior, ELD compliance',
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'Geotab',
        description: 'Fleet management and telematics platform',
        authType: 'oauth2',
        status: 'coming-soon',
      },
      {
        name: 'Webfleet',
        description: "TomTom's fleet management solution",
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'Wialon',
        description: 'Advanced GPS monitoring platform',
        authType: 'apikey',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'tms',
    label: 'Transport Management',
    icon: Package,
    description:
      'Sync shipments, dispatch data, and fleet assignments with external TMS platforms.',
    integrations: [
      {
        name: 'Transporeon',
        description: "Europe's leading transport procurement platform",
        authType: 'oauth2',
        status: 'coming-soon',
      },
      {
        name: 'Alpega TMS',
        description: 'End-to-end transport management',
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'McLeod Software',
        description: 'Trucking and logistics management',
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'Custom Dispatch System',
        description: 'Connect any dispatch system via REST API',
        authType: 'apikey-oauth',
        status: 'planned',
      },
    ],
  },
  {
    id: 'maps',
    label: 'Maps & Navigation',
    icon: Map,
    description:
      'Route calculation, distance, toll estimation and truck restriction detection.',
    integrations: [
      {
        name: 'Google Maps Platform',
        description: 'Industry-standard geocoding and routing',
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'HERE Maps API',
        description: 'Truck-specific routing with restriction awareness',
        authType: 'apikey',
        status: 'coming-soon',
      },
      {
        name: 'OpenStreetMap / OSRM',
        description: 'Open-source map fallback with no licensing costs',
        authType: 'open',
        status: 'planned',
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents & Logistics',
    icon: FileText,
    description: 'Automated document generation and verification.',
    integrations: [
      {
        name: 'eCMR Providers',
        description: 'Electronic CMR document generation and exchange',
        authType: 'oauth2',
        status: 'planned',
      },
      {
        name: 'Customs Systems',
        description: 'Integration with national customs documentation systems',
        authType: 'apikey',
        status: 'planned',
      },
      {
        name: 'Invoice Automation',
        description: 'Connect with accounting systems for automated invoicing',
        authType: 'oauth2',
        status: 'planned',
      },
    ],
  },
];

const ARCHITECTURE_ITEMS: ArchitectureItem[] = [
  {
    icon: Layers,
    title: 'Integration Service Layer',
    description:
      'Modular adapter pattern. Each integration implements a standard interface.',
  },
  {
    icon: Zap,
    title: 'Event Processing System',
    description: 'Async event queue for processing incoming webhook payloads.',
  },
  {
    icon: Radio,
    title: 'Webhook Handlers',
    description: 'Receive real-time push notifications from external systems.',
  },
  {
    icon: KeyRound,
    title: 'API Credential Manager',
    description: 'Encrypted storage for API keys and OAuth tokens per company.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AuthBadge({ type }: { type: AuthType }) {
  const base =
    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border';

  if (type === 'oauth2') {
    return (
      <span
        className={`${base} bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:border-blue-800`}
      >
        OAuth 2.0
      </span>
    );
  }
  if (type === 'open') {
    return (
      <span
        className={`${base} bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/25 dark:text-primary-300 dark:border-primary-800`}
      >
        None (Open)
      </span>
    );
  }
  if (type === 'apikey-oauth') {
    return (
      <span
        className={`${base} bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600`}
      >
        API Key / OAuth
      </span>
    );
  }
  // default: apikey
  return (
    <span
      className={`${base} bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600`}
    >
      API Key
    </span>
  );
}

function StatusBadge({ status }: { status: StatusType }) {
  if (status === 'coming-soon') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
        <Clock className="w-3 h-3" />
        Coming Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
      <Wrench className="w-3 h-3" />
      Planned
    </span>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div className="saas-card flex flex-col gap-4">
      {/* Top row: name + REST API label */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
            {integration.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            {integration.description}
          </p>
        </div>
        <span className="shrink-0 text-[9px] font-bold tracking-widest uppercase text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-1 rounded-lg mt-0.5">
          REST API
        </span>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <AuthBadge type={integration.authType} />
        <StatusBadge status={integration.status} />
      </div>

      {/* Configure button */}
      <button
        disabled
        className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl
                   text-sm font-semibold border
                   bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed
                   dark:bg-slate-800/60 dark:text-slate-500 dark:border-slate-700
                   transition-colors"
        aria-disabled="true"
      >
        <Lock className="w-3.5 h-3.5" />
        Configure
      </button>
    </div>
  );
}

function ArchitectureCard({ item }: { item: ArchitectureItem }) {
  const Icon = item.icon;
  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl border border-slate-700 dark:border-slate-800 p-6 flex flex-col gap-4 hover:border-slate-500 dark:hover:border-slate-600 transition-all duration-300 group">
      <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 flex items-center justify-center group-hover:border-primary-700 transition-colors">
        <Icon className="w-5 h-5 text-primary-400" />
      </div>
      <div>
        <h3 className="font-bold text-white text-sm leading-snug">{item.title}</h3>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{item.description}</p>
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [activeTabId, setActiveTabId] = useState<string>('telematics');

  const activeCategory = TAB_CATEGORIES.find((t) => t.id === activeTabId)!;
  const ActiveIcon = activeCategory.icon;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 pb-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-gray-200 dark:border-dark-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                Integrations{' '}
                <span className="text-primary-600 dark:text-primary-400">Hub</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Infrastructure Ready
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              Connect VECTRA with external systems. All integrations are modular and can be
              added independently.
            </p>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex flex-wrap gap-0 border-b border-gray-200 dark:border-dark-border mb-8">
          {TAB_CATEGORIES.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div key={activeTabId} className="animate-fade-in">

          {/* Section description + use-case banner */}
          <div className="mb-7 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/40 shrink-0 mt-0.5">
                <ActiveIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed pt-1">
                {activeCategory.description}
              </p>
            </div>

            {activeCategory.useCase && (
              <div className="flex items-center gap-2.5 bg-primary-50/60 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl px-4 py-2.5 w-max max-w-full">
                <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 animate-pulse" />
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 leading-relaxed">
                  {activeCategory.useCase}
                </span>
              </div>
            )}
          </div>

          {/* Integration Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {activeCategory.integrations.map((integration) => (
              <IntegrationCard key={integration.name} integration={integration} />
            ))}
          </div>

          {/* Data Fields Banner — telematics only */}
          {activeCategory.dataFields && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mr-1">
                Data Fields
              </span>
              <span className="text-gray-300 dark:text-slate-600 text-xs mr-1">·</span>
              {activeCategory.dataFields.map((field, idx) => (
                <span
                  key={field}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── System Architecture Section ── */}
        <div className="mt-16">
          <div className="flex items-start justify-between mb-6 border-b border-gray-200 dark:border-dark-border pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                System Architecture
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Infrastructure layers that power the Integrations Hub.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 mt-1">
              <Layers className="w-3.5 h-3.5" />
              Backend Layer
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ARCHITECTURE_ITEMS.map((item) => (
              <ArchitectureCard key={item.title} item={item} />
            ))}
          </div>

          {/* Subtle bottom note */}
          <p className="mt-6 text-xs text-gray-400 dark:text-slate-600 text-center">
            All integration adapters communicate through the internal VECTRA event bus — no
            direct service coupling.
          </p>
        </div>

      </div>
    </div>
  );
}
