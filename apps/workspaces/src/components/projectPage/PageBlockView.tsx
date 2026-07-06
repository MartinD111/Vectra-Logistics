'use client';

// Read-mode rendering of a single project-page block. Widget blocks fetch
// their own data via existing hooks, keyed on projectId — there is no shared
// runtime/dataset (unlike mini-program blocks). Adding a new block kind means
// adding a case here + a member in lib/projectPage/blocks.ts + (optionally) a
// settings panel in PageBlockSettings.tsx.

import { useMemo } from 'react';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Loader2, Inbox, FileCode2, CalendarClock, RefreshCw, Play, ExternalLink } from 'lucide-react';
import type {
  PageBlock, RichTextBlock, HeadingBlock, ListBlock, PeopleBlock, StatCardsBlock, KpiGridBlock,
  ChartBlock, ActivityTimelineBlock, ProgramLinkBlock, MiniProgramBlock,
} from '@/lib/projectPage/blocks';
import { ClientCurrentSituationBlockView } from './ClientCurrentSituationBlock';
import { ClientTimelineBlockView } from './ClientTimelineBlock';
import { isMiniProgramConfig } from '@/lib/miniProgram/blocks';
import { useProjectStats, useProjectActivity, usePrograms, useProgram, useProjectCalendar } from '@/lib/hooks/useProjects';
import { useProjectMembers } from '@/lib/hooks/useTeam';
import { useKpiSummary } from '@/lib/hooks/useKpi';
import { useSyncOutlookCalendar } from '@/lib/hooks/useOutlook';
import { EmailCampaignView } from './EmailCampaignBlock';
import { KanbanBoardView } from './KanbanBlock';
import { FleetTelematicsView } from './FleetTelematicsBlock';
import { SpotQuoteView } from './SpotQuoteBlock';
import { ExceptionRadarView } from './ExceptionRadarBlock';
import { OmniChatView } from './OmniChatBlock';
import { SmartInboxView } from './SmartInboxBlock';
import { DraftsKanbanView } from './DraftsKanbanBlock';
import { YardMapView } from './YardMapBlock';
import { RailwayTerminalView } from './RailwayTerminalBlock';
import { PodTrackerView } from './PodTrackerBlock';
import { OmniDocsView } from './OmniDocsBlock';
import { CrmClientsView } from './CrmClientsBlock';
import { VatMatrixView } from './VatMatrixBlock';
import { InvoicesView } from './InvoicesBlock';
import { LtlMatchesView } from './LtlMatchesBlock';
import MiniProgramPlayer from '@/components/miniProgram/MiniProgramPlayer';

const clean = (html: string): string =>
  typeof window === 'undefined' ? '' : DOMPurify.sanitize(html);

