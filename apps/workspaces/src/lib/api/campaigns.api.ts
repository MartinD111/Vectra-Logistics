import { apiFetch } from './client';

export interface EmailCampaign {
  id: string;
  company_id: string;
  project_id: string | null;
  subject: string;
  body_html: string;
  created_at: string;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
}

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  email: string;
  sent_at: string | null;
  send_error: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

export interface EmailCampaignDetail extends EmailCampaign {
  recipients: EmailCampaignRecipient[];
}

export interface CreateCampaignInput {
  project_id?: string | null;
  subject: string;
  body_html: string;
  recipients: string[];
}

const BASE = '/api/v1/campaigns';

export const campaignsApi = {
  list: (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return apiFetch<{ campaigns: EmailCampaign[] }>(`${BASE}${qs}`).then((r) => r.campaigns);
  },
  get: (id: string) => apiFetch<{ campaign: EmailCampaignDetail }>(`${BASE}/${id}`).then((r) => r.campaign),
  create: (data: CreateCampaignInput) =>
    apiFetch<{ campaign: EmailCampaign }>(BASE, 'POST', data).then((r) => r.campaign),
};
