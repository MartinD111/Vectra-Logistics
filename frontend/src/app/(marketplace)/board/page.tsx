'use client';

import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, Shipment } from '@/lib/api/marketplace.api';
import { useAssignmentNotifier } from '@/app/hooks/useAssignmentNotifier';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCity(address: string): { city: string; country: string } {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 3) return { city: parts[parts.length - 3] ?? parts[0], country: parts[parts.length - 1] };
  if (parts.length === 2) return { city: parts[0], country: parts[1] };
  return { city: parts[0] ?? 'TBD', country: '—' };
}

function formatDate(iso: string | undefined): string {
  if (!iso) return 'TBD';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return 'TBD';
  }
}

function formatWeight(kg: number | undefined): string {
  if (kg == null) return 'TBD';
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg} kg`;
}

// ── Cargo type badge config ───────────────────────────────────────────────────

const CARGO_BADGE: Record<string, { label: string; classes: string }> = {
  pallets:      { label: 'Pallets',      classes: 'bg-blue-500/15 text-blue-400 ring-blue-500/30' },
  refrigerated: { label: 'Refrigerated', classes: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30' },
  vehicles:     { label: 'Vehicles',     classes: 'bg-violet-500/15 text-violet-400 ring-violet-500/30' },
  livestock:    { label: 'Livestock',    classes: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
  general:      { label: 'General',      classes: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
};

function CargoBadge({ type }: { type: string }) {
  const key = type?.toLowerCase() ?? '';
  const cfg = CARGO_BADGE[key] ?? { label: type ?? 'Cargo', classes: 'bg-slate-500/15 text-slate-400 ring-slate-500/30' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
    assigned:  'bg-blue-500/15 text-blue-400 ring-blue-500/30',
    completed: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    cancelled: 'bg-red-500/15 text-red-400 ring-red-500/30',
  };
  const cls = map[status?.toLowerCase()] ?? 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize ${cls}`}>
      {status ?? 'unknown'}
    </span>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-md bg-white/5 animate-pulse" style={{ width: `${60 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Map placeholder ───────────────────────────────────────────────────────────

