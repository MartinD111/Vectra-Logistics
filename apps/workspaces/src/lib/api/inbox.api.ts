import { apiFetch } from './client';

export type DraftStatus = 'needs_review' | 'validated' | 'confirmed' | 'rejected';

export interface DraftValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  resolved?: { field: 'origin' | 'destination'; name: string; code: string | null; kind: string }[];
}

export interface ShipmentDraft {
  id: string;
  company_id: string;
  project_id: string | null;
  status: DraftStatus;
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  weight_kg: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  wagon_number: string | null;
  reference: string | null;
  confidence: number | null;
  source: string;
  source_email: { from?: string | null; subject?: string | null; body?: string };
  extracted: Record<string, unknown>;
  validation: DraftValidation;
  created_at: string;
  updated_at: string;
}

export interface DemoEmail {
  from: string;
  subject: string;
  body: string;
}

export type UpdateDraftInput = Partial<Pick<ShipmentDraft,
  'origin' | 'destination' | 'cargo_type' | 'weight_kg' | 'pickup_date' | 'delivery_date' | 'wagon_number' | 'reference'>>;

const BASE = '/api/v1/inbox';

export const inboxApi = {
  demoEmails: () => apiFetch<{ emails: DemoEmail[] }>(`${BASE}/demo-emails`).then((r) => r.emails),
  listDrafts: (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return apiFetch<{ drafts: ShipmentDraft[] }>(`${BASE}/drafts${qs}`).then((r) => r.drafts);
  },
  parse: (data: { from?: string; subject?: string; body: string; project_id?: string | null }) =>
    apiFetch<{ draft: ShipmentDraft; demo: boolean }>(`${BASE}/parse`, 'POST', data),
  updateDraft: (id: string, data: UpdateDraftInput) =>
    apiFetch<{ draft: ShipmentDraft }>(`${BASE}/drafts/${id}`, 'PATCH', data).then((r) => r.draft),
  confirmDraft: (id: string) =>
    apiFetch<{ draft: ShipmentDraft }>(`${BASE}/drafts/${id}/confirm`, 'POST').then((r) => r.draft),
  rejectDraft: (id: string) =>
    apiFetch<{ draft: ShipmentDraft }>(`${BASE}/drafts/${id}/reject`, 'POST').then((r) => r.draft),
};
