import { apiFetch } from './client';

// Document subject — what the document is attached to.
export type DocumentSubject =
  | 'company'        // verification, registration
  | 'driver'         // licence, ADR cert, tachograph card
  | 'vehicle'        // registration, insurance, inspection
  | 'shipment'       // CMR, POD, invoice
  | 'booking';

// Document type taxonomy. Free-form on the backend, but these are the supported
// values the UI recognises.
export type DocumentType =
  | 'registration' | 'insurance' | 'inspection' | 'verification'
  | 'license' | 'adr_certificate' | 'tachograph_card' | 'medical'
  | 'cmr' | 'pod' | 'invoice' | 'photo' | 'other';

export interface DocumentRecord {
  id: string;
  subject: DocumentSubject;
  subject_id: string | null;
  document_type: DocumentType | string;
  file_url: string;
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
  issued_at?: string | null;
  expires_at?: string | null;
  uploaded_by?: string;
  created_at: string;
}

export interface UploadDocumentInput {
  subject: DocumentSubject;
  subjectId?: string;
  documentType: DocumentType | string;
  file: File;
  issuedAt?: string;
  expiresAt?: string;
}

const BASE = '/api/v1/documents';

export const documentsApi = {
  list: (filters?: { subject?: DocumentSubject; subjectId?: string; documentType?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.subject) qs.set('subject', filters.subject);
    if (filters?.subjectId) qs.set('subject_id', filters.subjectId);
    if (filters?.documentType) qs.set('doc_type', filters.documentType);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<DocumentRecord[]>(`${BASE}${suffix}`);
  },

  upload: (input: UploadDocumentInput) => {
    const fd = new FormData();
    fd.append('file', input.file);
    fd.append('subject', input.subject);
    fd.append('document_type', input.documentType);
    if (input.subjectId) fd.append('subject_id', input.subjectId);
    if (input.issuedAt) fd.append('issued_at', input.issuedAt);
    if (input.expiresAt) fd.append('expires_at', input.expiresAt);
    return apiFetch<DocumentRecord>(BASE, 'POST', fd);
  },

  delete: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function isExpired(d: DocumentRecord): boolean {
  if (!d.expires_at) return false;
  return new Date(d.expires_at).getTime() < Date.now();
}

export function expiresWithinDays(d: DocumentRecord, days: number): boolean {
  if (!d.expires_at) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  const diff = new Date(d.expires_at).getTime() - Date.now();
  return diff > 0 && diff < ms;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  inspection: 'Inspection / Technical',
  verification: 'Verification',
  license: 'Driver Licence',
  adr_certificate: 'ADR Certificate',
  tachograph_card: 'Tachograph Card',
  medical: 'Medical Certificate',
  cmr: 'CMR',
  pod: 'Proof of Delivery',
  invoice: 'Invoice',
  photo: 'Photo',
  other: 'Other',
};
