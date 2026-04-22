import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompanyBusinessCard {
  id: string;
  name: string;
  country: string;
  city: string;
  isVerified: boolean;
  fleetSize: number;
  yearsActive: number;
  memberSince: number;
  ratings: { total_reviews: string; avg_score: string };
  bookingStats: { total_bookings: string; completed: string; success_rate: string };
}

export interface CompanyVerificationStatus {
  status: string;
  vat_number: string | null;
  registration_number: string | null;
  documents: Array<{ type: string; status: string; uploaded_at: string }>;
}

export interface RatingSummary {
  total_reviews: string;
  avg_score: string;
  avg_delivery_punctuality: string | null;
  avg_cargo_condition: string | null;
  avg_communication: string | null;
  avg_payment_speed: string | null;
  avg_loading_conditions: string | null;
  avg_shipment_accuracy: string | null;
  total_bookings: string;
  completed_bookings: string;
  success_rate: string;
  _note?: string;
}

export interface RatingWithReviewer {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  score: number;
  comment: string | null;
  delivery_punctuality: number | null;
  cargo_condition: number | null;
  communication: number | null;
  payment_speed: number | null;
  loading_conditions: number | null;
  shipment_accuracy: number | null;
  created_at: string;
  reviewer_first_name: string;
  reviewer_last_name: string;
  reviewer_role: string;
}

export interface Document {
  id: string;
  booking_id: string | null;
  document_type: string;
  file_url: string;
  created_by: string;
  created_at: string;
  license_plate: string | null;
  driver_name: string | null;
}

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface SubmitRatingDto {
  booking_id: string;
  reviewee_id: string;
  score: number;
  comment?: string;
  delivery_punctuality?: number;
  cargo_condition?: number;
  communication?: number;
  payment_speed?: number;
  loading_conditions?: number;
  shipment_accuracy?: number;
}

export interface DocumentFilters {
  from?: string;
  to?: string;
  license_plate?: string;
  doc_type?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/workspace';

export const workspaceApi = {
  // Company
  getBusinessCard: (companyId: string) =>
    api.get<CompanyBusinessCard>(`${BASE}/company/${companyId}/business-card`),

  getVerificationStatus: () =>
    api.get<CompanyVerificationStatus>(`${BASE}/company/verification/status`),

  submitVerification: (formData: FormData) =>
    api.upload<CompanyVerificationStatus>(`${BASE}/company/verification/submit`, formData),

  // Ratings
  getRatingSummary: (companyId: string) =>
    api.get<RatingSummary>(`${BASE}/ratings/${companyId}/summary`),

  getRatingsByCompany: (companyId: string) =>
    api.get<RatingWithReviewer[]>(`${BASE}/ratings/${companyId}`),

  submitRating: (dto: SubmitRatingDto) =>
    api.post<{ message: string }>(`${BASE}/ratings`, dto),

  // Documents
  getDocuments: (filters?: DocumentFilters) => {
    const params = new URLSearchParams();
    if (filters?.from)          params.set('from', filters.from);
    if (filters?.to)            params.set('to', filters.to);
    if (filters?.license_plate) params.set('license_plate', filters.license_plate);
    if (filters?.doc_type)      params.set('doc_type', filters.doc_type);
    const qs = params.toString();
    return api.get<Document[]>(`${BASE}/documents${qs ? `?${qs}` : ''}`);
  },

  uploadDocument: (formData: FormData) =>
    api.upload<Document>(`${BASE}/documents`, formData),
};
