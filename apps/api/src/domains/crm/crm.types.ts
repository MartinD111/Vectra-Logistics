export interface ClientRecord {
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
  created_at: Date;
  updated_at: Date;
}

export interface ClientProjectLinkRecord {
  id: string;
  company_id: string;
  client_id: string;
  project_id: string;
  override_rate_eur: number | null;
  override_responsible_employee_id: string | null;
  override_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Merged view: override ?? client global default, resolved in the service layer (D-02). */
export interface ResolvedClientProjectView {
  client_id: string;
  project_id: string;
  rate_eur: number | null;
  responsible_employee_id: string | null;
  notes: string | null;
  is_overridden: {
    rate: boolean;
    responsible_employee: boolean;
    notes: boolean;
  };
}
