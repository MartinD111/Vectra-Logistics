'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  AlertCircle, ArrowLeft, Calendar, Loader2, MapPin, Package,
  Ruler, Scale, Truck, XCircle,
} from 'lucide-react';
import { useCapacity, useCancelCapacity } from '@/lib/hooks/useMarketplace';
import StatusBadge from '@/components/marketplace/StatusBadge';
import { ApiError } from '@/lib/api/client';
import { useState } from 'react';

const RoutePreviewMap = dynamic(() => import('@/components/map/RoutePreviewMap'), { ssr: false });

function fmtDateTime(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function CapacityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data: c, isLoading, error } = useCapacity(id);
  const cancel = useCancelCapacity();
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading capacity…
      </div>
    );
  }

  if (error || !c) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Capacity not found</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {error instanceof ApiError ? error.message : 'It may have been removed.'}
            </p>
            <Link href="/marketplace" className="text-sm font-medium text-primary-600 dark:text-primary-400 underline mt-2 inline-block">
              ← Back to marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canCancel = !['cancelled', 'completed'].includes(c.status);

  async function handleCancel() {
    if (!id) return;
    if (!confirm('Withdraw this capacity from the marketplace?')) return;
    setActionError(null);
    try {
      await cancel.mutateAsync(id);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Cancel failed.');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Truck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold dark:text-white">Capacity</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{c.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancel.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-semibold rounded-xl border border-red-200 dark:border-red-800/50"
            >
              {cancel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Withdraw
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Route</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Origin</p>
                <p className="font-medium text-slate-800 dark:text-white">{c.origin_address}</p>
                <p className="text-xs text-slate-500 mt-1">{c.origin_lat.toFixed(4)}, {c.origin_lng.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Destination</p>
                <p className="font-medium text-slate-800 dark:text-white">{c.destination_address}</p>
                <p className="text-xs text-slate-500 mt-1">{c.destination_lat.toFixed(4)}, {c.destination_lng.toFixed(4)}</p>
              </div>
            </div>
          </div>

          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Available Capacity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat icon={Scale} label="Weight" value={`${c.available_weight_kg.toLocaleString()} kg`} />
              <Stat icon={Ruler} label="Volume" value={`${c.available_volume_m3} m³`} />
              <Stat icon={Package} label="Pallets" value={String(c.available_pallets)} />
            </div>
          </div>

          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <ScheduleRow label="Departure" value={fmtDateTime(c.departure_time)} />
              <ScheduleRow label="Delivery deadline" value={fmtDateTime(c.delivery_deadline)} />
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-dark-border shadow-sm">
            <RoutePreviewMap
              origin={{ lat: c.origin_lat, lng: c.origin_lng, label: c.origin_address }}
              destination={{ lat: c.destination_lat, lng: c.destination_lng, label: c.destination_address }}
            />
          </div>
          <div className="saas-card text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Created {fmtDateTime(c.created_at)}</p>
            <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Vehicle: {c.vehicle_id.slice(0, 8)}…</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
      <Icon className="w-4 h-4 text-slate-400 mb-1" />
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-bold text-sm text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
