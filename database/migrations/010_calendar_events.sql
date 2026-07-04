-- Migration: calendar events synced from Outlook/Microsoft 365. Apply after 009.
-- Idempotent.
--
-- One connected mailbox per company (see outlook.repository). Events are
-- categorized to a project by matching a Graph event's `categories` against
-- project names (case-insensitive) — the Outlook-side equivalent of tagging a
-- meeting with a project label. Uncategorized events are kept (project_id
-- NULL) so future categorization logic can run without re-syncing.

CREATE TABLE IF NOT EXISTS calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  external_id   TEXT NOT NULL,           -- Microsoft Graph event id
  subject       TEXT,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  is_all_day    BOOLEAN NOT NULL DEFAULT FALSE,
  categories    TEXT[] NOT NULL DEFAULT '{}',
  attendee_emails TEXT[] NOT NULL DEFAULT '{}',
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_project_idx
  ON calendar_events (company_id, project_id, start_at);
