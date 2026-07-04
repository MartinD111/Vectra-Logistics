-- Migration: nested project pages (Notion-style sub-pages). Apply after 011.
-- Idempotent.

ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS parent_page_id UUID REFERENCES project_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS project_pages_parent_idx ON project_pages (parent_page_id, sort_order);
