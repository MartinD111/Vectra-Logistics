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
