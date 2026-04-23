'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Clock, Package, Truck, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { driverApi, DriverShipmentStatus } from '@/lib/api/driver.api';
import { CameraCapture } from '@/components/driver/CameraCapture';

// ── Status machine ──────────────────────────────────────────────────────────

type Step = {
  status: DriverShipmentStatus;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  activeBg: string;
};

const STEPS: Step[] = [
  {
    status: 'arrived_at_pickup',
    label: 'Confirm Arrival',
    sublabel: 'at Pickup',
    color: 'text-amber-300',
    bg: 'bg-amber-900/30',
    activeBg: 'bg-amber-500',
  },
  {
    status: 'loaded_en_route',
    label: 'Cargo Loaded',
    sublabel: '& En Route',
    color: 'text-blue-300',
    bg: 'bg-blue-900/30',
    activeBg: 'bg-blue-500',
  },
  {
    status: 'arrived_at_delivery',
    label: 'Confirm Arrival',
    sublabel: 'at Delivery',
    color: 'text-violet-300',
    bg: 'bg-violet-900/30',
    activeBg: 'bg-violet-500',
  },
  {
    status: 'completed',
    label: 'Upload POD',
    sublabel: '& Complete',
    color: 'text-primary-300',
    bg: 'bg-primary-900/30',
    activeBg: 'bg-primary-500',
  },
];

function statusToStepIndex(status: string): number {
  switch (status) {
    case 'assigned':            return 0;
    case 'arrived_at_pickup':   return 1;
    case 'loaded_en_route':     return 2;
    case 'arrived_at_delivery': return 3;
    case 'completed':           return 4;
    default:                    return 0;
  }
}

// ── Long-press button ───────────────────────────────────────────────────────

