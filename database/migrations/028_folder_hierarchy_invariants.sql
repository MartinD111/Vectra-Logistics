-- Migration: Folder hierarchy invariants. Apply after 027. Idempotent.
--
-- Gives the folder/project/program/data_collection/project_page hierarchy a
-- tenant-safe, cycle-safe, archive-capable schema:
--   - data_collections.folder_id lets a collection be filed into a folder.
--   - Composite (id, company_id) FK invariants across the tree so no row can
--     ever be reparented into a different tenant's node, independent of
--     which code path performs the write.
--   - A BEFORE INSERT/UPDATE trigger on folders rejecting parent-pointer
--     cycles and nesting deeper than 3 levels.
--   - archived_at columns on folders/projects/programs/data_collections/
--     project_pages for the cascade-archive feature built in later plans.
--   - folders.ancestor_ids (GIN-indexed) so a folder's full ancestor chain
--     is a single indexed lookup instead of a per-request recursive walk.
--
-- Per Pitfall 2 (RESEARCH.md): data_collections only gets an ADDED
-- folder_id/archived_at here — project_id and schema are locked in
-- docs/specs/core/workspace-blocks.md §3.3 and are never touched.

-- ── Task 1: additive columns, indexes, ancestor_ids backfill ───────────────

ALTER TABLE folders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS ancestor_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS folders_ancestor_ids_gin_idx ON folders USING GIN (ancestor_ids);

-- folder_id added without its FK here — the composite (id, company_id)
-- unique constraint it depends on is created in Task 2 below. The FK
-- constraint itself is added in Task 2 alongside the other composite FKs.
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS folder_id UUID;
CREATE INDEX IF NOT EXISTS data_collections_folder_idx ON data_collections (folder_id);

-- One-time backfill of ancestor_ids for every existing folder row. This is a
-- one-time DO block, not a per-request query path, so the WITH RECURSIVE use
-- here is not the anti-pattern RESEARCH.md warns against.
DO $$
DECLARE
  rec RECORD;
  computed_depth INTEGER;
BEGIN
  FOR rec IN
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, ARRAY[]::UUID[] AS chain_ids
      FROM folders
      WHERE parent_id IS NULL
      UNION ALL
      SELECT f.id, f.parent_id, c.chain_ids || f.parent_id
      FROM folders f
      JOIN chain c ON f.parent_id = c.id
    )
    SELECT id, chain_ids FROM chain
  LOOP
    UPDATE folders SET ancestor_ids = rec.chain_ids WHERE id = rec.id;

    computed_depth := COALESCE(array_length(rec.chain_ids, 1), 0) + 1;
    IF computed_depth > 3 THEN
      RAISE NOTICE 'Folder % exceeds depth 3 after backfill (pre-existing, not truncated): %', rec.id, computed_depth;
    END IF;
  END LOOP;
END $$;

-- ── Task 2: composite (id, company_id) FK invariants + cycle/depth trigger ─

-- Composite UNIQUE (id, company_id) — only on tables whose id is referenced
-- as a parent-pointer target elsewhere in this hierarchy.
DO $$ BEGIN
  ALTER TABLE folders ADD CONSTRAINT folders_id_company_uniq UNIQUE (id, company_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_id_company_uniq UNIQUE (id, company_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE project_pages ADD CONSTRAINT project_pages_id_company_uniq UNIQUE (id, company_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- folders.parent_id -> folders (id, company_id), ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_parent_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE folders
  ADD CONSTRAINT folders_parent_id_company_fkey
  FOREIGN KEY (parent_id, company_id) REFERENCES folders (id, company_id) ON DELETE CASCADE;

-- projects.folder_id -> folders (id, company_id), ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_folder_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE projects
  ADD CONSTRAINT projects_folder_id_company_fkey
  FOREIGN KEY (folder_id, company_id) REFERENCES folders (id, company_id) ON DELETE SET NULL;

-- programs.folder_id -> folders (id, company_id), ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_folder_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE programs
  ADD CONSTRAINT programs_folder_id_company_fkey
  FOREIGN KEY (folder_id, company_id) REFERENCES folders (id, company_id) ON DELETE SET NULL;

-- programs.project_id -> projects (id, company_id), ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_project_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE programs
  ADD CONSTRAINT programs_project_id_company_fkey
  FOREIGN KEY (project_id, company_id) REFERENCES projects (id, company_id) ON DELETE SET NULL;

-- project_pages.project_id -> projects (id, company_id), ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE project_pages DROP CONSTRAINT IF EXISTS project_pages_project_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE project_pages
  ADD CONSTRAINT project_pages_project_id_company_fkey
  FOREIGN KEY (project_id, company_id) REFERENCES projects (id, company_id) ON DELETE CASCADE;

-- project_pages.parent_page_id -> project_pages (id, company_id), ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE project_pages DROP CONSTRAINT IF EXISTS project_pages_parent_page_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE project_pages
  ADD CONSTRAINT project_pages_parent_page_id_company_fkey
  FOREIGN KEY (parent_page_id, company_id) REFERENCES project_pages (id, company_id) ON DELETE CASCADE;

-- data_collections.folder_id -> folders (id, company_id), ON DELETE SET NULL
-- (new column, no existing constraint to drop)
DO $$ BEGIN
  ALTER TABLE data_collections
    ADD CONSTRAINT data_collections_folder_id_company_fkey
    FOREIGN KEY (folder_id, company_id) REFERENCES folders (id, company_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- data_collections.project_id -> projects (id, company_id), ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE data_collections DROP CONSTRAINT IF EXISTS data_collections_project_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE data_collections
  ADD CONSTRAINT data_collections_project_id_company_fkey
  FOREIGN KEY (project_id, company_id) REFERENCES projects (id, company_id) ON DELETE SET NULL;

-- Cycle + depth trigger on folders. Top-level folder = depth 1.
CREATE OR REPLACE FUNCTION folders_prevent_cycle_and_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_ancestors UUID[];
  new_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Folder cannot be its own parent' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ancestor_ids INTO parent_ancestors FROM folders WHERE id = NEW.parent_id;

  IF NEW.id = ANY(parent_ancestors) THEN
    RAISE EXCEPTION 'Cannot move a folder into its own descendant' USING ERRCODE = 'check_violation';
  END IF;

  new_depth := COALESCE(array_length(parent_ancestors, 1), 0) + 1 + 1;
  IF new_depth > 3 THEN
    RAISE EXCEPTION 'Folder nesting cannot exceed depth 3' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS folders_prevent_cycle_and_depth_trg ON folders;

CREATE TRIGGER folders_prevent_cycle_and_depth_trg
  BEFORE INSERT OR UPDATE OF parent_id ON folders
  FOR EACH ROW EXECUTE FUNCTION folders_prevent_cycle_and_depth();
