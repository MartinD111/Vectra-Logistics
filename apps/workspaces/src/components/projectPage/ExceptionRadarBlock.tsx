'use client';

// Exception Radar block: a passive live feed of active operational crises,
// updated over the socket (company room → 'exception:new' / 'exception:resolved').
// A "simulate" button injects a demo exception so dispatchers can see the live
// push without a connected integration.

import { Loader2, Radar, AlertTriangle, TrainFront, Anchor, Wrench, X, Zap } from 'lucide-react';
import type { ExceptionRadarBlock as ExceptionRadarBlockType } from '@/lib/projectPage/blocks';
import { useFleetExceptions, useSimulateException, useResolveException } from '@/lib/hooks/useFleet';
import type { FleetException } from '@/lib/api/fleet.api';

const KIND_ICON: Record<string, typeof Radar> = {
  border_delay: TrainFront,
  port_congestion: Anchor,
  wagon_damage: Wrench,
  engine_fault: Zap,
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50/60 dark:bg-red-900/10',
  warning: 'border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10',
  info: 'border-l-sky-500 bg-sky-50/60 dark:bg-sky-900/10',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ExceptionRow({ exception, onResolve, resolving }: {
  exception: FleetException; onResolve: () => void; resolving: boolean;
}) {
  const Icon = KIND_ICON[exception.kind] ?? AlertTriangle;
  return (
    <div className={`group/exc flex items-start gap-2.5 border-l-2 rounded-r-lg px-2.5 py-2 ${SEVERITY_STYLE[exception.severity] ?? SEVERITY_STYLE.info}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${exception.severity === 'critical' ? 'text-red-500' : exception.severity === 'warning' ? 'text-amber-500' : 'text-sky-500'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{exception.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{exception.kind.replace('_', ' ')} · {timeAgo(exception.created_at)}</p>
      </div>
      <button onClick={onResolve} disabled={resolving}
        className="opacity-0 group-hover/exc:opacity-100 text-gray-300 hover:text-emerald-600 transition-opacity flex-shrink-0 mt-0.5"
        title="Mark resolved">
        {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function ExceptionRadarView({ block }: { block: ExceptionRadarBlockType }) {
  const { data: exceptions, isLoading } = useFleetExceptions();
  const simulate = useSimulateException();
  const resolve = useResolveException();

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Radar className="w-4 h-4 text-gray-400" /> {block.title || 'Exception radar'}
          {(exceptions?.length ?? 0) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {exceptions!.length}
            </span>
          )}
        </h3>
        <button onClick={() => simulate.mutate()} disabled={simulate.isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-60"
          title="Inject a demo exception to see the live radar update.">
          {simulate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Simulate
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</div>
      ) : (exceptions ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Radar className="w-6 h-6" />
          <p className="text-xs">No active exceptions. All clear.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {(exceptions ?? []).map((e) => (
            <ExceptionRow key={e.id} exception={e}
              onResolve={() => resolve.mutate(e.id)}
              resolving={resolve.isPending && resolve.variables === e.id} />
          ))}
        </div>
      )}
    </div>
  );
}
