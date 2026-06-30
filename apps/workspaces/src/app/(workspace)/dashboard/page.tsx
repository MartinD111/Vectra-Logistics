'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Package, Truck, Clock, TrendingUp,
  ArrowRight, FileText, Zap, AlertCircle,
  CheckCircle2, Circle, BarChart3,
} from 'lucide-react';
import { marketplaceApi, Shipment } from '@/lib/api/marketplace.api';
import { fleetApi, Vehicle } from '@/lib/api/fleet.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch { return '—'; }
}

function parseCity(address: string | undefined): string {
  if (!address) return '—';
  const parts = address.split(',').map(p => p.trim());
  return parts[0] ?? '—';
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:   { label: 'Pending',   dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30' },
  booked:    { label: 'Booked',    dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-400 ring-blue-500/30' },
  in_transit:{ label: 'In Transit',dot: 'bg-indigo-400', badge: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/30' },
  completed: { label: 'Completed', dot: 'bg-emerald-400',badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-400',    badge: 'bg-red-500/15 text-red-400 ring-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status?.toLowerCase()] ?? { label: status, badge: 'bg-slate-500/15 text-slate-400 ring-slate-500/30' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

// ── Skeleton primitives ───────────────────────────────────────────────────────

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-md bg-white/5 animate-pulse ${className ?? ''}`} style={style} />;
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl bg-white/4 border border-white/8 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-8 rounded-lg" />
      </div>
      <SkeletonBlock className="h-8 w-20" />
      <SkeletonBlock className="h-3 w-32" />
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  accent?: string;
  trend?: { value: string; up: boolean };
}

function KpiCard({ label, value, sub, icon, iconBg, accent, trend }: KpiCardProps) {
  return (
    <div className={`relative rounded-xl bg-white/4 border border-white/8 p-5 flex flex-col gap-2 overflow-hidden transition-all hover:border-white/15 hover:bg-white/[0.06]${accent ? ` before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:${accent}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono font-semibold text-white/40 uppercase tracking-widest">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white tabular-nums leading-none">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/35">{sub}</p>
        {trend && (
          <span className={`text-[11px] font-semibold ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shipment volume chart ─────────────────────────────────────────────────────

function ShipmentVolumeChart({ shipments }: { shipments: Shipment[] }) {
  // Group by day of week from created_at, last 7 days
  const days = useMemo(() => {
    const now = Date.now();
    const buckets: { label: string; count: number }[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86_400_000);
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        count: 0,
      };
    });
    shipments.forEach(s => {
      if (!s.created_at) return;
      const age = Math.floor((now - new Date(s.created_at).getTime()) / 86_400_000);
      if (age >= 0 && age < 7) buckets[6 - age].count += 1;
    });
    return buckets;
  }, [shipments]);

  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-end gap-2 flex-1 min-h-0 pb-1">
        {days.map((day, i) => {
          const pct = Math.max((day.count / max) * 100, day.count > 0 ? 8 : 2);
          const isToday = i === 6;
          return (
            <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 group">
              <span className="text-[10px] text-white/30 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                {day.count}
              </span>
              <div className="w-full flex items-end" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t-sm transition-all duration-500 ${isToday ? 'bg-indigo-500' : 'bg-white/10 group-hover:bg-white/20'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2 border-t border-white/5">
        {days.map((day, i) => (
          <div key={day.label} className="flex-1 text-center">
            <span className={`text-[10px] font-mono ${i === 6 ? 'text-indigo-400 font-semibold' : 'text-white/30'}`}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex items-end gap-2 h-full pb-6">
      {[40, 65, 30, 80, 55, 70, 90].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm bg-white/5 animate-pulse" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ── Fleet utilization ring ────────────────────────────────────────────────────

function UtilizationRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={r}
          stroke="#6366f1"
          strokeWidth="8"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-white tabular-nums">{pct}%</span>
    </div>
  );
}

// ── Recent shipments table ────────────────────────────────────────────────────

function RecentShipmentsTable({ shipments, isLoading }: { shipments: Shipment[] | undefined; isLoading: boolean }) {
  const recent = useMemo(() => [...(shipments ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  ).slice(0, 5), [shipments]);

  return (
    <table className="w-full min-w-[560px] border-collapse">
      <thead>
        <tr className="border-b border-white/8">
          {['Route', 'Cargo', 'Status', 'Posted', ''].map(h => (
            <th key={h} className="px-4 py-3 text-left text-[11px] font-mono font-semibold text-white/30 uppercase tracking-widest whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <tr key={i} className="border-b border-white/5">
            {[45, 30, 18, 25, 12].map((w, j) => (
              <td key={j} className="px-4 py-3.5">
                <SkeletonBlock className={`h-4`} style={{ width: `${w + (i * 7) % 20}%` } as React.CSSProperties} />
              </td>
            ))}
          </tr>
        ))}
        {!isLoading && recent.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-sm text-white/25">No shipments recorded yet</td>
          </tr>
        )}
        {!isLoading && recent.map(s => (
          <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.025] transition-colors group">
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-sm text-white font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {parseCity(s.pickup_address)}
                <span className="text-white/25 mx-0.5">→</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {parseCity(s.delivery_address)}
              </div>
            </td>
            <td className="px-4 py-3.5 text-sm text-white/50 capitalize">
              {s.cargo_type ?? '—'}
            </td>
            <td className="px-4 py-3.5">
              <StatusBadge status={s.status ?? 'pending'} />
            </td>
            <td className="px-4 py-3.5 text-xs text-white/30 font-mono whitespace-nowrap">
              {formatDate(s.created_at)}
            </td>
            <td className="px-4 py-3.5 text-right">
              <Link
                href="/board"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Mini AI parser dropzone ───────────────────────────────────────────────────

function MiniParserCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">AI Rate Parser</p>
          <p className="text-[11px] text-white/35">Extract data from PDFs instantly</p>
        </div>
      </div>

      <Link
        href="/automations/rate-parser"
        className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group cursor-pointer p-6 text-center min-h-[140px]"
      >
        <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-indigo-500/10 flex items-center justify-center transition-colors">
          <FileText className="w-5 h-5 text-white/30 group-hover:text-indigo-400 transition-colors" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/50 group-hover:text-white/80 transition-colors">Drop PDF or click to parse</p>
          <p className="text-[11px] text-white/25 mt-0.5">Rate confirmations, CMR, BOL</p>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open Parser <ArrowRight className="w-3 h-3" />
        </span>
      </Link>

      <div className="mt-4 space-y-2">
        {(['Pickup address', 'Delivery address', 'Rate & currency', 'Cargo weight'] as const).map(field => (
          <div key={field} className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" />
            <span className="text-[11px] text-white/30">{field} extracted automatically</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    data: shipments,
    isLoading: shipmentsLoading,
    isError: shipmentsError,
  } = useQuery({
    queryKey: ['shipments'],
    queryFn:  () => marketplaceApi.getShipments(),
    staleTime: 30_000,
  });

  const {
    data: vehicles,
    isLoading: vehiclesLoading,
  } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  () => fleetApi.getVehicles(),
    staleTime: 60_000,
  });

  const isLoading = shipmentsLoading || vehiclesLoading;

  // ── KPI calculations ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const s = shipments ?? [];
    const v = vehicles ?? [];

    const activeShipments = s.filter(x =>
      x.status === 'booked' || x.status === 'in_transit'
    ).length;

    const pendingActions = s.filter(x => x.status === 'pending').length;

    // Fleet utilisation: vehicles that have a matching booked/in_transit shipment
    // The backend Shipment type doesn't expose vehicle_id on this endpoint,
    // so we use a proxy: ratio of booked+in_transit to total vehicles.
    const totalVehicles = v.length;
    const utilisation = totalVehicles > 0
      ? Math.round(Math.min((activeShipments / totalVehicles) * 100, 100))
      : 0;

    // Revenue: sum cargo_weight_kg * 0.05 EUR/kg as a proxy for completed/booked
    // (no rate_amount field on Shipment — use weight-based estimate)
    const revenueEstimate = s
      .filter(x => x.status === 'completed' || x.status === 'booked')
      .reduce((acc, x) => acc + (x.cargo_weight_kg ?? 0) * 0.05, 0);

    return { activeShipments, pendingActions, utilisation, revenueEstimate };
  }, [shipments, vehicles]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-[#080a10] text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="px-6 pt-8 pb-6 border-b border-white/6"
        style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.07) 0%, transparent 100%)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-1">VECTRA Platform</p>
            <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
            <p className="text-sm text-white/40 mt-1">Live overview across all domains</p>
          </div>
          {/* System status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/4 border border-white/8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-white/60 font-medium">System Online</span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-white/30 font-mono">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
              <p className="text-[11px] text-white/20 font-mono">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-6 flex-1">

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                label="Active Shipments"
                value={kpis.activeShipments}
                sub="Booked or in transit"
                icon={<Package className="w-4 h-4 text-indigo-400" />}
                iconBg="bg-indigo-500/15"
                accent="bg-indigo-500"
              />
              <KpiCard
                label="Fleet Utilisation"
                value={`${kpis.utilisation}%`}
                sub={`${vehicles?.length ?? 0} vehicles registered`}
                icon={<Truck className="w-4 h-4 text-violet-400" />}
                iconBg="bg-violet-500/15"
                accent="bg-violet-500"
              />
              <KpiCard
                label="Pending Actions"
                value={kpis.pendingActions}
                sub="New loads on marketplace"
                icon={<Clock className="w-4 h-4 text-amber-400" />}
                iconBg="bg-amber-500/15"
                accent="bg-amber-500"
              />
              <KpiCard
                label="Revenue Est."
                value={formatCurrency(kpis.revenueEstimate)}
                sub="Completed & booked loads"
                icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
                iconBg="bg-emerald-500/15"
                accent="bg-emerald-500"
              />
            </>
          )}
        </div>

        {/* ── Middle row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Chart — 2/3 */}
          <div className="lg:col-span-2 rounded-xl bg-white/4 border border-white/8 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white/40" />
                <p className="text-sm font-semibold text-white">Shipment Volume</p>
              </div>
              <span className="text-[11px] text-white/30 font-mono">Last 7 days</span>
            </div>

            {/* Fleet utilisation sub-row */}
            <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/4 border border-white/6">
              <UtilizationRing pct={isLoading ? 0 : kpis.utilisation} />
              <div className="flex-1 space-y-2">
                <p className="text-xs font-semibold text-white/70">Fleet Utilisation</p>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: isLoading ? '0%' : `${kpis.utilisation}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-white/30 font-mono">
                  <span>{kpis.utilisation}% active</span>
                  <span>{(vehicles?.length ?? 0) - Math.round((kpis.utilisation / 100) * (vehicles?.length ?? 0))} idle</span>
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex-1 min-h-[120px]">
              {isLoading
                ? <ChartSkeleton />
                : <ShipmentVolumeChart shipments={shipments ?? []} />
              }
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 pt-1 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span className="text-[11px] text-white/35">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-white/10" />
                <span className="text-[11px] text-white/35">Previous days</span>
              </div>
              <span className="ml-auto text-[11px] text-white/25 font-mono">
                Total: {(shipments ?? []).length} shipments
              </span>
            </div>
          </div>

          {/* AI parser card — 1/3 */}
          <div className="rounded-xl bg-white/4 border border-white/8 p-5">
            <MiniParserCard />
          </div>
        </div>

        {/* ── Recent shipments ─────────────────────────────────────────────── */}
        <div className="rounded-xl bg-white/4 border border-white/8 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Circle className="w-3.5 h-3.5 text-white/30" />
              <p className="text-sm font-semibold text-white">Recent Logistics Events</p>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-mono">
                {isLoading ? '—' : Math.min((shipments ?? []).length, 5)}
              </span>
            </div>
            <Link
              href="/board"
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {shipmentsError ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-red-400/70">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Failed to load shipments
            </div>
          ) : (
            <div className="overflow-x-auto">
              <RecentShipmentsTable shipments={shipments} isLoading={shipmentsLoading} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
