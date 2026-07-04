'use client';

// Drafts board: AI-parsed draft shipments grouped by status (Needs review →
// Validated → Confirmed). Cards derive from live draft data (React Query +
// socket), not page config. Dispatchers confirm a validated draft or reject
// any draft straight from the card.

import { Loader2, ClipboardCheck, CheckCircle2, X, AlertTriangle, TrainFront } from 'lucide-react';
import type { DraftsKanbanBlock as DraftsKanbanBlockType } from '@/lib/projectPage/blocks';
import { useDrafts, useConfirmDraft, useRejectDraft } from '@/lib/hooks/useInbox';
import type { ShipmentDraft, DraftStatus } from '@/lib/api/inbox.api';

/** DATE columns serialize as full ISO timestamps; show just the date. */
const fmtDate = (v: string | null) => (v ? v.slice(0, 10) : '?');

const COLUMNS: { status: DraftStatus; title: string }[] = [
  { status: 'needs_review', title: 'Needs review' },
  { status: 'validated', title: 'Validated' },
  { status: 'confirmed', title: 'Confirmed' },
];

export function DraftsKanbanView({ block, projectId }: { block: DraftsKanbanBlockType; projectId: string }) {
  // Project-scoped board when embedded on a project page.
  const { data: drafts, isLoading } = useDrafts(projectId);
  const confirm = useConfirmDraft(projectId);
  const reject = useRejectDraft(projectId);

  const byStatus = (status: DraftStatus) => (drafts ?? []).filter((d) => d.status === status);

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <ClipboardCheck className="w-4 h-4 text-gray-400" /> {block.title || 'Draft shipments'}
        {(drafts?.length ?? 0) > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">
            {drafts!.length}
          </span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading drafts…</div>
      ) : (drafts ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <ClipboardCheck className="w-6 h-6" />
          <p className="text-xs">No drafts yet. Parse an email in the Smart inbox to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {COLUMNS.map((col) => {
            const items = byStatus(col.status);
            return (
              <div key={col.status} className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{col.title}</span>
                  <span className="text-[10px] text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((d) => (
                    <DraftCard key={d.id} draft={d}
                      onConfirm={() => confirm.mutate(d.id)}
                      onReject={() => reject.mutate(d.id)}
                      busy={(confirm.isPending && confirm.variables === d.id) || (reject.isPending && reject.variables === d.id)} />
                  ))}
                  {items.length === 0 && <p className="text-[11px] text-gray-400 px-1 py-2">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, onConfirm, onReject, busy }: {
  draft: ShipmentDraft; onConfirm: () => void; onReject: () => void; busy: boolean;
}) {
  const errors = draft.validation?.errors ?? [];
  const canConfirm = draft.status !== 'confirmed' && errors.length === 0;
  return (
    <div className="group/draft rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
          {draft.origin ?? '?'} → {draft.destination ?? '?'}
        </span>
        {draft.wagon_number && <TrainFront className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
      </div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
        {draft.cargo_type && <p className="truncate">{draft.cargo_type}{draft.weight_kg != null ? ` · ${draft.weight_kg.toLocaleString()} kg` : ''}</p>}
        {(draft.pickup_date || draft.delivery_date) && <p>{fmtDate(draft.pickup_date)} → {fmtDate(draft.delivery_date)}</p>}
        {draft.reference && <p className="text-gray-400">Ref {draft.reference}</p>}
      </div>

      {errors.length > 0 && (
        <p className="mt-1 text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {errors[0]}
        </p>
      )}

      {draft.status !== 'confirmed' && (
        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover/draft:opacity-100 transition-opacity">
          <button onClick={onConfirm} disabled={!canConfirm || busy}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canConfirm ? 'Confirm draft' : 'Fix validation errors first'}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Confirm
          </button>
          <button onClick={onReject} disabled={busy}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-red-500 ml-auto">
            <X className="w-3 h-3" /> Reject
          </button>
        </div>
      )}
      {draft.status === 'confirmed' && (
        <p className="mt-1.5 text-[10px] text-primary-600 dark:text-primary-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Confirmed
        </p>
      )}
    </div>
  );
}
