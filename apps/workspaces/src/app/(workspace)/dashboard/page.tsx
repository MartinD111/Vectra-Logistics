'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Package, Truck, Clock, TrendingUp, ArrowRight, Loader2, Inbox,
} from 'lucide-react';
import { marketplaceApi, Shipment } from '@vectra/data';
import { fleetApi } from '@vectra/data';
import { crossAppUrl } from '@vectra/ui';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return '—'; }
}

function parseCity(address: string | undefined): string {
  if (!address) return '—';
  return address.split(',')[0]?.trim() ?? '—';
}

const STATUS_CFG: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  booked:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_transit: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  completed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CFG[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {status?.replace('_', ' ') ?? '—'}
    </span>
  );
}

// ── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="saas-card !p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <span className={`inline-flex items-center justify-center h-9 w-9 rounded-xl ${accent}`}>
          {icon}
        </span>
      </div>
      <p className="text-3xl font-black text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => marketplaceApi.getShipments(),
    staleTime: 30_000,
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => fleetApi.getVehicles(),
    staleTime: 60_000,
  });

  const isLoading = shipmentsLoading || vehiclesLoading;

  const kpis = useMemo(() => {
    const s = shipments ?? [];
    const v = vehicles ?? [];
    const activeShipments = s.filter((x) => x.status === 'booked' || x.status === 'in_transit').length;
    const pendingActions = s.filter((x) => x.status === 'pending').length;
    const utilisation = v.length > 0
      ? Math.round(Math.min((activeShipments / v.length) * 100, 100)) : 0;
    const revenueEstimate = s
      .filter((x) => x.status === 'completed' || x.status === 'booked')
      .reduce((acc, x) => acc + (x.cargo_weight_kg ?? 0) * 0.05, 0);
    return { activeShipments, pendingActions, utilisation, revenueEstimate };
  }, [shipments, vehicles]);

  const recent: Shipment[] = useMemo(
    () => [...(shipments ?? [])].slice(0, 6),
    [shipments],
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Live overview of your operations.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs font-medium text-gray-600 dark:text-gray-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            System Online
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="saas-card !p-5 h-[110px] animate-pulse" />
            ))
          ) : (
            <>
              <KpiCard
                label="Active Shipments" value={kpis.activeShipments}
                sub="Booked or in transit"
                icon={<Package className="w-4 h-4 text-white" />} accent="bg-primary-500"
              />
              <KpiCard
                label="Fleet Utilisation" value={`${kpis.utilisation}%`}
                sub={`${vehicles?.length ?? 0} vehicles registered`}
                icon={<Truck className="w-4 h-4 text-white" />} accent="bg-violet-500"
              />
              <KpiCard
                label="Pending Actions" value={kpis.pendingActions}
                sub="Shipments awaiting a match"
                icon={<Clock className="w-4 h-4 text-white" />} accent="bg-amber-500"
              />
              <KpiCard
                label="Est. Revenue" value={formatCurrency(kpis.revenueEstimate)}
                sub="Booked + completed (estimate)"
                icon={<TrendingUp className="w-4 h-4 text-white" />} accent="bg-emerald-500"
              />
            </>
          )}
        </div>

        {/* Recent shipments */}
        <div className="saas-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Shipments</h2>
            <a
              href={crossAppUrl('marketplace', '/board')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all"
            >
              View board <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-gray-400 py-12">
              <Inbox className="w-8 h-8" />
              <p className="text-sm">No shipments yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-dark-border">
                    <th className="py-2.5 pr-4 font-semibold">Route</th>
                    <th className="py-2.5 pr-4 font-semibold">Cargo</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
                    <th className="py-2.5 pr-4 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                        {parseCity(s.pickup_address)} → {parseCity(s.delivery_address)}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                        {s.cargo_type ?? '—'}
                        {s.cargo_weight_kg ? ` · ${s.cargo_weight_kg.toLocaleString()} kg` : ''}
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(s.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
