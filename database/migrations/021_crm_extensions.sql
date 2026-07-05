-- Migration: CRM extensions — client detail fields, per-project overrides,
-- email history, and the kpi_results client-subject fix. Apply after 020.
-- Idempotent.
--
-- 1. clients gains address + responsible_employee_id (notes already exists
--    from migration 019 — not touched here).
-- 2. client_project_links — per-project overrides (rate, responsible
--    employee, notes) layered over a client's global defaults. Explicit
--    typed columns (not JSONB), matching the clients/invoices convention.
--    Fallback resolution (override ?? global) happens in the service layer,
--    not via SQL COALESCE.
-- 3. email_messages — synced Outlook metadata for per-client "last 10 emails
--    sent" history (Phase 5 consumer; table lands now so no schema gap).
-- 4. kpi_results.user_id becomes nullable + new client_id column, so a
--    future client-subject credit-risk KPI evaluator (Phase 6) can write a
--    result row scoped to a client instead of a user. A CHECK constraint
--    ensures every row still has exactly one subject (user or client).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsible_employee_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS client_project_links (
    id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id                         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id                        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    override_rate_eur                 NUMERIC(12, 2),
    override_responsible_employee_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    override_notes                    TEXT,
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_project_links_uniq ON client_project_links (client_id, project_id);
CREATE INDEX IF NOT EXISTS client_project_links_project_idx ON client_project_links (project_id);
CREATE INDEX IF NOT EXISTS client_project_links_company_idx ON client_project_links (company_id);

CREATE TABLE IF NOT EXISTS email_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE CASCADE,
  outlook_id       TEXT,
  sender_email     TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  subject          TEXT NOT NULL,
  body_preview     TEXT,
  full_body        TEXT,
  received_at      TIMESTAMPTZ NOT NULL,
  is_draft         BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, outlook_id)
);
CREATE INDEX IF NOT EXISTS email_messages_client_idx
  ON email_messages (company_id, client_id, received_at DESC);

ALTER TABLE kpi_results ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE kpi_results ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kpi_results_subject_check'
  ) THEN
    ALTER TABLE kpi_results ADD CONSTRAINT kpi_results_subject_check
      CHECK (user_id IS NOT NULL OR client_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS kpi_results_client_idx ON kpi_results (client_id, period_start DESC);
