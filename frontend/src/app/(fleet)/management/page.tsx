'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Users, Plus, X, Check, Loader2,
  Weight, Hash, Gauge, Phone, Mail, CreditCard,
  AlertCircle, ChevronRight,
} from 'lucide-react';
import {
  fleetApi,
  Vehicle, Driver,
  CreateVehicleDto, CreateDriverDto,
} from '@/lib/api/fleet.api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'vehicles' | 'drivers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function formatWeight(kg: number | undefined): string {
  if (kg == null) return '—';
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg} kg`;
}

// ── Vehicle type badge ────────────────────────────────────────────────────────

const VEHICLE_TYPE_STYLES: Record<string, { label: string; classes: string }> = {
  reefer:      { label: 'Reefer',      classes: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30' },
  flatbed:     { label: 'Flatbed',     classes: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
  box_truck:   { label: 'Box Truck',   classes: 'bg-blue-500/15 text-blue-400 ring-blue-500/30' },
  curtainsider:{ label: 'Curtainsider',classes: 'bg-violet-500/15 text-violet-400 ring-violet-500/30' },
  tanker:      { label: 'Tanker',      classes: 'bg-orange-500/15 text-orange-400 ring-orange-500/30' },
  lowloader:   { label: 'Low Loader',  classes: 'bg-rose-500/15 text-rose-400 ring-rose-500/30' },
};

function VehicleTypeBadge({ type }: { type: string }) {
  const key = type?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const cfg = VEHICLE_TYPE_STYLES[key] ?? {
    label: type ?? 'Unknown',
    classes: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ── Driver status badge ───────────────────────────────────────────────────────

const DRIVER_STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  active:   { label: 'Available',  classes: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
  inactive: { label: 'Inactive',   classes: 'bg-slate-500/15 text-slate-400 ring-slate-500/30' },
  on_leave: { label: 'On Leave',   classes: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30' },
};

function DriverStatusBadge({ status }: { status: Driver['status'] | undefined }) {
  const cfg = DRIVER_STATUS_STYLES[status ?? 'inactive'] ?? DRIVER_STATUS_STYLES.inactive;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-4 rounded-md bg-white/5 animate-pulse"
            style={{ width: `${55 + (i * 23) % 35}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-20 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
            <Truck className="w-6 h-6 text-white/20" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/40">No {label} yet</p>
            <p className="text-xs text-white/20 mt-1">Add your first {label.toLowerCase().replace(/s$/, '')} to get started</p>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/30 transition-colors ring-1 ring-indigo-500/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {label.replace(/s$/, '')}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm text-white/50">Failed to load data</p>
          <p className="text-xs text-white/25">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ── Vehicles table ────────────────────────────────────────────────────────────

