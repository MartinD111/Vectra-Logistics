// Microsoft 365 / Outlook mail connection (per-company), stored in
// integration_credentials with provider_id = 'outlook'.

export interface OutlookStatus {
  connected: boolean;
  /** The connected mailbox address, when known. */
  email: string | null;
  connected_at: string | null;
  /** True when running without real Microsoft credentials (simulated link). */
  demo: boolean;
}

/** What we persist in integration_credentials.credentials_json — encrypted at rest (secretBox). */
export interface OutlookCredentials {
  demo: boolean;
  email: string | null;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}

/** A calendar event synced from Graph, categorized to a project via its `categories`. */
export interface CalendarEvent {
  id: string;
  company_id: string;
  project_id: string | null;
  external_id: string;
  subject: string | null;
  start_at: Date;
  end_at: Date;
  is_all_day: boolean;
  categories: string[];
  attendee_emails: string[];
  synced_at: Date;
  created_at: Date;
}
