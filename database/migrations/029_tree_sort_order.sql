-- Migration: Tree node sort_order columns. Apply after 028. Idempotent.
--
-- folders and project_pages already have a sort_order column
-- (006_folders.sql, 009_project_pages.sql), but projects, programs, and
-- data_collections do not. This migration adds sort_order to those three
-- tables additively so the TREEAPI-02 sibling reorder endpoint can cover
-- every node type the TREEAPI-01 aggregated tree endpoint exposes, not just
-- folders and pages.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS projects_folder_sort_idx ON projects (folder_id, sort_order);
CREATE INDEX IF NOT EXISTS programs_parent_sort_idx ON programs (folder_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS data_collections_folder_sort_idx ON data_collections (folder_id, sort_order);
