import { apiFetch } from './client';

export interface CrmClient {
  id: string;
  company_id: string;
  name: string;
  country: string;
  vat_id: string | null;
  email: string | null;
  credit_limit: number;
  outstanding_balance: number;
  default_rate_eur: number | null;
  notes: string | null;
  address: string | null;
  responsible_employee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  name: string;
  country: string;
  vat_id?: string | null;
  email?: string | null;
  credit_limit?: number;
  default_rate_eur?: number | null;
  notes?: string | null;
  address?: string | null;
  responsible_employee_id?: string | null;
}

export interface ClientProjectLink {
  client_id: string;
  project_id: string;
  rate_eur: number | null;
  responsible_employee_id: string | null;
  notes: string | null;
  is_overridden: { rate: boolean; responsible_employee: boolean; notes: boolean };
}

export interface LinkProjectInput {
  project_id: string;
  override_rate_eur?: number | null;
  override_responsible_employee_id?: string | null;
  override_notes?: string | null;
}

const BASE = '/api/v1/crm';

export const crmApi = {
  listClients: () => apiFetch<{ clients: CrmClient[] }>(`${BASE}/clients`).then((r) => r.clients),
  getClient: (id: string) => apiFetch<{ client: CrmClient }>(`${BASE}/clients/${id}`).then((r) => r.client),
  createClient: (data: CreateClientInput) =>
    apiFetch<{ client: CrmClient }>(`${BASE}/clients`, 'POST', data).then((r) => r.client),
  updateClient: (id: string, data: Partial<CreateClientInput>) =>
    apiFetch<{ client: CrmClient }>(`${BASE}/clients/${id}`, 'PATCH', data).then((r) => r.client),

  listClientProjectLinks: (clientId: string) =>
    apiFetch<{ links: ClientProjectLink[] }>(`${BASE}/clients/${clientId}/projects`).then((r) => r.links),
  upsertClientProjectLink: (clientId: string, data: LinkProjectInput) =>
    apiFetch<{ link: ClientProjectLink }>(`${BASE}/clients/${clientId}/projects`, 'POST', data).then((r) => r.link),

  getClientEmails: (clientId: string) =>
    apiFetch<{ emails: unknown[] }>(`${BASE}/clients/${clientId}/emails`).then((r) => r.emails),
  getClientRisk: (clientId: string) =>
    apiFetch<{ risk: { status: string; utilization_pct: number | null } }>(`${BASE}/clients/${clientId}/risk`).then((r) => r.risk),
};
