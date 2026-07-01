import { apiFetch } from './client';

export interface OutlookStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  demo: boolean;
}

type ConnectResult =
  | { mode: 'demo'; status: OutlookStatus }
  | { mode: 'redirect'; authorizeUrl: string };

const BASE = '/api/v1/outlook';

export const outlookApi = {
  status: () => apiFetch<{ status: OutlookStatus }>(`${BASE}/status`).then((r) => r.status),
  connect: () => apiFetch<ConnectResult>(`${BASE}/connect`, 'POST', {}),
  disconnect: () => apiFetch<void>(`${BASE}/disconnect`, 'POST'),
};
