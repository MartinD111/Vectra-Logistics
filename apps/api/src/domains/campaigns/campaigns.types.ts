// Email campaigns sent through the connected Outlook mailbox, with per-recipient
// open tracking via a tracking pixel (Graph read receipts only cover recipients
// inside the same M365 tenant — useless for external customer email).

export interface EmailCampaign {
  id: string;
  company_id: string;
  project_id: string | null;
  subject: string;
  body_html: string;
  created_by: string | null;
  created_at: Date;
}

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  email: string;
  token: string;
  sent_at: Date | null;
  send_error: string | null;
  first_opened_at: Date | null;
  last_opened_at: Date | null;
  open_count: number;
  created_at: Date;
}

export interface EmailCampaignWithStats extends EmailCampaign {
  recipient_count: number;
  sent_count: number;
  opened_count: number;
}

export interface EmailCampaignDetail extends EmailCampaign {
  recipients: EmailCampaignRecipient[];
}
