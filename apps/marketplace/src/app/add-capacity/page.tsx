'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AlertCircle, Loader2, MapPin, Truck } from 'lucide-react';
import { geocodeFirst } from '@vectra/data';
import { useCreateCapacity, useVehicles } from '@vectra/data';
import { ApiError } from '@vectra/api-client';
import RequireSignIn from '@/components/RequireSignIn';

const RoutePreviewMap = dynamic(() => import('@vectra/data/map').then((m) => ({ default: m.RoutePreviewMap })), { ssr: false });

interface FormState {
  vehicle_id: string;
  origin_address: string;
  destination_address: string;
  available_weight_kg: string;
  available_volume_m3: string;
  available_pallets: string;
  departure_time: string;
  delivery_deadline: string;
}

const INITIAL: FormState = {
  vehicle_id: '',
  origin_address: '',
  destination_address: '',
  available_weight_kg: '',
  available_volume_m3: '',
  available_pallets: '',
  departure_time: '',
  delivery_deadline: '',
};

interface Coord { lat: number; lng: number; label: string }

function validate(s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.vehicle_id) e.vehicle_id = 'Select a vehicle';
  if (!s.origin_address.trim()) e.origin_address = 'Origin is required';
  if (!s.destination_address.trim()) e.destination_address = 'Destination is required';
  if (!s.available_weight_kg || Number(s.available_weight_kg) <= 0) e.available_weight_kg = 'Must be > 0';
  if (!s.available_volume_m3 || Number(s.available_volume_m3) <= 0) e.available_volume_m3 = 'Must be > 0';
  if (!s.available_pallets || Number(s.available_pallets) < 0) e.available_pallets = 'Must be ≥ 0';
  if (!s.departure_time) e.departure_time = 'Departure time is required';
  if (!s.delivery_deadline) e.delivery_deadline = 'Delivery deadline is required';
  if (s.departure_time && s.delivery_deadline && s.delivery_deadline <= s.departure_time) {
    e.delivery_deadline = 'Deadline must be after departure';
  }
  return e;
}

export default function AddCapacityPageGuarded() {
  return (
    <RequireSignIn>
      <AddCapacityPage />
    </RequireSignIn>
  );
}

function AddCapacityPage() {
  const router = useRouter();
  const create = useCreateCapacity();
  const vehiclesQ = useVehicles();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState<Coord | null>(null);
  const [destination, setDestination] = useState<Coord | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors((p) => ({ ...p, [k as string]: '' }));
  }

  async function resolveAddress(kind: 'origin' | 'destination') {
    const q = kind === 'origin' ? form.origin_address : form.destination_address;
    if (!q.trim()) return;
    setGeocoding(true);
    try {
      const hit = await geocodeFirst(q);
      if (!hit) {
        setErrors((p) => ({ ...p, [`${kind}_address`]: 'Could not locate this address' }));
        return;
      }
      const c = { lat: hit.lat, lng: hit.lng, label: hit.label };
      if (kind === 'origin') setOrigin(c); else setDestination(c);
    } catch {
      setErrors((p) => ({ ...p, [`${kind}_address`]: 'Geocoding failed' }));
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const e2 = validate(form);
    if (Object.keys(e2).length) { setErrors(e2); return; }

    let o = origin; let d = destination;
    try {
      if (!o) o = await geocodeFirst(form.origin_address).then((r) => r && { ...r });
      if (!d) d = await geocodeFirst(form.destination_address).then((r) => r && { ...r });
    } catch {
      setSubmitError('Could not resolve addresses.'); return;
    }
    if (!o || !d) { setSubmitError('Could not resolve one or both addresses.'); return; }
    setOrigin(o); setDestination(d);

    try {
      const cap = await create.mutateAsync({
        vehicle_id: form.vehicle_id,
        origin_address: form.origin_address,
        origin_lat: o.lat,
        origin_lng: o.lng,
        destination_address: form.destination_address,
        destination_lat: d.lat,
        destination_lng: d.lng,
        departure_time: new Date(form.departure_time).toISOString(),
        delivery_deadline: new Date(form.delivery_deadline).toISOString(),
        available_weight_kg: Number(form.available_weight_kg),
        available_volume_m3: Number(form.available_volume_m3),
        available_pallets: Number(form.available_pallets),
      });
      router.push(`/capacities/${cap.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to publish capacity.');
    }
  }

  const fieldErr = (k: keyof FormState) =>
    errors[k] ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[k]}</p> : null;

  const vehicles = vehiclesQ.data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold dark:text-white">Publish Truck Capacity</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="saas-card">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vehicle</label>
              {vehiclesQ.isLoading ? (
                <p className="text-sm text-slate-500">Loading vehicles…</p>
              ) : vehicles.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No vehicles yet — <Link href="/fleet" className="underline font-medium">add one to your fleet</Link> first.
                </p>
              ) : (
                <select className="saas-input" value={form.vehicle_id}
                  onChange={(e) => update('vehicle_id', e.target.value)}>
                  <option value="">Select a vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.license_plate} — {v.vehicle_type} ({v.max_weight_kg}kg / {v.max_volume_m3}m³)
                    </option>
                  ))}
                </select>
              )}
              {fieldErr('vehicle_id')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Origin / Start Location</label>
                <input type="text" className="saas-input" placeholder="Address or City"
                  value={form.origin_address}
                  onChange={(e) => update('origin_address', e.target.value)}
                  onBlur={() => resolveAddress('origin')} />
                {fieldErr('origin_address')}
                {origin && <p className="mt-1 text-xs text-green-600 dark:text-green-400 truncate">✓ {origin.label}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination Location</label>
                <input type="text" className="saas-input" placeholder="Address or City"
                  value={form.destination_address}
                  onChange={(e) => update('destination_address', e.target.value)}
                  onBlur={() => resolveAddress('destination')} />
                {fieldErr('destination_address')}
                {destination && <p className="mt-1 text-xs text-green-600 dark:text-green-400 truncate">✓ {destination.label}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Available Weight (kg)</label>
                <input type="number" className="saas-input" value={form.available_weight_kg}
                  onChange={(e) => update('available_weight_kg', e.target.value)} />
                {fieldErr('available_weight_kg')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Available Vol (m³)</label>
                <input type="number" step="0.1" className="saas-input" value={form.available_volume_m3}
                  onChange={(e) => update('available_volume_m3', e.target.value)} />
                {fieldErr('available_volume_m3')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pallet Spaces</label>
                <input type="number" className="saas-input" value={form.available_pallets}
                  onChange={(e) => update('available_pallets', e.target.value)} />
                {fieldErr('available_pallets')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departure Time</label>
                <input type="datetime-local" className="saas-input" value={form.departure_time}
                  onChange={(e) => update('departure_time', e.target.value)} />
                {fieldErr('departure_time')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Deadline</label>
                <input type="datetime-local" className="saas-input" value={form.delivery_deadline}
                  onChange={(e) => update('delivery_deadline', e.target.value)} />
                {fieldErr('delivery_deadline')}
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
              </div>
            )}

            <div className="pt-6 border-t dark:border-dark-border flex items-center gap-3">
              <button
                type="submit"
                disabled={create.isPending || geocoding || vehicles.length === 0}
                className="saas-button py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {create.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                {create.isPending ? 'Publishing…' : 'Publish to Marketplace'}
              </button>
              {geocoding && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving address…
                </span>
              )}
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Route Preview
          </h2>
          <div className="h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-dark-border shadow-sm">
            <RoutePreviewMap origin={origin} destination={destination} />
          </div>
        </aside>
      </div>
    </div>
  );
}
