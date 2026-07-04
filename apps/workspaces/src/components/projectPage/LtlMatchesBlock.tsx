'use client';

// Silent LTL matches block: the engine's suggestions for slotting unassigned
// partial loads onto the fleet's active FTL routes — empty truck space that
// could be earning money. Suggestions arrive live (ltl:suggestion); a "Scan"
// re-runs the engine. Accept adds the partial to the route; dismiss drops it.

import { Loader2, Sparkles, Route, TrendingUp, Check, X, Clock, Milestone } from 'lucide-react';
import type { LtlMatchesBlock as LtlMatchesBlockType } from '@/lib/projectPage/blocks';
import { useLtlSuggestions, useLtlScan, useAcceptLtl, useDismissLtl } from '@/lib/hooks/useLtl';
import type { LtlSuggestion } from '@/lib/api/ltl.api';

const eur = (n: number) => `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function SuggestionCard({ s, onAccept, onDismiss, busy }: {
  s: LtlSuggestion; onAccept: () => void; onDismiss: () => void; busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-slate-800 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            <Route className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
            <span className="truncate">{s.route_label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            <Milestone className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">+ {s.partial_label}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">
          score {s.score}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400" title="Extra distance vs the truck's base route">
          <TrendingUp className="w-3 h-3" /> +{s.detour_km} km
        </span>
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Clock className="w-3 h-3" /> +{s.detour_min} min
        </span>
        <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold">
          +{eur(s.margin_eur)} margin
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">revenue {eur(s.added_revenue_eur)} − detour cost</p>

      <div className="flex items-center gap-2 mt-2">
        <button onClick={onAccept} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-600 text-white text-[11px] font-semibold hover:bg-primary-700 disabled:opacity-60">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add to route
        </button>
        <button onClick={onDismiss} disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500 ml-auto">
          <X className="w-3 h-3" /> Dismiss
        </button>
      </div>
    </div>
  );
}

export function LtlMatchesView({ block }: { block: LtlMatchesBlockType }) {
  const { data: suggestions, isLoading } = useLtlSuggestions();
  const scan = useLtlScan();
  const accept = useAcceptLtl();
  const dismiss = useDismissLtl();

  const totalMargin = (suggestions ?? []).reduce((sum, s) => sum + s.margin_eur, 0);

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-gray-400" /> {block.title || 'LTL matches'}
          {(suggestions?.length ?? 0) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              +{eur(totalMargin)}
            </span>
          )}
        </h3>
        <button onClick={() => scan.mutate()} disabled={scan.isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-60"
          title="Scan active FTL routes against unassigned partial loads.">
          {scan.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Scan
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (suggestions ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Sparkles className="w-6 h-6" />
          <p className="text-xs">No matches yet. Run a scan to find spare-space loads.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(suggestions ?? []).map((s) => (
            <SuggestionCard key={s.id} s={s}
              onAccept={() => accept.mutate(s.id)}
              onDismiss={() => dismiss.mutate(s.id)}
              busy={(accept.isPending && accept.variables === s.id) || (dismiss.isPending && dismiss.variables === s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