function LongPressButton({
  label,
  sublabel,
  activeBg,
  onCommit,
  disabled,
}: {
  label: string;
  sublabel: string;
  activeBg: string;
  onCommit: () => void;
  disabled: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION_MS = 1200;
  const TICK_MS = 30;

  const start = useCallback(() => {
    if (disabled) return;
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += TICK_MS;
      const pct = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        setProgress(0);
        onCommit();
      }
    }, TICK_MS);
  }, [disabled, onCommit]);

  const cancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
  }, []);

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      disabled={disabled}
      aria-label={`Hold to ${label} ${sublabel}`}
      className="
        relative w-full rounded-2xl overflow-hidden
        h-24 select-none touch-none
        border-2 border-slate-600
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-150 active:scale-[0.98]
        bg-slate-800
      "
    >
      {/* fill bar */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 ${activeBg} transition-none opacity-80`}
        style={{ width: `${progress}%` }}
      />
      <span className="relative z-10 flex flex-col items-center justify-center gap-0.5">
        <span className="text-2xl font-black tracking-tight">{label}</span>
        <span className="text-sm font-semibold text-white/70">{sublabel}</span>
        {progress === 0 && (
          <span className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Hold to confirm
          </span>
        )}
      </span>
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function mapsUrl(lat: number, lng: number, address: string) {
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place=${lat},${lng}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActiveLoadPage() {
  const qc = useQueryClient();

  const { data: load, isLoading, isError, refetch } = useQuery({
    queryKey: ['driver', 'active-load'],
    queryFn: () => driverApi.getMyActiveLoad(),
    refetchInterval: 30_000,
  });

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ status }: { status: DriverShipmentStatus }) =>
      driverApi.updateStatus(load!.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver', 'active-load'] }),
  });

  const { mutate: submitPod, isPending: isSubmittingPod } = useMutation({
    mutationFn: (formData: FormData) => driverApi.submitPod(load!.id, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver', 'active-load'] }),
  });

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <Truck size={48} className="text-primary-400 animate-pulse" />
        <p className="text-slate-400 text-lg">Loading your assignment…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-slate-300 text-lg text-center">
          Could not reach the server. Check your connection.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold active:bg-slate-600"
        >
          <RefreshCw size={18} /> Retry
        </button>
      </div>
    );
  }

  if (!load) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 size={56} className="text-primary-400" />
        <h2 className="text-2xl font-bold">No Active Load</h2>
        <p className="text-slate-400">You have no assigned shipment right now. Check back soon.</p>
      </div>
    );
  }

  const stepIdx = statusToStepIndex(load.status);
  const isComplete = load.status === 'completed';
  const nextStep = STEPS[stepIdx];
  const showPod = load.status === 'arrived_at_delivery';

  return (
    <div className="flex flex-col gap-0 min-h-full">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-0.5">Shipment</p>
          <h1 className="text-xl font-black tracking-tight font-mono">
            #{load.id.slice(0, 8).toUpperCase()}
          </h1>
        </div>
        <span className={`
          px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest
          ${isComplete
            ? 'bg-primary-900/60 text-primary-300'
            : 'bg-amber-900/60 text-amber-300'}
        `}>
          {load.status.replace(/_/g, ' ')}
        </span>
      </header>

      {/* ── Progress stepper ────────────────────────────────────────────── */}
      <div className="flex items-center px-5 mb-4 gap-1.5">
        {STEPS.map((step, i) => {
          const done = i < stepIdx;
          const current = i === stepIdx && !isComplete;
          return (
            <div key={step.status} className="flex-1 flex flex-col items-center gap-1">
              <div className={`
                h-1.5 w-full rounded-full transition-all duration-500
                ${done || isComplete ? 'bg-primary-500' : current ? 'bg-amber-400' : 'bg-slate-700'}
              `} />
            </div>
          );
        })}
      </div>

      {/* ── Cargo summary strip ─────────────────────────────────────────── */}
      <div className="mx-4 mb-4 rounded-2xl bg-slate-800 border border-slate-700 p-4 flex gap-4">
        <Package size={28} className="text-primary-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{load.cargo_type}</p>
          <p className="text-slate-400 text-sm">
            {load.cargo_weight_kg} kg &bull; {load.pallet_count} pallets &bull; {load.cargo_volume_m3} m³
          </p>
        </div>
      </div>

      {/* ── Pickup card ─────────────────────────────────────────────────── */}
      <section className="mx-4 mb-3 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Pickup</span>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <MapPin size={20} className="text-amber-400 mt-0.5 shrink-0" />
            <a
              href={mapsUrl(load.pickup_lat, load.pickup_lng, load.pickup_address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-bold leading-snug text-white underline underline-offset-2 decoration-amber-500/50 active:text-amber-200"
            >
              {load.pickup_address}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-slate-400 shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">{fmtDate(load.pickup_window_start)}</span>
              {' · '}
              {fmtTime(load.pickup_window_start)} – {fmtTime(load.pickup_window_end)}
            </div>
          </div>
        </div>
      </section>

      {/* ── Delivery card ───────────────────────────────────────────────── */}
      <section className="mx-4 mb-5 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="w-3 h-3 rounded-full bg-primary-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary-300">Delivery</span>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <MapPin size={20} className="text-primary-400 mt-0.5 shrink-0" />
            <a
              href={mapsUrl(load.delivery_lat, load.delivery_lng, load.delivery_address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-bold leading-snug text-white underline underline-offset-2 decoration-primary-500/50 active:text-primary-200"
            >
              {load.delivery_address}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-slate-400 shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">By</span>{' '}
              {fmtDate(load.delivery_deadline)} · {fmtTime(load.delivery_deadline)}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA / POD section ───────────────────────────────────────────── */}
      <div className="mx-4 mt-auto mb-2">
        {isComplete ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={56} className="text-primary-400" />
            <p className="text-xl font-black text-primary-300">Delivery Complete</p>
            <p className="text-slate-400 text-sm text-center">
              Great work! Your dispatcher has been notified.
            </p>
          </div>
        ) : showPod ? (
          <CameraCapture
            shipmentId={load.id}
            onSubmit={(fd) => submitPod(fd)}
            isSubmitting={isSubmittingPod}
          />
        ) : nextStep ? (
          <LongPressButton
            label={nextStep.label}
            sublabel={nextStep.sublabel}
            activeBg={nextStep.activeBg}
            disabled={isUpdating}
            onCommit={() => updateStatus({ status: nextStep.status })}
          />
        ) : null}
      </div>

    </div>
  );
}
