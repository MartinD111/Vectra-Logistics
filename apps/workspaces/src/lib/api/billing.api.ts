import { apiFetch } from './client';

export type VatTreatment = 'standard' | 'reverse_charge' | 'export_zero';
export type InvoiceStatus = 'draft' | 'approved' | 'paid' | 'void';

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
  created_at: string;
  updated_at: string;
}

export interface VatResult {
  treatment: VatTreatment;
  rate: number;
  note: string;
  vat_id_valid: boolean;
  supplier_country: string;
  client_country: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string | null;
  pod_request_id: string | null;
  number: string;
  description: string;
  amount_net: number;
  vat_treatment: VatTreatment;
  vat_rate: number;
  vat_amount: number;
  amount_total: number;
  vat_note: string | null;
  currency: string;
  status: InvoiceStatus;
  pod_url: string | null;
  issued_at: string;
  due_at: string | null;
  created_at: string;
}

export interface CreateClientInput {
  name: string;
  country: string;
  vat_id?: string | null;
  email?: string | null;
  credit_limit?: number;
  default_rate_eur?: number | null;
  notes?: string | null;
}

const BASE = '/api/v1/billing';

export const billingApi = {
  listClients: () => apiFetch<{ clients: CrmClient[] }>(`${BASE}/clients`).then((r) => r.clients),
  createClient: (data: CreateClientInput) =>
    apiFetch<{ client: CrmClient }>(`${BASE}/clients`, 'POST', data).then((r) => r.client),
  updateClient: (id: string, data: Partial<CreateClientInput>) =>
    apiFetch<{ client: CrmClient }>(`${BASE}/clients/${id}`, 'PATCH', data).then((r) => r.client),

  evaluateVat: (data: { client_country: string; client_vat_id?: string | null; supplier_country?: string }) =>
    apiFetch<{ vat: VatResult }>(`${BASE}/vat/evaluate`, 'POST', data).then((r) => r.vat),

  listInvoices: () => apiFetch<{ invoices: Invoice[] }>(`${BASE}/invoices`).then((r) => r.invoices),
  approveInvoice: (id: string) =>
    apiFetch<{ invoice: Invoice }>(`${BASE}/invoices/${id}/approve`, 'POST').then((r) => r.invoice),
  markPaid: (id: string) =>
    apiFetch<{ invoice: Invoice }>(`${BASE}/invoices/${id}/pay`, 'POST').then((r) => r.invoice),
};