function MapPlaceholder({ pickup, delivery }: { pickup: string; delivery: string }) {
  return (
    <div className="relative h-52 w-full rounded-xl overflow-hidden bg-[#0d1117] border border-white/10 flex items-center justify-center">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Route line */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 208" preserveAspectRatio="none">
        <path d="M 80 160 C 140 80, 260 130, 320 50" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4" fill="none" opacity="0.7" />
        <circle cx="80" cy="160" r="5" fill="#22c55e" />
        <circle cx="320" cy="50" r="5" fill="#ef4444" />
      </svg>
      {/* Labels */}
      <div className="absolute bottom-3 left-4 text-[10px] text-emerald-400 font-mono truncate max-w-[45%]">{pickup || 'Pickup'}</div>
      <div className="absolute top-3 right-4 text-[10px] text-red-400 font-mono truncate max-w-[45%] text-right">{delivery || 'Delivery'}</div>
      <span className="text-xs text-white/30 font-medium">Route Preview</span>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

interface DrawerProps {
  shipment: Shipment | null;
  onClose: () => void;
  onBook: (shipment: Shipment) => void;
  booked: Set<string>;
  isBooking: boolean;
  bookError: string | null;
}

function DetailDrawer({ shipment, onClose, onBook, booked, isBooking, bookError }: DrawerProps) {
  const isOpen = shipment !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0f111a 0%, #0b0d14 100%)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {shipment && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-0.5">Shipment Detail</p>
                <h2 className="text-base font-semibold text-white truncate">
                  {parseCity(shipment.pickup_address).city} → {parseCity(shipment.delivery_address).city}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Map */}
              <MapPlaceholder pickup={shipment.pickup_address} delivery={shipment.delivery_address} />

              {/* Route */}
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">Route</p>
                <div className="grid grid-cols-1 gap-2">
                  <RouteStop
                    label="Pickup"
                    address={shipment.pickup_address ?? 'TBD'}
                    date={formatDate(shipment.pickup_window_start)}
                    dateEnd={formatDate(shipment.pickup_window_end)}
                    color="emerald"
                  />
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-[2px] h-6 bg-indigo-500/40 ml-2" />
                    <span className="text-[10px] text-white/30 font-mono">IN TRANSIT</span>
                  </div>
                  <RouteStop
                    label="Delivery"
                    address={shipment.delivery_address ?? 'TBD'}
                    date={formatDate(shipment.delivery_deadline)}
                    color="red"
                  />
                </div>
              </div>

              {/* Cargo specs */}
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">Cargo Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  <SpecCard label="Weight" value={formatWeight(shipment.cargo_weight_kg)} />
                  <SpecCard label="Volume" value={shipment.cargo_volume_m3 != null ? `${shipment.cargo_volume_m3} m³` : 'TBD'} />
                  <SpecCard label="Pallets" value={shipment.pallet_count != null ? `${shipment.pallet_count} EUR` : 'TBD'} />
                  <SpecCard label="Type" value={<CargoBadge type={shipment.cargo_type ?? 'general'} />} />
                </div>
              </div>

              {/* Status & meta */}
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">Status</p>
                <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Current status</span>
                  <StatusBadge status={shipment.status ?? 'pending'} />
                </div>
              </div>

              {/* Posted */}
              <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3 space-y-1">
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest">Posted</p>
                <p className="text-sm text-white/70">{formatDate(shipment.created_at)}</p>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="px-6 py-5 border-t border-white/8">
              {booked.has(shipment.id) ? (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 bg-emerald-500/20 text-emerald-400 text-sm font-semibold ring-1 ring-emerald-500/40">
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Load Booked
                </div>
              ) : (
                <button
                  onClick={() => onBook(shipment)}
                  disabled={shipment.status !== 'pending' || isBooking}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    boxShadow: '0 0 24px rgba(99,102,241,0.35)',
                  }}
                >
                  {isBooking ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                        <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Booking…
                    </>
                  ) : shipment.status === 'pending' ? (
                    'Book Load / Submit Bid'
                  ) : (
                    'Not Available'
                  )}
                </button>
              )}
              {bookError && (
                <p className="text-center text-[11px] text-red-400 mt-2">{bookError}</p>
              )}
              {!bookError && (
                <p className="text-center text-[11px] text-white/25 mt-2">
                  {shipment.status === 'pending' ? 'Booking confirms immediately • Cancellation window: 2 h' : 'This shipment is no longer accepting bids'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function RouteStop({
  label,
  address,
  date,
  dateEnd,
  color,
}: {
  label: string;
  address: string;
  date: string;
  dateEnd?: string;
  color: 'emerald' | 'red';
}) {
  const dot = color === 'emerald' ? 'bg-emerald-400' : 'bg-red-400';
  const text = color === 'emerald' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="flex gap-3 rounded-xl bg-white/4 border border-white/8 px-4 py-3">
      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div className="min-w-0">
        <p className={`text-[11px] font-mono uppercase tracking-wide ${text}`}>{label}</p>
        <p className="text-sm text-white font-medium truncate">{address}</p>
        <p className="text-xs text-white/40 mt-0.5">
          {date}
          {dateEnd && dateEnd !== date && ` – ${dateEnd}`}
        </p>
      </div>
    </div>
  );
}

function SpecCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
      <p className="text-[11px] text-white/40 mb-1">{label}</p>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

interface RowProps {
  shipment: Shipment;
  isSelected: boolean;
  onClick: () => void;
}

function ShipmentRow({ shipment, isSelected, onClick }: RowProps) {
  const pickup   = parseCity(shipment.pickup_address ?? '');
  const delivery = parseCity(shipment.delivery_address ?? '');

  return (
    <tr
      onClick={onClick}
      className={`border-b border-white/5 cursor-pointer transition-colors duration-100 group ${
        isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Pickup */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{pickup.city}</p>
            <p className="text-xs text-white/40">{pickup.country}</p>
          </div>
        </div>
      </td>

      {/* Delivery */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{delivery.city}</p>
            <p className="text-xs text-white/40">{delivery.country}</p>
          </div>
        </div>
      </td>

      {/* Pickup date */}
      <td className="px-4 py-3.5 text-sm text-white/70 whitespace-nowrap">
        {formatDate(shipment.pickup_window_start)}
      </td>

      {/* Cargo */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <CargoBadge type={shipment.cargo_type ?? 'general'} />
          <p className="text-xs text-white/40">{formatWeight(shipment.cargo_weight_kg)}</p>
        </div>
      </td>

      {/* Pallets */}
      <td className="px-4 py-3.5 text-sm text-white/70">
        {shipment.pallet_count != null ? `${shipment.pallet_count} EUR` : '—'}
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge status={shipment.status ?? 'pending'} />
      </td>

      {/* Arrow */}
      <td className="px-4 py-3.5 text-white/20 group-hover:text-white/50 transition-colors text-right">
        <svg className="w-4 h-4 inline-block" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'available' | 'bids' | 'completed';

const CARGO_TYPES = ['All Types', 'Pallets', 'Refrigerated', 'Vehicles', 'Livestock', 'General'];

export default function FreightBoardPage() {
  const [activeTab, setActiveTab]       = useState<Tab>('available');
  const [search, setSearch]             = useState('');
  const [cargoFilter, setCargoFilter]   = useState('All Types');
  const [dateFilter, setDateFilter]     = useState('');
  const [selected, setSelected]         = useState<Shipment | null>(null);
  const [booked, setBooked]             = useState<Set<string>>(new Set());
  const [bookError, setBookError]       = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { notify }  = useAssignmentNotifier();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shipments'],
    queryFn:  () => marketplaceApi.getShipments(),
    staleTime: 30_000,
  });

  const bookMutation = useMutation({
    mutationFn: (shipmentId: string) => marketplaceApi.bookShipment(shipmentId),
    onMutate: () => { setBookError(null); },
    onSuccess: (data, shipmentId) => {
      setBooked((prev) => { const next = new Set(prev); next.add(shipmentId); return next; });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      if (data.communications) notify(data.communications);
    },
    onError: (err: Error) => {
      setBookError(err.message ?? 'Booking failed — please try again');
    },
  });

  // ── Filter logic ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!data) return [];

    let list = data;

    // Tab filter
    if (activeTab === 'available') list = list.filter((s) => s.status === 'pending');
    else if (activeTab === 'completed') list = list.filter((s) => s.status === 'completed');
    else if (activeTab === 'bids') list = list.filter((s) => booked.has(s.id));

    // Cargo type
    if (cargoFilter !== 'All Types') {
      list = list.filter((s) => s.cargo_type?.toLowerCase() === cargoFilter.toLowerCase());
    }

    // Date filter (pickup_window_start starts with the YYYY-MM-DD prefix)
    if (dateFilter) {
      list = list.filter((s) => s.pickup_window_start?.startsWith(dateFilter));
    }

    // Search — matches city name in either address
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.pickup_address?.toLowerCase().includes(q) ||
          s.delivery_address?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [data, activeTab, cargoFilter, dateFilter, search, booked]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleBook(shipment: Shipment) {
    bookMutation.mutate(shipment.id);
  }

  // ── Tab config ────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'available', label: 'All Available Loads' },
    { key: 'bids',      label: 'My Active Bids'      },
    { key: 'completed', label: 'Completed'            },
  ];

  return (
    <div className="flex flex-col min-h-full bg-[#080a10] text-white">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6 border-b border-white/6"
           style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, transparent 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-1">VECTRA Marketplace</p>
              <h1 className="text-2xl font-bold text-white">Freight Board</h1>
              <p className="text-sm text-white/40 mt-1">Browse and book available freight loads</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/50">
                {isLoading ? 'Loading…' : `${filtered.length} loads visible`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col">

        {/* ── Control bar ───────────────────────────────────────────────────── */}
        <div className="py-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities, ZIP codes…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
            />
          </div>

          {/* Cargo type */}
          <select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors appearance-none cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff50' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '28px' }}
          >
            {CARGO_TYPES.map((t) => <option key={t} value={t} style={{ background: '#0f111a' }}>{t}</option>)}
          </select>

          {/* Date */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors [color-scheme:dark]"
          />

          {(search || cargoFilter !== 'All Types' || dateFilter) && (
            <button
              onClick={() => { setSearch(''); setCargoFilter('All Types'); setDateFilter(''); }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-white/6 mb-0 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-white/8">
                {['Pickup', 'Delivery', 'Date', 'Cargo', 'Pallets', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-mono font-semibold text-white/35 uppercase tracking-widest whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Loading skeleton */}
              {isLoading && [...Array(6)].map((_, i) => <SkeletonRow key={i} />)}

              {/* Error state */}
              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-sm text-white/50">Failed to load shipments</p>
                      <p className="text-xs text-white/25">{(error as Error)?.message ?? 'Unknown error'}</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/20" viewBox="0 0 24 24" fill="none">
                          <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-white/40">No loads found</p>
                      <p className="text-xs text-white/20">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoading && filtered.map((shipment) => (
                <ShipmentRow
                  key={shipment.id}
                  shipment={shipment}
                  isSelected={selected?.id === shipment.id}
                  onClick={() => setSelected(shipment)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination hint ────────────────────────────────────────────────── */}
        {!isLoading && filtered.length > 0 && (
          <div className="py-4 flex items-center justify-between border-t border-white/6 text-xs text-white/30">
            <span>Showing {filtered.length} load{filtered.length !== 1 ? 's' : ''}</span>
            <span>Click any row for details</span>
          </div>
        )}
      </div>

      {/* ── Slide-over drawer ────────────────────────────────────────────────── */}
      <DetailDrawer
        shipment={selected}
        onClose={() => { setSelected(null); setBookError(null); }}
        onBook={handleBook}
        booked={booked}
        isBooking={bookMutation.isPending}
        bookError={bookError}
      />
    </div>
  );
}
