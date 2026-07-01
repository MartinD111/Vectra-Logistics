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

/** What we persist in integration_credentials.credentials_json (encrypt in prod). */
export interface OutlookCredentials {
  demo: boolean;
  email: string | null;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}
