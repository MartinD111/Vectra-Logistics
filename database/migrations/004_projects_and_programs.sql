-- Migration: Projects + Programs. Apply after 003. Idempotent.
--
-- Projects are tenant-owned containers a user creates to organize their
-- programs and get automatic per-project statistics. The activity_events event
-- spine already carries project_id (migration 003), so per-project stats are a
-- read over that log — no per-project counters to maintain.
--
-- Programs are the units a user builds (source → map → transform → output). The
-- full visual builder lands later; this table is the persistence + project
-- linkage foundation. `config` holds the program definition as generic JSON —
-- no industry-specific columns (CLAUDE.md §1).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,                       -- hex, for nav/badge accent
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_company_idx ON projects (company_id, created_at DESC);

-- ── Programs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,  -- nullable: unassigned
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'transform',  -- generic: transform|document|import|dashboard
  status      TEXT NOT NULL DEFAULT 'draft',       -- draft|published
  config      JSONB NOT NULL DEFAULT '{}',         -- program definition (builder output)
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS programs_company_idx ON programs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS programs_project_idx ON programs (project_id);
