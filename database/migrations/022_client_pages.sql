-- Migration: client pages. Apply after 021. Idempotent.
--
-- Client detail pages reuse the Notion-like block-canvas pattern from
-- project_pages (migration 009), but scoped to a single client instead of a
-- project hierarchy. One page per client (D-05/D-06) — no parent_page_id,
-- is_default, or sort_order columns, since there is no page hierarchy to
-- navigate here, unlike project_pages. The unique index on client_id is the
-- mechanism that enforces "one page per client" and backs the get-or-create
-- dedupe semantics in crm.repository.ts (ON CONFLICT (client_id)).

CREATE TABLE IF NOT EXISTS client_pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'Untitled',
  icon             TEXT,
  config           JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  cover_image_url  TEXT,
  header_settings  JSONB NOT NULL DEFAULT '{}',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_pages_client_uniq ON client_pages (client_id);
CREATE INDEX IF NOT EXISTS client_pages_company_idx ON client_pages (company_id);