function timeAgo(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PageBlockView({
  block, projectId, clientId, onChange,
}: {
  block: PageBlock;
  projectId?: string;
  /** Set only on the client detail page (/records/[clientId]) canvas. */
  clientId?: string;
  /** Present on the live canvas — lets interactive widgets (kanban) write back to the config. */
  onChange?: (block: PageBlock) => void;
}) {
  switch (block.kind) {
    case 'heading': return <HeadingView block={block} />;
    case 'rich-text': return <RichTextView block={block} />;
    case 'list': return <ListView block={block} />;
    case 'divider': return <hr className="border-gray-200 dark:border-slate-700" />;
    case 'mini-program': return <MiniProgramEmbedView block={block} />;
    case 'kanban': return <KanbanBoardView block={block} onChange={onChange} />;
    case 'people': return <PeopleView block={block} projectId={projectId as string} />;
    case 'stat-cards': return <StatCardsView block={block} projectId={projectId as string} />;
    case 'kpi-grid': return <KpiGridView block={block} projectId={projectId as string} />;
    case 'chart': return <ChartWidgetView block={block} projectId={projectId as string} />;
    case 'activity-timeline': return <ActivityTimelineView block={block} projectId={projectId as string} />;
    case 'program-link': return <ProgramLinkView block={block} projectId={projectId as string} />;
    case 'calendar': return <CalendarView projectId={projectId as string} />;
    case 'email-campaign': return <EmailCampaignView projectId={projectId as string} />;
    case 'fleet-telematics': return <FleetTelematicsView block={block} />;
    case 'spot-quote': return <SpotQuoteView block={block} />;
    case 'exception-radar': return <ExceptionRadarView block={block} />;
    case 'omni-chat': return <OmniChatView block={block} projectId={projectId as string} />;
    case 'smart-inbox': return <SmartInboxView block={block} projectId={projectId as string} />;
    case 'drafts-kanban': return <DraftsKanbanView block={block} projectId={projectId as string} />;
    case 'yard-map': return <YardMapView block={block} projectId={projectId as string} />;
    case 'railway-terminal': return <RailwayTerminalView block={block} />;
    case 'pod-tracker': return <PodTrackerView block={block} />;
    case 'omni-docs': return <OmniDocsView block={block} />;
    case 'crm-clients': return <CrmClientsView block={block} />;
    case 'vat-matrix': return <VatMatrixView block={block} />;
    case 'invoices': return <InvoicesView block={block} />;
    case 'ltl-matches': return <LtlMatchesView block={block} />;
    case 'client-current-situation': return <ClientCurrentSituationBlockView block={block} clientId={clientId as string} />;
    case 'client-timeline': return <ClientTimelineBlockView block={block} clientId={clientId as string} />;
    default:
      return null;
  }
}

// ── Content ───────────────────────────────────────────────────────────────────

function HeadingView({ block }: { block: HeadingBlock }) {
  const cls = block.level === 1 ? 'text-2xl font-black' : block.level === 2 ? 'text-lg font-bold' : 'text-base font-semibold';
  const Tag = (`h${block.level}` as unknown) as 'h1' | 'h2' | 'h3';
  return <Tag className={`${cls} text-gray-900 dark:text-white`}>{block.text}</Tag>;
}

function RichTextView({ block }: { block: RichTextBlock }) {
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: clean(block.html) }} />;
}

function ListView({ block }: { block: ListBlock }) {
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: clean(block.html) }} />;
}

/** Embeds a runnable mini program (config version 2) directly on the page. */
function MiniProgramEmbedView({ block }: { block: MiniProgramBlock }) {
  const { data: program, isLoading } = useProgram(block.programId ?? '');
  if (!block.programId) {
    return (
      <div className="saas-card !p-6 flex flex-col items-center gap-2 text-gray-400">
        <Play className="w-6 h-6" />
        <p className="text-xs">Pick a mini program in this block&apos;s settings.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="saas-card !p-6 flex items-center gap-2 text-gray-400 justify-center text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading program…
      </div>
    );
  }
  if (!program || !isMiniProgramConfig(program.config)) {
    return (
      <div className="saas-card !p-6 text-center">
        <p className="text-xs text-gray-400">This program can&apos;t be embedded (not a mini program, or it was deleted).</p>
      </div>
    );
  }
  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Play className="w-4 h-4 text-gray-400" /> {program.name}
        </h3>
        <Link href={`/programs/${program.id}/run`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
          Open <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <MiniProgramPlayer config={program.config} compact />
    </div>
  );
}

// ── Widgets ──────────────────────────────────────────────────────────────────