function VehiclesTable({
  vehicles,
  isLoading,
  isError,
  errorMessage,
  onAdd,
}: {
  vehicles: Vehicle[] | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onAdd: () => void;
}) {
  const headers = ['License Plate', 'Type', 'Max Weight', 'Volume', 'Pallets', 'Telematics', 'Added', ''];

  return (
    <table className="w-full min-w-[640px] border-collapse">
      <thead>
        <tr className="border-b border-white/8">
          {headers.map((h) => (
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
        {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
        {isError && <ErrorRow message={errorMessage} />}
        {!isLoading && !isError && (vehicles ?? []).length === 0 && (
          <EmptyState label="Vehicles" onAdd={onAdd} />
        )}
        {!isLoading && !isError && (vehicles ?? []).map((v) => {
          const syncedRecently = v.last_sync_at != null &&
            Date.now() - new Date(v.last_sync_at).getTime() < 10 * 60 * 1000;
          return (
            <tr
              key={v.id}
              className="border-b border-white/5 hover:bg-white/[0.025] transition-colors duration-100 group"
            >
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-mono font-semibold text-white tracking-wide">
                    {v.license_plate ?? '—'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <VehicleTypeBadge type={v.vehicle_type ?? ''} />
              </td>
              <td className="px-4 py-3.5 text-sm text-white/70">
                {formatWeight(v.max_weight_kg)}
              </td>
              <td className="px-4 py-3.5 text-sm text-white/70">
                {v.max_volume_m3 != null ? `${v.max_volume_m3} m³` : '—'}
              </td>
              <td className="px-4 py-3.5 text-sm text-white/70">
                {v.max_pallets != null ? `${v.max_pallets} EUR` : '—'}
              </td>
              <td className="px-4 py-3.5">
                {syncedRecently ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-emerald-500/15 text-emerald-400 ring-emerald-500/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="text-xs text-white/20 font-mono">
                    {v.last_sync_at ? formatDate(v.last_sync_at) : 'No sync'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-xs text-white/35">
                {formatDate(v.created_at)}
              </td>
              <td className="px-4 py-3.5 text-white/20 group-hover:text-white/40 transition-colors text-right">
                <ChevronRight className="w-4 h-4 inline-block" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Drivers table ─────────────────────────────────────────────────────────────

function DriversTable({
  drivers,
  isLoading,
  isError,
  errorMessage,
  onAdd,
}: {
  drivers: Driver[] | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onAdd: () => void;
}) {
  const headers = ['Name', 'Phone', 'Email', 'License No.', 'Status', 'Added', ''];

  return (
    <table className="w-full min-w-[640px] border-collapse">
      <thead>
        <tr className="border-b border-white/8">
          {headers.map((h) => (
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
        {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
        {isError && <ErrorRow message={errorMessage} />}
        {!isLoading && !isError && (drivers ?? []).length === 0 && (
          <EmptyState label="Drivers" onAdd={onAdd} />
        )}
        {!isLoading && !isError && (drivers ?? []).map((d) => (
          <tr
            key={d.id}
            className="border-b border-white/5 hover:bg-white/[0.025] transition-colors duration-100 group"
          >
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-white">
                  {[d.first_name, d.last_name].filter(Boolean).join(' ') || '—'}
                </span>
              </div>
            </td>
            <td className="px-4 py-3.5 text-sm text-white/60 font-mono">
              {d.phone ?? '—'}
            </td>
            <td className="px-4 py-3.5 text-sm text-white/60">
              {d.email ?? '—'}
            </td>
            <td className="px-4 py-3.5 text-sm font-mono text-white/60">
              {d.license_number ?? '—'}
            </td>
            <td className="px-4 py-3.5">
              <DriverStatusBadge status={d.status} />
            </td>
            <td className="px-4 py-3.5 text-xs text-white/35">
              {formatDate(d.created_at)}
            </td>
            <td className="px-4 py-3.5 text-white/20 group-hover:text-white/40 transition-colors text-right">
              <ChevronRight className="w-4 h-4 inline-block" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Form field ────────────────────────────────────────────────────────────────

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-widest">
        {icon}
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/50 transition-colors';

const selectCls =
  'w-full px-3 py-2.5 rounded-lg bg-[#0f111a] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/50 transition-colors appearance-none cursor-pointer';

// ── Vehicle form ──────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  'reefer', 'flatbed', 'box_truck', 'curtainsider', 'tanker', 'lowloader',
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  reefer: 'Reefer', flatbed: 'Flatbed', box_truck: 'Box Truck',
  curtainsider: 'Curtainsider', tanker: 'Tanker', lowloader: 'Low Loader',
};

interface VehicleFormState {
  license_plate: string;
  vehicle_type: string;
  max_weight_kg: string;
  max_volume_m3: string;
  max_pallets: string;
}

const EMPTY_VEHICLE: VehicleFormState = {
  license_plate: '', vehicle_type: 'reefer',
  max_weight_kg: '', max_volume_m3: '', max_pallets: '',
};

function VehicleForm({
  onSubmit,
  isPending,
  apiError,
}: {
  onSubmit: (dto: CreateVehicleDto) => void;
  isPending: boolean;
  apiError: string | null;
}) {
  const [form, setForm] = useState<VehicleFormState>(EMPTY_VEHICLE);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormState, string>>>({});

  function set(field: keyof VehicleFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.license_plate.trim()) next.license_plate = 'License plate is required';
    if (!form.vehicle_type) next.vehicle_type = 'Vehicle type is required';
    const w = parseFloat(form.max_weight_kg);
    if (form.max_weight_kg && (isNaN(w) || w <= 0)) next.max_weight_kg = 'Must be a positive number';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      license_plate: form.license_plate.trim().toUpperCase(),
      vehicle_type:  form.vehicle_type,
      ...(form.max_weight_kg && { max_weight_kg: parseFloat(form.max_weight_kg) }),
      ...(form.max_volume_m3  && { max_volume_m3:  parseFloat(form.max_volume_m3) }),
      ...(form.max_pallets    && { max_pallets:    parseInt(form.max_pallets, 10) }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="License Plate" icon={<Hash className="w-3 h-3" />} error={errors.license_plate}>
        <input
          className={inputCls}
          placeholder="e.g. LJ-AB-123"
          value={form.license_plate}
          onChange={set('license_plate')}
          autoFocus
        />
      </Field>

      <Field label="Vehicle Type" icon={<Truck className="w-3 h-3" />} error={errors.vehicle_type}>
        <div className="relative">
          <select className={selectCls} value={form.vehicle_type} onChange={set('vehicle_type')}>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Max Weight kg" icon={<Weight className="w-3 h-3" />} error={errors.max_weight_kg}>
          <input
            className={inputCls}
            type="number"
            min="0"
            placeholder="24000"
            value={form.max_weight_kg}
            onChange={set('max_weight_kg')}
          />
        </Field>
        <Field label="Volume m³" icon={<Gauge className="w-3 h-3" />}>
          <input
            className={inputCls}
            type="number"
            min="0"
            placeholder="82"
            value={form.max_volume_m3}
            onChange={set('max_volume_m3')}
          />
        </Field>
        <Field label="Pallets">
          <input
            className={inputCls}
            type="number"
            min="0"
            placeholder="33"
            value={form.max_pallets}
            onChange={set('max_pallets')}
          />
        </Field>
      </div>

      {apiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{apiError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
        }}
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          <><Check className="w-4 h-4" /> Add Vehicle</>
        )}
      </button>
    </form>
  );
}

// ── Driver form ───────────────────────────────────────────────────────────────

interface DriverFormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  license_number: string;
}

const EMPTY_DRIVER: DriverFormState = {
  first_name: '', last_name: '', phone: '', email: '', license_number: '',
};

function DriverForm({
  onSubmit,
  isPending,
  apiError,
}: {
  onSubmit: (dto: CreateDriverDto) => void;
  isPending: boolean;
  apiError: string | null;
}) {
  const [form, setForm] = useState<DriverFormState>(EMPTY_DRIVER);
  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormState, string>>>({});

  function set(field: keyof DriverFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.first_name.trim()) next.first_name = 'First name is required';
    if (!form.last_name.trim())  next.last_name  = 'Last name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      first_name:     form.first_name.trim(),
      last_name:      form.last_name.trim(),
      ...(form.phone          && { phone:          form.phone.trim() }),
      ...(form.email          && { email:          form.email.trim() }),
      ...(form.license_number && { license_number: form.license_number.trim() }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" error={errors.first_name}>
          <input
            className={inputCls}
            placeholder="Jan"
            value={form.first_name}
            onChange={set('first_name')}
            autoFocus
          />
        </Field>
        <Field label="Last Name" error={errors.last_name}>
          <input
            className={inputCls}
            placeholder="Novak"
            value={form.last_name}
            onChange={set('last_name')}
          />
        </Field>
      </div>

      <Field label="Phone" icon={<Phone className="w-3 h-3" />}>
        <input
          className={inputCls}
          type="tel"
          placeholder="+386 41 123 456"
          value={form.phone}
          onChange={set('phone')}
        />
      </Field>

      <Field label="Email" icon={<Mail className="w-3 h-3" />}>
        <input
          className={inputCls}
          type="email"
          placeholder="jan.novak@company.com"
          value={form.email}
          onChange={set('email')}
        />
      </Field>

      <Field label="License Number" icon={<CreditCard className="w-3 h-3" />}>
        <input
          className={inputCls}
          placeholder="SLO-CE-123456"
          value={form.license_number}
          onChange={set('license_number')}
        />
      </Field>

      {apiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{apiError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
        }}
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          <><Check className="w-4 h-4" /> Add Driver</>
        )}
      </button>
    </form>
  );
}

// ── Slide-over drawer ─────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  tab: Tab;
  onClose: () => void;
  onSubmitVehicle: (dto: CreateVehicleDto) => void;
  onSubmitDriver:  (dto: CreateDriverDto)  => void;
  isPending: boolean;
  apiError: string | null;
}

function Drawer({ open, tab, onClose, onSubmitVehicle, onSubmitDriver, isPending, apiError }: DrawerProps) {
  const title = tab === 'vehicles' ? 'Add Vehicle' : 'Add Driver';
  const subtitle = tab === 'vehicles'
    ? 'Register a new vehicle to your fleet'
    : 'Onboard a new driver to your roster';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #0f111a 0%, #0b0d14 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-0.5">
              Fleet Management
            </p>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {tab === 'vehicles' ? (
            <VehicleForm onSubmit={onSubmitVehicle} isPending={isPending} apiError={apiError} />
          ) : (
            <DriverForm onSubmit={onSubmitDriver} isPending={isPending} apiError={apiError} />
          )}
        </div>
      </div>
    </>
  );
}

// ── Stats card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white/4 border border-white/8 px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-white/40 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FleetManagementPage() {
  const [tab, setTab]           = useState<Tab>('vehicles');
  const [drawerOpen, setDrawer] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // ── Queries ───────────────────────────────────────────────────────────────

  const {
    data: vehicles,
    isLoading: vehiclesLoading,
    isError: vehiclesError,
    error: vehiclesErrorObj,
  } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  () => fleetApi.getVehicles(),
    staleTime: 60_000,
  });

  const {
    data: drivers,
    isLoading: driversLoading,
    isError: driversError,
    error: driversErrorObj,
  } = useQuery({
    queryKey: ['drivers'],
    queryFn:  () => fleetApi.getDrivers(),
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const vehicleMutation = useMutation({
    mutationFn: (dto: CreateVehicleDto) => fleetApi.createVehicle(dto),
    onMutate:   () => setApiError(null),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDrawer(false);
    },
    onError: (err: Error) => setApiError(err.message ?? 'Failed to create vehicle'),
  });

  const driverMutation = useMutation({
    mutationFn: (dto: CreateDriverDto) => fleetApi.createDriver(dto),
    onMutate:   () => setApiError(null),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDrawer(false);
    },
    onError: (err: Error) => setApiError(err.message ?? 'Failed to create driver'),
  });

  const isPending = vehicleMutation.isPending || driverMutation.isPending;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openDrawer(t: Tab) {
    setTab(t);
    setApiError(null);
    setDrawer(true);
  }

  function closeDrawer() {
    if (isPending) return;
    setDrawer(false);
    setApiError(null);
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalVehicles   = vehicles?.length ?? 0;
  const totalDrivers    = drivers?.length ?? 0;
  const activeDrivers   = drivers?.filter((d) => d.status === 'active').length ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-[#080a10] text-white">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="px-6 pt-8 pb-6 border-b border-white/6"
        style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, transparent 100%)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest mb-1">
                VECTRA Fleet
              </p>
              <h1 className="text-2xl font-bold text-white">Fleet Management</h1>
              <p className="text-sm text-white/40 mt-1">Manage your vehicles and drivers</p>
            </div>
            <button
              onClick={() => openDrawer(tab)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)',
              }}
            >
              <Plus className="w-4 h-4" />
              Add {tab === 'vehicles' ? 'Vehicle' : 'Driver'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col gap-6 py-6">

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total Vehicles"
            value={vehiclesLoading ? '—' : totalVehicles}
            icon={<Truck className="w-5 h-5 text-indigo-400" />}
            color="bg-indigo-500/15"
          />
          <StatCard
            label="Total Drivers"
            value={driversLoading ? '—' : totalDrivers}
            icon={<Users className="w-5 h-5 text-violet-400" />}
            color="bg-violet-500/15"
          />
          <StatCard
            label="Available Drivers"
            value={driversLoading ? '—' : activeDrivers}
            icon={<Users className="w-5 h-5 text-emerald-400" />}
            color="bg-emerald-500/15"
          />
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-white/6">
          <div className="flex gap-1">
            {([
              { key: 'vehicles' as Tab, label: 'Vehicles', icon: <Truck className="w-3.5 h-3.5" />, count: totalVehicles },
              { key: 'drivers'  as Tab, label: 'Drivers',  icon: <Users className="w-3.5 h-3.5" />, count: totalDrivers  },
            ] as const).map(({ key, label, icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  tab === key ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {icon}
                {label}
                {!vehiclesLoading && !driversLoading && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono ${
                    tab === key ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/30'
                  }`}>
                    {count}
                  </span>
                )}
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
          {tab === 'vehicles' ? (
            <VehiclesTable
              vehicles={vehicles}
              isLoading={vehiclesLoading}
              isError={vehiclesError}
              errorMessage={(vehiclesErrorObj as Error)?.message ?? 'Unknown error'}
              onAdd={() => openDrawer('vehicles')}
            />
          ) : (
            <DriversTable
              drivers={drivers}
              isLoading={driversLoading}
              isError={driversError}
              errorMessage={(driversErrorObj as Error)?.message ?? 'Unknown error'}
              onAdd={() => openDrawer('drivers')}
            />
          )}
        </div>
      </div>

      {/* ── Slide-over drawer ────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        tab={tab}
        onClose={closeDrawer}
        onSubmitVehicle={(dto) => vehicleMutation.mutate(dto)}
        onSubmitDriver={(dto)  => driverMutation.mutate(dto)}
        isPending={isPending}
        apiError={apiError}
      />
    </div>
  );
}
