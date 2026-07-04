-- Migration: project pages. Apply after 008. Idempotent.
--
-- A project can have many ordered "pages" (Notion-like docs/dashboards). Page
-- content is a versioned block-document stored in JSONB `config`, mirroring
-- programs.config — the server stores it opaquely; the frontend owns block
-- semantics. `is_default` marks the page shown on the project's Dashboard tab.

CREATE TABLE IF NOT EXISTS project_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Untitled',
  icon         TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  config       JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_pages_project_idx
  ON project_pages (company_id, project_id, sort_order);
