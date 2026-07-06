'use client';

// Client detail page (D-09): two-column layout — a persistent sidebar with
// inline click-to-edit fields (address, notes, responsible employee) and a
// main block canvas reusing LivePageCanvas/PageBlockView with the additive
// clientId prop (built in Task 2). Opened in a new tab from the CRM
// dashboard (/records) or the project page creator.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Loader2, Search, Check, Unlink as UnlinkIcon } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  useClient, useUpdateClient, useClientPage, useUpdateClientPage,
  useClientProjectLinks, useUpsertClientProjectLink, useUnlinkClientProjectLink,
} from '@/lib/hooks/useCrm';
import { useTeam } from '@/lib/hooks/useTeam';
import { useProjects } from '@/lib/hooks/useProjects';
import { isPageConfig, emptyPageConfig, uid, type PageConfig } from '@/lib/projectPage/blocks';
import LivePageCanvas from '@/components/projectPage/LivePageCanvas';
import type { CrmClient, CreateClientInput, ClientProjectLink, LinkProjectInput } from '@/lib/api/crm.api';
import type { TeamMember } from '@/lib/api/team.api';
import type { Project } from '@/lib/api/projects.api';

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
  const [canvasSaveError, setCanvasSaveError] = useState(false);
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
      const pending = config;
      updatePageRef.current.mutate(
        { config: pending as unknown as Record<string, unknown> },
        {
          onSuccess: () => {
            // Only clear dirty if no newer edit has occurred since this save started.
            if (configRef.current === pending) dirtyRef.current = false;
            setCanvasSaveError(false);
          },
          onError: () => setCanvasSaveError(true),
        },
      );
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, seeded, defaultsSeeded]);

  // Flush a pending save when leaving the page.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
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
          <LinkedProjectsSection clientId={clientId} team={team ?? []} />
          {canvasSaveError && (
            <p className="text-[11px] text-red-500 mb-2">Couldn&apos;t save your changes — try again.</p>
          )}
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
        onSave={(value, callbacks) => onUpdateClient.mutate({ id: client.id, data: { address: value } }, callbacks)}
      />

      <InlineTextField
        label="Notes"
        value={client.notes ?? ''}
        placeholder="Add notes…"
        multiline
        onSave={(value, callbacks) => onUpdateClient.mutate({ id: client.id, data: { notes: value } }, callbacks)}
      />

      <ResponsibleEmployeeField
        client={client}
        team={team}
        onSave={(id) => onUpdateClient.mutate({ id: client.id, data: { responsible_employee_id: id } })}
      />
    </div>
  );
}

// ── Linked Projects (CLI-04/CLI-05, D-01..D-05, 03-UI-SPEC) ─────────────────
// Attach a client to one or more projects via a searchable picker, then set
// per-project rate/employee/notes overrides without touching global defaults.
// Trusts the server-computed merged values + is_overridden flags exclusively
// (RESEARCH.md anti-pattern warning: never recompute override ?? global here).

function LinkedProjectsSection({ clientId, team }: { clientId: string; team: TeamMember[] }) {
  const { data: links } = useClientProjectLinks(clientId);
  const { data: projects } = useProjects();
  const upsertLink = useUpsertClientProjectLink(clientId);
  const unlinkMutation = useUnlinkClientProjectLink(clientId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [attachError, setAttachError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const linkedList = links ?? [];
  const projectList = projects ?? [];
  const linkedIds = new Set(linkedList.map((l) => l.project_id));

  const filteredProjects = projectList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()));

  const projectName = (projectId: string) => projectList.find((p) => p.id === projectId)?.name ?? 'Unknown project';

  const toggleExpanded = (projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const handleAttach = (project: Project) => {
    setAttachError(false);
    upsertLink.mutate({ project_id: project.id }, {
      onError: () => setAttachError(true),
    });
    setPickerOpen(false);
    setSearch('');
  };

  const handleUnlink = (projectId: string) => {
    setUnlinkError(null);
    unlinkMutation.mutate(projectId, {
      onSuccess: () => setUnlinkTarget(null),
      onError: () => setUnlinkError(projectId),
    });
  };

  return (
    <div className="saas-card !p-4 dark:bg-slate-800 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Linked Projects</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 min-h-[48px] px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            Attach project
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-30 w-80 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    autoFocus
                    className="saas-input !py-2 text-sm w-full pl-8"
                    placeholder="Search projects…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <p className="text-sm text-gray-400 italic px-2 py-2">No matching projects</p>
                  ) : (
                    filteredProjects.map((p) => {
                      const alreadyLinked = linkedIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAttach(p)}
                          className={`w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                            alreadyLinked ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          {alreadyLinked && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
                {attachError && (
                  <p className="text-[11px] text-red-500 px-2 pt-1">Couldn&apos;t attach this project — try again.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {linkedList.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Not attached to any projects yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Attach this client to a project to set project-specific rate, responsible employee, or notes.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 min-h-[48px] px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            Attach project
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {linkedList.map((link) => {
            const isExpanded = expanded.has(link.project_id);
            const overrideCount = Object.values(link.is_overridden).filter(Boolean).length;
            return (
              <div key={link.project_id}>
                <div className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors -mx-2 px-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(link.project_id)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left min-h-[48px] py-2"
                  >
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{projectName(link.project_id)}</span>
                    {overrideCount > 0 && (
                      <span className="text-[11px] font-semibold text-primary-600 flex-shrink-0">{overrideCount} override{overrideCount > 1 ? 's' : ''}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlinkTarget(link.project_id)}
                    className="flex items-center gap-1 text-red-500 hover:text-red-600 min-h-[48px] px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex-shrink-0"
                  >
                    <UnlinkIcon className="w-4 h-4" />
                    <span className="text-sm font-semibold">Unlink</span>
                  </button>
                </div>
                {unlinkError === link.project_id && (
                  <p className="text-[11px] text-red-500 pb-2">Couldn&apos;t unlink — try again.</p>
                )}
                {isExpanded && (
                  <LinkedProjectOverrideEditor clientId={clientId} link={link} team={team} upsertLink={upsertLink} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {unlinkTarget && (
        <UnlinkConfirmDialog
          projectName={projectName(unlinkTarget)}
          onCancel={() => setUnlinkTarget(null)}
          onConfirm={() => handleUnlink(unlinkTarget)}
        />
      )}
    </div>
  );
}

function UnlinkConfirmDialog({
  projectName, onCancel, onConfirm,
}: { projectName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Unlink this project?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This removes all rate, employee, and notes overrides for this project ({projectName}). The client&apos;s global defaults are not affected. This can&apos;t be undone — you&apos;ll need to re-enter any overrides if you reattach.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Unlink
          </button>
        </div>
      </div>
    </div>
  );
}

// Placeholder — Task 2 replaces this with the real per-field override editor.
function LinkedProjectOverrideEditor({
  clientId, link, team, upsertLink,
}: {
  clientId: string;
  link: ClientProjectLink;
  team: TeamMember[];
  upsertLink: UseMutationResult<ClientProjectLink, unknown, LinkProjectInput>;
}) {
  return null;
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
  onSave: (value: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
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
    const previous = lastSavedRef.current;
    lastSavedRef.current = next;
    setSaveState('saving');
    onSave(next, {
      onSuccess: () => setSaveState('idle'),
      onError: () => {
        // Revert so a retry (re-edit) doesn't get skipped as a no-op change.
        lastSavedRef.current = previous;
        setSaveState('error');
      },
    });
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
