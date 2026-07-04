import { apiFetch } from './client';

export type PodStatus = 'pending' | 'delivered' | 'expired';

export interface PodRequest {
  id: string;
  company_id: string;
  token: string;
  label: string;
  shipment_id: string | null;
  driver_phone: string | null;
  client_id: string | null;
  agreed_rate_eur: number | null;
  status: PodStatus;
  pod_url: string | null;
  expires_at: string;
  delivered_at: string | null;
  created_at: string;
}

const BASE = '/api/v1/pod';

export const podApi = {
  list: () => apiFetch<{ requests: PodRequest[] }>(`${BASE}/requests`).then((r) => r.requests),
  create: (data: { label: string; shipment_id?: string | null; driver_phone?: string | null; client_id?: string | null; agreed_rate_eur?: number | null }) =>
    apiFetch<{ request: PodRequest }>(`${BASE}/requests`, 'POST', data).then((r) => r.request),
  simulateArrival: () =>
    apiFetch<{ request: PodRequest }>(`${BASE}/simulate-arrival`, 'POST').then((r) => r.request),
};
