'use client';

import { useQuery } from '@tanstack/react-query';
import { ClockIcon, MapPin, Package, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { driverApi } from '@/lib/api/driver.api';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'completed';
  return (
    <span className={`
      inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
      text-xs font-bold uppercase tracking-wide
      ${ok ? 'bg-primary-900/60 text-primary-300' : 'bg-red-900/60 text-red-300'}
    `}>
      {ok
        ? <CheckCircle2 size={12} strokeWidth={2.5} />
        : <XCircle size={12} strokeWidth={2.5} />}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function HistoryPage() {
  const { data: history, isLoading, isError, refetch } = useQuery({
    queryKey: ['driver', 'history'],
    queryFn: () => driverApi.getHistory(),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-4 px-4 pt-6">
        <div className="h-7 w-40 rounded-lg bg-slate-800 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <XCircle size={48} className="text-red-400" />
        <p className="text-slate-300 text-lg text-center">Failed to load history.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold active:bg-slate-600"
        >
          <RefreshCw size={18} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 pt-6 pb-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <ClockIcon size={20} className="text-slate-400" />
        <h1 className="text-xl font-black tracking-tight">Delivery History</h1>
        {history && (
          <span className="ml-auto text-xs text-slate-500 font-medium">
            {history.length} runs
          </span>
        )}
      </div>

      {/* Empty state */}
      {history?.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
          <ClockIcon size={40} strokeWidth={1.4} />
          <p>No completed deliveries yet.</p>
        </div>
      )}

      {/* Cards */}
      {history?.map((entry) => (
        <article
          key={entry.id}
          className="rounded-2xl bg-slate-800 border border-slate-700 p-4 flex flex-col gap-3"
        >
          {/* Top row: id + status */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-400">
              #{entry.shipment_id.slice(0, 8).toUpperCase()}
            </span>
            <StatusBadge status={entry.final_status} />
          </div>

          {/* Addresses */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <p className="text-sm text-slate-300 leading-snug line-clamp-1">
                {entry.pickup_address}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 shrink-0" />
              <p className="text-sm text-slate-300 leading-snug line-clamp-1">
                {entry.delivery_address}
              </p>
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Package size={13} />
              <span>{entry.cargo_type}</span>
            </div>
            {entry.distance_km && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin size={13} />
                <span>{entry.distance_km} km</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ClockIcon size={13} />
              <span>{fmtDate(entry.completed_at)}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