function PeopleView({ block, projectId }: { block: PeopleBlock; projectId: string }) {
  const { data: members, isLoading } = useProjectMembers(projectId);
  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (members ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No one assigned to this project yet.</p>
      ) : (
        <div className="space-y-2">
          {(members ?? []).map((m) => (
            <div key={m.assignment_id} className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {m.first_name?.[0]}{m.last_name?.[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.first_name} {m.last_name}</p>
                <p className="text-xs text-gray-400 truncate">{m.custom_role_title ?? 'Team member'}</p>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">{m.planned_pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCardsView({ projectId }: { block: StatCardsBlock; projectId: string }) {
  const { data: stats } = useProjectStats(projectId);
  const cards = [
    { label: 'Programs', value: stats?.program_count ?? 0 },
    { label: 'Total events', value: stats?.total_events ?? 0 },
    { label: 'Last 7 days', value: stats?.events_last_7d ?? 0 },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="saas-card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{c.label}</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  computed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  unavailable: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function KpiGridView({ block, projectId }: { block: KpiGridBlock; projectId: string }) {
  const { data: summary, isLoading } = useKpiSummary({ project_id: projectId });
  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (summary ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No KPI results for this project yet.</p>
      ) : (
        <div className="space-y-2">
          {(summary ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{r.rule_name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {r.actual_value ?? '—'}{r.target_value != null ? ` / ${r.target_value}` : ''}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartWidgetView({ block, projectId }: { block: ChartBlock; projectId: string }) {
  const { data: activity } = useProjectActivity(projectId, 100);
  const { data: summary } = useKpiSummary({ project_id: projectId });

  const data = useMemo(() => {
    if (block.source === 'kpi-results') {
      return (summary ?? []).map((r) => ({ name: r.rule_name.slice(0, 12), value: r.actual_value ?? 0 }));
    }
    if (block.source === 'activity-by-verb') {
      const byVerb = new Map<string, number>();
      for (const e of activity ?? []) byVerb.set(e.verb, (byVerb.get(e.verb) ?? 0) + 1);
      return Array.from(byVerb.entries()).map(([name, value]) => ({ name, value }));
    }
    // activity-by-day
    const byDay = new Map<string, number>();
    for (const e of activity ?? []) {
      const day = e.occurred_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
  }, [block.source, activity, summary]);

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 py-10 text-center">Not enough data yet.</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {block.chartType === 'line' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ActivityTimelineView({ block, projectId }: { block: ActivityTimelineBlock; projectId: string }) {
  const { data: activity, isLoading } = useProjectActivity(projectId, block.pageSize);
  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (activity ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Inbox className="w-6 h-6" />
          <p className="text-xs">No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {(activity ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
              <span className="text-gray-600 dark:text-gray-300">{e.verb}</span>
              <span className="text-gray-400 flex-shrink-0">{timeAgo(e.occurred_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramLinkView({ block, projectId }: { block: ProgramLinkBlock; projectId: string }) {
  const { data: programs } = usePrograms(projectId);
  const linked = block.programId ? (programs ?? []).filter((p) => p.id === block.programId) : (programs ?? []);
  return (
    <div className="saas-card !p-4">
      {linked.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No programs to show.</p>
      ) : (
        <div className="space-y-2">
          {linked.slice(0, block.programId ? 1 : 5).map((p) => (
            <Link key={p.id} href={`/programs/${p.id}`}
              className="flex items-center gap-2 text-sm hover:text-primary-600 transition-colors">
              <FileCode2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate text-gray-800 dark:text-gray-200">{p.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarView({ projectId }: { projectId: string }) {
  const { data: events, isLoading } = useProjectCalendar(projectId);
  const sync = useSyncOutlookCalendar();

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-gray-400" /> Calendar
        </h3>
        <button onClick={() => sync.mutate()} disabled={sync.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${sync.isPending ? 'animate-spin' : ''}`} /> Sync from Outlook
        </button>
      </div>
      {sync.data && (
        <p className="text-xs text-gray-400 mb-2">
          {sync.data.skipped ? sync.data.skipped : `Synced ${sync.data.synced} event(s).`}
        </p>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (events ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          No meetings categorized to this project yet. Tag an Outlook meeting with a category matching this project&apos;s name, then sync.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {(events ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
              <span className="text-gray-700 dark:text-gray-200 truncate">{e.subject ?? '(no subject)'}</span>
              <span className="text-gray-400 flex-shrink-0">
                {new Date(e.start_at).toLocaleDateString()} {e.is_all_day ? '' : new Date(e.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
