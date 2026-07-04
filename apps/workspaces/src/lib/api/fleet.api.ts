import { apiFetch } from './client';

// ── Telematics ──────────────────────────────────────────────────────────────

export type AetrStatus = 'ok' | 'warning' | 'violation';

export interface TelematicsVehicle {
  id: string;
  plate: string;
  driver_name: string;
  provider: string;
  trip_status: 'in_transit' | 'stopped' | 'idle';
  position: { lat: number; lng: number };
  speed_kmh: number;
  route: {
    origin: string;
    destination: string;
    eta: string;
    progress_pct: number;
  } | null;
  aetr: {
    continuous_drive_min: number;
    daily_drive_min: number;
    weekly_drive_min: number;
    remaining_continuous_min: number;
    remaining_daily_min: number;
    next_rest: 'break_45min' | 'daily_rest';
    status: AetrStatus;
  };
}

export interface TelematicsSnapshot {
  demo: boolean;
  provider: string | null;
  vehicles: TelematicsVehicle[];
}

// ── Spot quote ──────────────────────────────────────────────────────────────

export type SpotQuoteEquipment = 'tautliner' | 'mega' | 'reefer' | 'container';

export interface SpotQuote {
  origin: string;
  destination: string;
  equipment: string;
  distance_km: number;
  drive_time_h: number;
  days: number;
  breakdown: {
    fuel_eur: number;
    tolls_eur: number;
    driver_eur: number;
    overhead_eur: number;
    fuel_price_eur_l: number;
    consumption_l_100km: number;
    toll_rate_eur_km: number;
  };
  break_even_eur: number;
  break_even_eur_per_km: number;
  margin_pct: number;
  suggested_rate_eur: number;
  note: string;
}

// ── Exceptions ──────────────────────────────────────────────────────────────

export interface FleetException {
  id: string;
  company_id: string;
  kind: string;     // border_delay | port_congestion | wagon_damage | engine_fault
  severity: string; // info | warning | critical
  title: string;
  detail: Record<string, unknown>;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const BASE = '/api/v1/fleet';

export const fleetApi = {
  telematics: () => apiFetch<TelematicsSnapshot>(`${BASE}/telematics`),

  spotQuote: (data: { origin: string; destination: string; equipment: SpotQuoteEquipment; margin_pct?: number }) =>
    apiFetch<{ quote: SpotQuote }>(`${BASE}/spot-quote`, 'POST', data).then((r) => r.quote),
  quoteCities: () =>
    apiFetch<{ cities: { name: string; country: string }[] }>(`${BASE}/spot-quote/cities`).then((r) => r.cities),

  listExceptions: () =>
    apiFetch<{ exceptions: FleetException[] }>(`${BASE}/exceptions`).then((r) => r.exceptions),
  simulateException: () =>
    apiFetch<{ exception: FleetException }>(`${BASE}/exceptions/simulate`, 'POST').then((r) => r.exception),
  resolveException: (id: string) =>
    apiFetch<{ exception: FleetException }>(`${BASE}/exceptions/${id}/resolve`, 'PATCH').then((r) => r.exception),
};
