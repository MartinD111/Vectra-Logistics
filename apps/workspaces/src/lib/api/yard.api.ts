import { apiFetch } from './client';

export type ZoneKind = 'pallet_rack' | 'car_lot' | 'teu_container' | 'truck_parking';
export type AssetKind = 'truck' | 'container' | 'trailer' | 'wagon';
export type WagonStatus = 'in_port' | 'loading_sequence' | 'in_transit' | 'discharging';

export interface YardZone {
  id: string; company_id: string; project_id: string | null;
  name: string; kind: ZoneKind; color: string | null;
  x: number; y: number; width: number; height: number;
}
export interface YardSlot {
  id: string; company_id: string; zone_id: string;
  label: string; x: number; y: number; status: 'free' | 'occupied' | 'reserved';
}
export interface YardAsset {
  id: string; company_id: string; kind: AssetKind;
  label: string; identifier: string | null; slot_id: string | null;
  x: number; y: number; status: string; source: string;
}
export interface YardLayout {
  demo: boolean;
  extent: { width: number; height: number };
  zones: YardZone[];
  slots: YardSlot[];
  assets: YardAsset[];
}
export interface RailWagon {
  id: string; company_id: string; project_id: string | null;
  wagon_number: string; status: WagonStatus; seq: number;
  cargo: string | null; reference: string | null;
}

const BASE = '/api/v1/yard';

export const yardApi = {
  layout: (projectId?: string) =>
    apiFetch<YardLayout>(`${BASE}/layout${projectId ? `?project_id=${projectId}` : ''}`),
  createZone: (data: { name: string; kind: ZoneKind; slots?: number; x?: number; y?: number; width?: number; height?: number }) =>
    apiFetch<{ zone: YardZone }>(`${BASE}/zones`, 'POST', data).then((r) => r.zone),
  deleteZone: (id: string) => apiFetch<void>(`${BASE}/zones/${id}`, 'DELETE'),
  createAsset: (data: { kind: AssetKind; label: string; identifier?: string | null; x?: number; y?: number }) =>
    apiFetch<{ asset: YardAsset }>(`${BASE}/assets`, 'POST', data).then((r) => r.asset),
  moveAsset: (id: string, data: { x?: number; y?: number; slot_id?: string | null }) =>
    apiFetch<{ asset: YardAsset }>(`${BASE}/assets/${id}`, 'PATCH', data).then((r) => r.asset),

  /** Simulate an edge-AI gate read (ANPR plate or OCR container) — hits the
   *  public gate webhook so the auto-check-in + slot assignment runs for real. */
  simulateGate: (companyId: string, mode: 'anpr' | 'ocr') => {
    if (mode === 'anpr') {
      const plate = `LJ ${100 + Math.floor(Math.random() * 899)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
      return apiFetch<{ ok: boolean; assigned_slot: string | null }>('/api/webhooks/anpr', 'POST', { company_id: companyId, plate, gate: 'Gate A' });
    }
    const cn = `MSKU${100000 + Math.floor(Math.random() * 899999)}`;
    return apiFetch<{ ok: boolean; assigned_slot: string | null }>('/api/webhooks/ocr', 'POST', { company_id: companyId, container_number: cn, gate: 'Gate B' });
  },

  listWagons: (projectId?: string) =>
    apiFetch<{ wagons: RailWagon[] }>(`${BASE}/wagons${projectId ? `?project_id=${projectId}` : ''}`).then((r) => r.wagons),
  createWagon: (data: { wagon_number: string; status?: WagonStatus; cargo?: string | null }) =>
    apiFetch<{ wagon: RailWagon }>(`${BASE}/wagons`, 'POST', data).then((r) => r.wagon),
  updateWagon: (id: string, data: { status?: WagonStatus; seq?: number }) =>
    apiFetch<{ wagon: RailWagon }>(`${BASE}/wagons/${id}`, 'PATCH', data).then((r) => r.wagon),
};
