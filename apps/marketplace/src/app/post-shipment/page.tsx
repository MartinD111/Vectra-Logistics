'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AlertCircle, CheckCircle2, Loader2, MapPin, Package, Truck } from 'lucide-react';
import { geocodeFirst } from '@vectra/data';
import { useCreateShipment } from '@vectra/data';
import { ApiError } from '@vectra/api-client';
import RequireSignIn from '@/components/RequireSignIn';

const RoutePreviewMap = dynamic(() => import('@vectra/data/map').then((m) => ({ default: m.RoutePreviewMap })), { ssr: false });

interface FormState {
  pickup_address: string;
  delivery_address: string;
  cargo_weight_kg: string;
  cargo_volume_m3: string;
  pallet_count: string;
  cargo_type: string;
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_deadline: string;
}

const INITIAL: FormState = {
  pickup_address: '',
  delivery_address: '',
  cargo_weight_kg: '',
  cargo_volume_m3: '',
  pallet_count: '',
  cargo_type: '',
  pickup_window_start: '',
  pickup_window_end: '',
  delivery_deadline: '',
};

interface Coord { lat: number; lng: number; label: string }

function validate(s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.pickup_address.trim()) e.pickup_address = 'Pickup location is required';
  if (!s.delivery_address.trim()) e.delivery_address = 'Delivery location is required';
  if (!s.cargo_weight_kg || Number(s.cargo_weight_kg) <= 0) e.cargo_weight_kg = 'Weight must be > 0';
  if (!s.cargo_volume_m3 || Number(s.cargo_volume_m3) <= 0) e.cargo_volume_m3 = 'Volume must be > 0';
  if (!s.pallet_count || Number(s.pallet_count) < 0) e.pallet_count = 'Pallets must be ≥ 0';
  if (!s.cargo_type.trim()) e.cargo_type = 'Cargo type is required';
  if (!s.pickup_window_start) e.pickup_window_start = 'Pickup start is required';
  if (!s.pickup_window_end) e.pickup_window_end = 'Pickup end is required';
  if (!s.delivery_deadline) e.delivery_deadline = 'Delivery deadline is required';
  if (s.pickup_window_start && s.pickup_window_end && s.pickup_window_end < s.pickup_window_start) {
    e.pickup_window_end = 'Pickup end must be after start';
  }
  if (s.pickup_window_end && s.delivery_deadline && s.delivery_deadline < s.pickup_window_end) {
    e.delivery_deadline = 'Delivery deadline must be after pickup end';
  }
  return e;
}

export default function PostShipmentPageGuarded() {
  return (
    <RequireSignIn>
      <PostShipmentPage />
    </RequireSignIn>
  );
}

