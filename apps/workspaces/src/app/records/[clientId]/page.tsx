'use client';

// Client detail page (D-09): two-column layout — a persistent sidebar with
// inline click-to-edit fields (address, notes, responsible employee) and a
// main block canvas reusing LivePageCanvas/PageBlockView with the additive
// clientId prop (built in Task 2). Opened in a new tab from the CRM
// dashboard (/records) or the project page creator.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useClient, useUpdateClient, useClientPage, useUpdateClientPage } from '@/lib/hooks/useCrm';
import { useTeam } from '@/lib/hooks/useTeam';
import { isPageConfig, emptyPageConfig, uid, type PageConfig } from '@/lib/projectPage/blocks';
import LivePageCanvas from '@/components/projectPage/LivePageCanvas';
import type { CrmClient, CreateClientInput } from '@/lib/api/crm.api';
import type { TeamMember } from '@/lib/api/team.api';

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params?.clientId as string;

  const { data: client, isLoading: clientLoading, isError: clientError } = useClient(clientId);
  const { data: page, isLoading: pageLoading } = useClientPage(clientId);
  const updateClient = useUpdateClient();
  const updatePage = useUpdateClientPage(page?.id ?? '', clientId);
  const { data: team } = useTeam();

  // ── Canvas config: seed-once + debounced autosave, mirroring the project
  // page pattern (apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx).
  const [config, setConfig] = useState<PageConfig>(emptyPageConfig());
  const [seeded, setSeeded] = useState(false);
  const [defaultsSeeded, setDefaultsSeeded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const configRef = useRef(config);
  const updatePageRef = useRef(updatePage);
  const seededConfigRef = useRef<PageConfig | null>(null);
  configRef.current = config;
  updatePageRef.current = updatePage;

  if (!seeded && page) {
    const initial = isPageConfig(page.config) ? page.config : emptyPageConfig();
    seededConfigRef.current = initial;
    setConfig(initial);
    setSeeded(true);
  }

  // First-ever visit: a brand-new client_pages row has an empty blocks array.
  // Seed a default current-situation + timeline layout exactly once.
  useEffect(() => {
    if (!seeded || defaultsSeeded) return;
    if (config.blocks.length === 0) {
      const seededConfig: PageConfig = {
        version: 1,
        blocks: [
          { id: uid(), kind: 'client-current-situation', span: 'full', title: 'Current situation' },
          { id: uid(), kind: 'client-timeline', span: 'full', title: 'Timeline' },
        ],
      };
      seededConfigRef.current = seededConfig;
      setConfig(seededConfig);
    }
    setDefaultsSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    // Skip the effect run caused by seeding itself — only user edits save.
    if (!seeded || !defaultsSeeded || config === seededConfigRef.current) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirtyRef.current = false;
      updatePageRef.current.mutate({ config: config as unknown as Record<string, unknown> });
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, seeded, defaultsSeeded]);

  // Flush a pending save when leaving the page.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        updatePageRef.current.mutate({ config: configRef.current as unknown as Record<string, unknown> });
      }
    };
  }, []);

  if (clientLoading || pageLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Couldn&apos;t load this client.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Check your connection and try again, or return to the CRM dashboard.
        </p>
        <Link href="/records" className="text-primary-600 text-sm font-semibold underline">
          ← Back to CRM dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 flex gap-6 items-start">
        <ClientSidebar client={client} team={team ?? []} onUpdateClient={updateClient} />
        <div className="flex-1 min-w-0">
          <LivePageCanvas config={config} clientId={clientId} onChange={setConfig} />
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

type UpdateClientMutation = UseMutationResult<CrmClient, unknown, { id: string; data: Partial<CreateClientInput> }>;

function ClientSidebar({
  client, team, onUpdateClient,
}: { client: CrmClient; team: TeamMember[]; onUpdateClient: UpdateClientMutation }) {
  return (
    <div className="w-80 flex-shrink-0 saas-card !p-4 dark:bg-slate-800">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 truncate">{client.name}</h1>

      <InlineTextField
        label="Address"
        value={client.address ?? ''}
        placeholder="Add an address…"
        multiline={false}
        onSave={(value) => onUpdateClient.mutate({ id: client.id, data: { address: value } })}
      />

      <InlineTextField
        label="Notes"
        value={client.notes ?? ''}
        placeholder="Add notes…"
        multiline
        onSave={(value) => onUpdateClient.mutate({ id: client.id, data: { notes: value } })}
      />

      <ResponsibleEmployeeField
        client={client}
        team={team}
        onSave={(id) => onUpdateClient.mutate({ id: client.id, data: { responsible_employee_id: id } })}
      />
    </div>
  );
}

// ── Inline click-to-edit field (address / notes) ────────────────────────────
// Adapts the uncontrolled-contentEditable pattern from PageHeader's
// EditableTitle, plus an ~800ms debounce-while-typing autosave (D-10) beyond
// simple blur-commit.

function InlineTextField({
  label, value, placeholder, multiline, onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  multiline: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(value);

  // Sync external updates only while not actively editing.
  useEffect(() => {
    if (!editing) {
      setDraft(value);
      lastSavedRef.current = value;
    }
  }, [value, editing]);

  const flush = (next: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (next === lastSavedRef.current) return;
    lastSavedRef.current = next;
    setSaveState('saving');
    try {
      onSave(next);
      setSaveState('idle');
    } catch {
      setSaveState('error');
    }
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flush(next), 800);
  };

  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            className="saas-input !py-2 text-sm w-full min-h-[48px] resize-none"
            value={draft}
            rows={3}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => { flush(draft); setEditing(false); }}
          />
        ) : (
          <input
            autoFocus
            className="saas-input !py-2 text-sm w-full min-h-[48px]"
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => { flush(draft); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left min-h-[48px] px-2 py-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          {draft ? (
            <span className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{draft}</span>
          ) : (
            <span className="text-sm text-gray-400 italic">{placeholder}</span>
          )}
        </button>
      )}
      {saveState === 'error' && (
        <p className="text-[11px] text-red-500 mt-1">Couldn&apos;t save — try again</p>
      )}
    </div>
  );
}

// ── Responsible employee (D-13): flat team list, no role grouping ──────────

function ResponsibleEmployeeField({
  client, team, onSave,
}: { client: CrmClient; team: TeamMember[]; onSave: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = client.responsible_employee_id
    ? team.find((m) => m.id === client.responsible_employee_id)
    : null;
  const label = selected ? `${selected.first_name} ${selected.last_name}`.trim() : 'Unassigned';

  return (
    <div className="mb-1 relative">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Responsible employee</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left min-h-[48px] px-2 py-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <span className={`text-sm truncate ${selected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 italic'}`}>{label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
            <button
              type="button"
              onClick={() => { onSave(null); setOpen(false); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-gray-400 italic hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Unassigned
            </button>
            {team.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSave(m.id); setOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                {m.first_name} {m.last_name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
