-- Migration: Records + Views data model. Apply after 024. Idempotent.
--
-- Three new tables that back the Records+Views database engine:
--   - data_collections: a schema-defined collection (like a database in
--     Notion), scoped to a company and optionally attached to a project.
--   - collection_records: individual records inside a collection. Each
--     record has typed `props` (per the collection's schema) plus a
--     Notion-like page `body` (version+blocks envelope, matching
--     project_pages.config), so a record can also be opened as a full page.
--   - collection_views: saved view configurations (board/table/calendar/
--     gallery/list/timeline) over a collection's records.
--
-- Schema is locked in docs/specs/core/workspace-blocks.md §3.3 — do not
-- redesign. `project_id` on data_collections stays a nullable FK per D-01:
-- included in the schema but not referenced by any DTO/API in this phase
-- (project-scoped collections are a later phase's concern).

CREATE TABLE IF NOT EXISTS data_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  parent_record_id UUID REFERENCES collection_records(id) ON DELETE CASCADE,
  props JSONB NOT NULL DEFAULT '{}',
  body JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collection_records_coll_idx ON collection_records (collection_id, sort_order);
CREATE INDEX IF NOT EXISTS collection_records_parent_idx ON collection_records (parent_record_id);

CREATE TABLE IF NOT EXISTS collection_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'board',
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
