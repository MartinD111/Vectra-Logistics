'use client';

// Yard map block: the 2D floor plan (Leaflet CRS.Simple canvas, loaded
// ssr-false) plus controls — define zones, simulate a gate arrival (fires the
// real ANPR/OCR webhook), and an "unassigned" tray to park arrivals into slots.
// Assets dragged on the map snap to the nearest free slot.

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Warehouse, Plus, ScanLine, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { YardMapBlock as YardMapBlockType } from '@/lib/projectPage/blocks';
import {
  useYardLayout, useCreateZone, useMoveAsset,
} from '@/lib/hooks/useYard';
import { yardApi, type YardSlot, type YardAsset, type ZoneKind } from '@/lib/api/yard.api';

const YardMapCanvas = dynamic(() => import('./YardMapCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-sm text-gray-400">Loading yard…</div>,
});

const ZONE_KINDS: { value: ZoneKind; label: string }[] = [
  { value: 'truck_parking', label: 'Truck Parking' },
  { value: 'teu_container', label: 'TEU Containers' },
  { value: 'pallet_rack', label: 'Pallet Racks' },
  { value: 'car_lot', label: 'Car Lot' },
];

/** Zone kinds an asset kind prefers when auto-parking. */
const PREFERRED_ZONE: Record<string, ZoneKind[]> = {
  truck: ['truck_parking'],
  container: ['teu_container'],
  trailer: ['truck_parking', 'car_lot'],
  wagon: ['teu_container'],
};

export function YardMapView({ block }: { block: YardMapBlockType; projectId: string }) {
  const { user } = useAuth();
  // The yard is a physical, company-wide asset (gate cameras carry no project
  // context) — always the company yard, not project-scoped.
  const { data: layout, isLoading } = useYardLayout();
  const createZone = useCreateZone();
  const move = useMoveAsset();
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneKind, setZoneKind] = useState<ZoneKind>('truck_parking');
  const [gating, setGating] = useState(false);

  const slotById = useMemo(() => {
    const m = new Map<string, YardSlot>();
    (layout?.slots ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [layout?.slots]);

  const unassigned = (layout?.assets ?? []).filter((a) => !a.slot_id);

  /** Nearest free slot to a point, within a snap radius (yard units). */
  const nearestFreeSlot = (x: number, y: number, radius = 45): YardSlot | null => {
    let best: YardSlot | null = null;
    let bestD = radius * radius;
    for (const s of layout?.slots ?? []) {
      if (s.status !== 'free') continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  };

  const onAssetDrop = (assetId: string, x: number, y: number) => {
    const slot = nearestFreeSlot(x, y);
    if (slot) move.mutate({ id: assetId, slot_id: slot.id, x: slot.x, y: slot.y });
    else move.mutate({ id: assetId, x, y, slot_id: null });
  };

  const park = (asset: YardAsset) => {
    const kinds = PREFERRED_ZONE[asset.kind] ?? [];
    const zoneIds = new Set((layout?.zones ?? []).filter((z) => kinds.includes(z.kind)).map((z) => z.id));
    const slot = (layout?.slots ?? []).find((s) => s.status === 'free' && zoneIds.has(s.zone_id))
      ?? (layout?.slots ?? []).find((s) => s.status === 'free');
    if (slot) move.mutate({ id: asset.id, slot_id: slot.id, x: slot.x, y: slot.y });
  };

  const simulateGate = async (mode: 'anpr' | 'ocr') => {
    if (!user?.company_id) return;
    setGating(true);
    try { await yardApi.simulateGate(user.company_id, mode); }
    finally { setGating(false); }
  };

  const submitZone = () => {
    if (!zoneName.trim()) return;
    createZone.mutate({ name: zoneName.trim(), kind: zoneKind, slots: 6 });
    setZoneName('');
    setShowZoneForm(false);
  };

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Warehouse className="w-4 h-4 text-gray-400" /> {block.title || 'Yard map'}
          {layout?.demo && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
              title="A demo yard was created so this block works out of the box.">demo yard</span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => simulateGate('anpr')} disabled={gating}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-60"
            title="Fire a demo ANPR plate read at the gate.">
            {gating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />} Gate arrival
          </button>
          <button onClick={() => setShowZoneForm((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <Plus className="w-3.5 h-3.5" /> Zone
          </button>
        </div>
      </div>

      {showZoneForm && (
        <div className="flex items-center gap-1.5 mb-3">
          <input value={zoneName} onChange={(e) => setZoneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitZone(); }}
            placeholder="Zone name" className="saas-input !py-1.5 text-sm flex-1" />
          <select value={zoneKind} onChange={(e) => setZoneKind(e.target.value as ZoneKind)}
            className="saas-input !py-1.5 text-sm w-40">
            {ZONE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <button onClick={submitZone} disabled={!zoneName.trim() || createZone.isPending}
            className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">Add</button>
        </div>
      )}

      <div style={{ height: 440 }} className="relative">
        {isLoading || !layout ? (
          <div className="h-full w-full rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading yard…
          </div>
        ) : (
          <YardMapCanvas extent={layout.extent} zones={layout.zones} slots={layout.slots} assets={layout.assets} onAssetDrop={onAssetDrop} />
        )}
      </div>

      {/* Unassigned tray — gate arrivals land here until parked */}
      {unassigned.length > 0 && (
        <div className="mt-3">
          <p className="label-xs flex items-center gap-1 mb-1.5"><MapPin className="w-3 h-3" /> Unassigned ({unassigned.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((a) => (
              <button key={a.id} onClick={() => park(a)} disabled={move.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1 text-xs hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Park in the first free matching slot">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{a.label}</span>
                {a.status === 'gate_in' && <span className="text-[9px] font-bold text-emerald-600">GATE</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
