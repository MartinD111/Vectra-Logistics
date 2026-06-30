// ── Company ───────────────────────────────────────────────────────────────

export interface CompanyBusinessCard {
  id: string;
  name: string;
  country: string;
  city: string;
  isVerified: boolean;
  fleetSize: number;
  yearsActive: number;
  memberSince: number;
  ratings: CompanyRatingSummaryCore;
  bookingStats: CompanyBookingStats;
}

export interface CompanyVerificationStatus {
  status: string;
  vat_number: string | null;
  registration_number: string | null;
  documents: CompanyDocumentSummary[];
}

export interface CompanyDocumentSummary {
  type: string;
  status: string;
  uploaded_at: Date;
}

export interface CompanyBookingStats {
  total_bookings: string;
  completed: string;
  success_rate: string;
}

export interface CompanyRatingSummaryCore {
  total_reviews: string;
  avg_score: string;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  document_type: string;
  file_url: string;
  uploaded_by: string;
  status: string;
  created_at: Date;
}

// ── Ratings ───────────────────────────────────────────────────────────────

export interface Rating {
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
  created_at: Date;
}

export interface RatingWithReviewer extends Rating {
  reviewer_first_name: string;
  reviewer_last_name: string;
  reviewer_role: string;
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

// ── Documents ─────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  booking_id: string | null;
  document_type: string;
  file_url: string;
  created_by: string;
  created_at: Date;
  // joined fields
  license_plate: string | null;
  driver_name: string | null;
}

export interface DocumentFilters {
  from?: string;
  to?: string;
  license_plate?: string;
  doc_type?: string;
}
