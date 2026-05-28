'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive, Download, FileText, X, Truck, Users,
  Calendar, Weight, ChevronRight, AlertCircle, Search,
} from 'lucide-react';
import { marketplaceApi, ArchiveLog } from '@/lib/api/marketplace.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  } catch { return '—'; }
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
  }).format(n);
}

function parseCity(address: string | undefined): string {
  if (!address) return '—';
  return address.split(',')[0]?.trim() ?? '—';
}

function driverName(log: ArchiveLog): string {
  const parts = [log.driver_first_name, log.driver_last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-500/15 text-red-400 ring-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status?.toLowerCase()] ?? {
    label: status ?? '—',
    cls: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Settlement badge ──────────────────────────────────────────────────────────

const SETTLEMENT_CFG: Record<string, string> = {
  pending:  'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  approved: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  paid:     'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
};

function SettlementBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-white/25 text-xs">—</span>;
  const cls = SETTLEMENT_CFG[status] ?? 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {[40, 30, 18, 22, 20, 18, 15].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-md bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ log, onClose }: { log: ArchiveLog | null; onClose: () => void }) {
  const open = log !== null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0f111a 0%, #0b0d14 100%)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {log && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-0.5">Archive Record</p>
                <h2 className="text-base font-semibold text-white">
                  {parseCity(log.pickup_address)} → {parseCity(log.delivery_address)}
                </h2>
                <p className="text-xs text-white/35 mt-0.5 font-mono">{log.shipment_id.slice(0, 8)}…</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Route map placeholder */}
              <div className="relative h-44 w-full rounded-xl overflow-hidden bg-[#0d1117] border border-white/10 flex items-center justify-center">
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 176" preserveAspectRatio="none">
                  <path d="M 80 140 C 140 70, 260 110, 320 40" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4" fill="none" opacity="0.7" />
                  <circle cx="80" cy="140" r="5" fill="#22c55e" />
                  <circle cx="320" cy="40" r="5" fill="#ef4444" />
                </svg>
                <div className="absolute bottom-3 left-4 text-[10px] text-emerald-400 font-mono truncate max-w-[45%]">{log.pickup_address}</div>
                <div className="absolute top-3 right-4 text-[10px] text-red-400 font-mono truncate max-w-[45%] text-right">{log.delivery_address}</div>
                <span className="text-xs text-white/25 font-medium">Final Route</span>
              </div>

              {/* Shipment details */}
              <Section label="Shipment">
                <DetailRow label="Status"><StatusBadge status={log.final_status} /></DetailRow>
                <DetailRow label="Archived">{fmt(log.archived_at)}</DetailRow>
                <DetailRow label="Cargo type">{log.cargo_type ?? '—'}</DetailRow>
                <DetailRow label="Weight">{log.cargo_weight_kg != null ? `${log.cargo_weight_kg.toLocaleString()} kg` : '—'}</DetailRow>
              </Section>

              {/* Crew */}
              <Section label="Crew">
                <DetailRow label="Driver">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-violet-400" />
                    {driverName(log)}
                  </span>
                </DetailRow>
                <DetailRow label="Vehicle">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3 h-3 text-indigo-400" />
                    {log.vehicle_license_plate ?? '—'}
                  </span>
                </DetailRow>
              </Section>

              {/* Financials */}
              <Section label="Settlement">
                <DetailRow label="Final rate">{fmtCurrency(log.final_rate_eur)}</DetailRow>
                <DetailRow label="Settlement">{fmtCurrency(log.settlement_amount)}</DetailRow>
                <DetailRow label="Status"><SettlementBadge status={log.settlement_status} /></DetailRow>
              </Section>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-5 border-t border-white/8 flex flex-col gap-2">
              {log.cmr_document_url ? (
                <a
                  href={log.cmr_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
                >
                  <Download className="w-4 h-4" />
                  Download CMR Document
                </a>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white/25 ring-1 ring-white/8">
                  <FileText className="w-4 h-4" />
                  No CMR document attached
                </div>
              )}
              <button className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white/60 ring-1 ring-white/8 hover:bg-white/5 transition-colors">
                <FileText className="w-4 h-4" />
                View Settlement Report
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-mono text-white/35 uppercase tracking-widest">{label}</p>
      <div className="rounded-xl bg-white/4 border border-white/8 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white font-medium text-right">{children}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const [search, setSearch]         = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [driverFilter, setDriver]   = useState('');
  const [vehicleFilter, setVehicle] = useState('');
  const [selected, setSelected]     = useState<ArchiveLog | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shipment-history'],
    queryFn:  () => marketplaceApi.getShipmentHistory(),
    staleTime: 60_000,
  });

  // ── Derived filter options ─────────────────────────────────────────────────

  const drivers = useMemo(() => {
    const names = (data ?? [])
      .map(l => driverName(l))
      .filter(n => n !== '—');
    return Array.from(new Set(names)).sort();
  }, [data]);

  const vehicles = useMemo(() => {
    const plates = (data ?? [])
      .map(l => l.vehicle_license_plate)
      .filter((p): p is string => p !== null);
    return Array.from(new Set(plates)).sort();
  }, [data]);

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(l =>
        l.pickup_address?.toLowerCase().includes(q) ||
        l.delivery_address?.toLowerCase().includes(q) ||
        l.cargo_type?.toLowerCase().includes(q),
      );
    }
    if (fromDate) list = list.filter(l => l.archived_at >= fromDate);
    if (toDate)   list = list.filter(l => l.archived_at <= toDate + 'T23:59:59');
    if (driverFilter)  list = list.filter(l => driverName(l) === driverFilter);
    if (vehicleFilter) list = list.filter(l => l.vehicle_license_plate === vehicleFilter);
    return list;
  }, [data, search, fromDate, toDate, driverFilter, vehicleFilter]);

  const hasFilters = search || fromDate || toDate || driverFilter || vehicleFilter;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-[#080a10] text-white">

      {/* Header */}
      <div
        className="px-6 pt-8 pb-6 border-b border-white/6"
        style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, transparent 100%)' }}
      >
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-1">VECTRA Workspace</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Archive className="w-6 h-6 text-white/50" />
              Logistics Archive
            </h1>
            <p className="text-sm text-white/40 mt-1">Complete history of delivered and completed shipments</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span className="tabular-nums font-mono">
              {isLoading ? '—' : filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col gap-4 py-5">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cities, cargo type…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors [color-scheme:dark]"
            />
            <span className="text-white/20 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Driver filter */}
          {drivers.length > 0 && (
            <select
              value={driverFilter}
              onChange={e => setDriver(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors appearance-none cursor-pointer pr-7"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff50' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="" style={{ background: '#0f111a' }}>All Drivers</option>
              {drivers.map(d => <option key={d} value={d} style={{ background: '#0f111a' }}>{d}</option>)}
            </select>
          )}

          {/* Vehicle filter */}
          {vehicles.length > 0 && (
            <select
              value={vehicleFilter}
              onChange={e => setVehicle(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors appearance-none cursor-pointer pr-7"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff50' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="" style={{ background: '#0f111a' }}>All Vehicles</option>
              {vehicles.map(v => <option key={v} value={v} style={{ background: '#0f111a' }}>{v}</option>)}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setDriver(''); setVehicle(''); }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr className="border-b border-white/8">
                {['Route', 'Driver', 'Vehicle', 'Archived', 'Rate', 'Settlement', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-mono font-semibold text-white/30 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <p className="text-sm text-white/50">Failed to load archive</p>
                      <p className="text-xs text-white/25">{(error as Error)?.message}</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                        <Archive className="w-6 h-6 text-white/15" />
                      </div>
                      <p className="text-sm text-white/35">No archived shipments</p>
                      <p className="text-xs text-white/20">Completed deliveries will appear here</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filtered.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="border-b border-white/5 hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      {parseCity(log.pickup_address)}
                      <span className="text-white/25 mx-0.5">→</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      {parseCity(log.delivery_address)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/30 capitalize">{log.cargo_type ?? ''}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-white/60">
                      <Users className="w-3 h-3 text-violet-400 flex-shrink-0" />
                      {driverName(log)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm font-mono text-white/60">
                      <Truck className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      {log.vehicle_license_plate ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-white/35 font-mono whitespace-nowrap">
                    {fmt(log.archived_at)}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-mono text-white/80">
                    {fmtCurrency(log.final_rate_eur)}
                  </td>
                  <td className="px-4 py-3.5">
                    <SettlementBadge status={log.settlement_status} />
                  </td>
                  <td className="px-4 py-3.5 text-white/20 group-hover:text-white/50 transition-colors text-right">
                    <div className="flex items-center justify-end gap-2">
                      {log.cmr_document_url && (
                        <a
                          href={log.cmr_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Download className="w-3 h-3" />
                          CMR
                        </a>
                      )}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center justify-between text-xs text-white/25 py-1">
            <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''} shown</span>
            <span>Click any row for full detail</span>
          </div>
        )}
      </div>

      <DetailDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
