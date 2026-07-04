-- Migration: email campaigns sent via the connected Outlook mailbox, with
-- per-recipient open tracking (tracking pixel — Graph read receipts only work
-- for recipients inside the same M365 tenant, useless for customer email).
-- Apply after 010. Idempotent.

CREATE TABLE IF NOT EXISTS email_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_campaigns_project_idx ON email_campaigns (company_id, project_id);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  token            TEXT NOT NULL UNIQUE,
  sent_at          TIMESTAMPTZ,
  send_error       TEXT,
  first_opened_at  TIMESTAMPTZ,
  last_opened_at   TIMESTAMPTZ,
  open_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_campaign_recipients_campaign_idx ON email_campaign_recipients (campaign_id);