function PostShipmentPage() {
  const router = useRouter();
  const create = useCreateShipment();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickup, setPickup] = useState<Coord | null>(null);
  const [delivery, setDelivery] = useState<Coord | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors((p) => ({ ...p, [k as string]: '' }));
  }

  async function resolveAddress(kind: 'pickup' | 'delivery') {
    const q = kind === 'pickup' ? form.pickup_address : form.delivery_address;
    if (!q.trim()) return;
    setGeocoding(true);
    try {
      const hit = await geocodeFirst(q);
      if (!hit) {
        setErrors((p) => ({ ...p, [`${kind}_address`]: 'Could not locate this address' }));
        return;
      }
      const coord = { lat: hit.lat, lng: hit.lng, label: hit.label };
      if (kind === 'pickup') setPickup(coord);
      else setDelivery(coord);
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
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }

    // Ensure both endpoints are geocoded.
    let p = pickup;
    let d = delivery;
    try {
      if (!p) p = await geocodeFirst(form.pickup_address).then((r) => r && { ...r });
      if (!d) d = await geocodeFirst(form.delivery_address).then((r) => r && { ...r });
    } catch {
      setSubmitError('Could not resolve addresses. Please verify them and try again.');
      return;
    }
    if (!p || !d) {
      setSubmitError('Could not resolve one or both addresses.');
      return;
    }
    setPickup(p); setDelivery(d);

    try {
      const shipment = await create.mutateAsync({
        pickup_address: form.pickup_address,
        pickup_lat: p.lat,
        pickup_lng: p.lng,
        delivery_address: form.delivery_address,
        delivery_lat: d.lat,
        delivery_lng: d.lng,
        cargo_weight_kg: Number(form.cargo_weight_kg),
        cargo_volume_m3: Number(form.cargo_volume_m3),
        pallet_count: Number(form.pallet_count),
        cargo_type: form.cargo_type,
        pickup_window_start: new Date(form.pickup_window_start).toISOString(),
        pickup_window_end: new Date(form.pickup_window_end).toISOString(),
        delivery_deadline: new Date(form.delivery_deadline).toISOString(),
      });
      router.push(`/shipments/${shipment.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to post shipment.');
    }
  }

  const fieldErr = (k: keyof FormState) =>
    errors[k] ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[k]}</p> : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold dark:text-white">Post New Shipment</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="saas-card">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Location</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="Address or City"
                  value={form.pickup_address}
                  onChange={(e) => update('pickup_address', e.target.value)}
                  onBlur={() => resolveAddress('pickup')}
                />
                {fieldErr('pickup_address')}
                {pickup && <p className="mt-1 text-xs text-green-600 dark:text-green-400 truncate">✓ {pickup.label}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Location</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="Address or City"
                  value={form.delivery_address}
                  onChange={(e) => update('delivery_address', e.target.value)}
                  onBlur={() => resolveAddress('delivery')}
                />
                {fieldErr('delivery_address')}
                {delivery && <p className="mt-1 text-xs text-green-600 dark:text-green-400 truncate">✓ {delivery.label}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo Weight (kg)</label>
                <input type="number" className="saas-input" value={form.cargo_weight_kg}
                  onChange={(e) => update('cargo_weight_kg', e.target.value)} />
                {fieldErr('cargo_weight_kg')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volume (m³)</label>
                <input type="number" step="0.1" className="saas-input" value={form.cargo_volume_m3}
                  onChange={(e) => update('cargo_volume_m3', e.target.value)} />
                {fieldErr('cargo_volume_m3')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pallet Count</label>
                <input type="number" className="saas-input" value={form.pallet_count}
                  onChange={(e) => update('pallet_count', e.target.value)} />
                {fieldErr('pallet_count')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Window Start</label>
                <input type="datetime-local" className="saas-input" value={form.pickup_window_start}
                  onChange={(e) => update('pickup_window_start', e.target.value)} />
                {fieldErr('pickup_window_start')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Window End</label>
                <input type="datetime-local" className="saas-input" value={form.pickup_window_end}
                  onChange={(e) => update('pickup_window_end', e.target.value)} />
                {fieldErr('pickup_window_end')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Deadline</label>
                <input type="datetime-local" className="saas-input" value={form.delivery_deadline}
                  onChange={(e) => update('delivery_deadline', e.target.value)} />
                {fieldErr('delivery_deadline')}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo Type</label>
                <input type="text" className="saas-input" placeholder="e.g. Electronics, Furniture" value={form.cargo_type}
                  onChange={(e) => update('cargo_type', e.target.value)} />
                {fieldErr('cargo_type')}
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
                disabled={create.isPending || geocoding}
                className="saas-button py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {create.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                {create.isPending ? 'Posting…' : 'Post Shipment & Find Matches'}
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
            <RoutePreviewMap origin={pickup} destination={delivery} />
          </div>
          {!pickup && !delivery && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter pickup and delivery addresses to see the route.
            </p>
          )}
          {pickup && delivery && (
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-200 dark:border-dark-border flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Both endpoints geocoded. The matching engine will run after posting.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
