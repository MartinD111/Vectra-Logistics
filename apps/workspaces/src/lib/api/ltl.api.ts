import { apiFetch } from './client';

export interface LtlSuggestion {
  id: string;
  company_id: string;
  partial_load_id: string;
  route_id: string;
  route_label: string;
  partial_label: string;
  detour_km: number;
  detour_min: number;
  added_revenue_eur: number;
  margin_eur: number;
  score: number;
  status: 'suggested' | 'accepted' | 'dismissed';
  created_at: string;
}

export interface PartialLoad {
  id: string;
  company_id: string;
  label: string;
  origin: string;
  destination: string;
  weight_kg: number;
  offered_rate_eur: number;
  status: string;
  created_at: string;
}

const BASE = '/api/v1/ltl';

export const ltlApi = {
  listSuggestions: () => apiFetch<{ suggestions: LtlSuggestion[] }>(`${BASE}/suggestions`).then((r) => r.suggestions),
  listPartials: () => apiFetch<{ partials: PartialLoad[] }>(`${BASE}/partials`).then((r) => r.partials),
  scan: () => apiFetch<{ suggestions: LtlSuggestion[] }>(`${BASE}/scan`, 'POST').then((r) => r.suggestions),
  accept: (id: string) => apiFetch<{ suggestion: LtlSuggestion }>(`${BASE}/suggestions/${id}/accept`, 'POST').then((r) => r.suggestion),
  dismiss: (id: string) => apiFetch<{ suggestion: LtlSuggestion }>(`${BASE}/suggestions/${id}/dismiss`, 'POST').then((r) => r.suggestion),
};
