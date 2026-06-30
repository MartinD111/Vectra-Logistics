'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  AlertCircle, ArrowLeft, Calendar, Loader2, MapPin, Package,
  Ruler, Scale, Truck, XCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import {
  useShipment, useShipmentMatches, useBookShipment, useCancelShipment,
} from '@/lib/hooks/useMarketplace';
import StatusBadge from '@/components/marketplace/StatusBadge';
import { ApiError } from '@/lib/api/client';
import { useState } from 'react';
import FileUploader from '@/components/documents/FileUploader';
import DocumentList from '@/components/documents/DocumentList';
import ChatPanel from '@/components/chat/ChatPanel';
import { useLiveShipment } from '@/lib/hooks/useLiveShipment';

const RoutePreviewMap = dynamic(() => import('@/components/map/RoutePreviewMap'), { ssr: false });
const LiveTrackingMap = dynamic(() => import('@/components/map/LiveTrackingMap'), { ssr: false });

function fmtDateTime(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data: s, isLoading, error } = useShipment(id);
  const matchesQ = useShipmentMatches(id);
  const book = useBookShipment();
  const cancel = useCancelShipment();
  const { location: liveLocation } = useLiveShipment(id);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading shipment…
      </div>
    );
  }

  if (error || !s) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Shipment not found</p>
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

  const canCancel = !['cancelled', 'completed', 'delivered'].includes(s.status);
  const isOpen = s.status === 'open' || s.status === 'pending';

  async function handleBook(capacityId?: string) {
    if (!id) return;
    setActionError(null);
    try {
      await book.mutateAsync({ shipmentId: id, capacityId });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Booking failed.');
    }
  }

  async function handleCancel() {
    if (!id) return;
    if (!confirm('Cancel this shipment? This cannot be undone.')) return;
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
            <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold dark:text-white">Shipment</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{s.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={() => handleBook()}
              disabled={book.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl"
            >
              {book.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm Booking
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancel.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-semibold rounded-xl border border-red-200 dark:border-red-800/50"
            >
              {cancel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel
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
        {/* Left: details */}
        <div className="space-y-6">
          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Route</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Pickup</p>
                <p className="font-medium text-slate-800 dark:text-white">{s.pickup_address}</p>
                <p className="text-xs text-slate-500 mt-1">{s.pickup_lat.toFixed(4)}, {s.pickup_lng.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Delivery</p>
                <p className="font-medium text-slate-800 dark:text-white">{s.delivery_address}</p>
                <p className="text-xs text-slate-500 mt-1">{s.delivery_lat.toFixed(4)}, {s.delivery_lng.toFixed(4)}</p>
              </div>
            </div>
          </div>

          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Cargo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Scale} label="Weight" value={`${s.cargo_weight_kg.toLocaleString()} kg`} />
              <Stat icon={Ruler} label="Volume" value={`${s.cargo_volume_m3} m³`} />
              <Stat icon={Package} label="Pallets" value={String(s.pallet_count)} />
              <Stat icon={Sparkles} label="Type" value={s.cargo_type || '—'} />
            </div>
          </div>

          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <ScheduleRow label="Pickup window start" value={fmtDateTime(s.pickup_window_start)} />
              <ScheduleRow label="Pickup window end" value={fmtDateTime(s.pickup_window_end)} />
              <ScheduleRow label="Delivery deadline" value={fmtDateTime(s.delivery_deadline)} />
            </div>
          </div>

          {/* Documents */}
          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Documents</h2>
            <DocumentList subject="shipment" subjectId={s.id} emptyMessage="No documents attached to this shipment yet." />
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
              <FileUploader
                subject="shipment"
                subjectId={s.id}
                allowedTypes={['cmr', 'pod', 'invoice', 'photo', 'other']}
                label="Upload document (CMR, POD, invoice…)"
              />
            </div>
          </div>

          {/* Matches */}
          <div className="saas-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Suggested Capacity Matches
            </h2>

            {matchesQ.isLoading && (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Running matching engine…
              </p>
            )}

            {matchesQ.error && (
              <p className="text-sm text-slate-500 italic">
                Matching engine unavailable. Try again later or browse the marketplace.
              </p>
            )}

            {matchesQ.data && matchesQ.data.length === 0 && (
              <p className="text-sm text-slate-500">No matching capacities found yet.</p>
            )}

            {matchesQ.data && matchesQ.data.length > 0 && (
              <div className="space-y-2">
                {matchesQ.data.map((m) => (
                  <div key={m.capacity_id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-slate-700/40">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-black text-sm flex items-center justify-center">
                      {Math.round(m.score * 100)}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {m.capacity?.origin_address ?? 'Capacity'} → {m.capacity?.destination_address ?? ''}
                      </p>
                      {m.rationale && <p className="text-xs text-slate-500 mt-0.5">{m.rationale}</p>}
                      {typeof m.detour_km === 'number' && (
                        <p className="text-xs text-slate-500 mt-0.5">Detour: {m.detour_km.toFixed(1)} km</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/capacities/${m.capacity_id}`}
                        className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        View
                      </Link>
                      {isOpen && (
                        <button
                          onClick={() => handleBook(m.capacity_id)}
                          disabled={book.isPending}
                          className="text-xs font-semibold px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                        >
                          Book
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: map */}
        <aside className="space-y-3">
          <div className="h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-dark-border shadow-sm relative">
            {liveLocation ? (
              <LiveTrackingMap
                origin={{ lat: s.pickup_lat, lng: s.pickup_lng, label: s.pickup_address }}
                destination={{ lat: s.delivery_lat, lng: s.delivery_lng, label: s.delivery_address }}
                live={liveLocation}
              />
            ) : (
              <RoutePreviewMap
                origin={{ lat: s.pickup_lat, lng: s.pickup_lng, label: s.pickup_address }}
                destination={{ lat: s.delivery_lat, lng: s.delivery_lng, label: s.delivery_address }}
              />
            )}
            {liveLocation && (
              <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                LIVE
              </div>
            )}
          </div>
          <div className="saas-card text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Created {fmtDateTime(s.created_at)}</p>
            <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Updated {fmtDateTime(s.updated_at)}</p>
            {liveLocation && (
              <p className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <MapPin className="w-3.5 h-3.5" />
                Last ping {new Date(liveLocation.recorded_at).toLocaleTimeString()}
                {typeof liveLocation.speed_kph === 'number' && <> · {liveLocation.speed_kph.toFixed(0)} km/h</>}
              </p>
            )}
          </div>
          <ChatPanel shipmentId={s.id} />
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
