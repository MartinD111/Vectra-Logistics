-- Migration: Folders. Apply after 005. Idempotent.
--
-- Folders are a tenant-owned, nestable organizational tree. Projects and
-- programs (mini programs + automations, both rows in `programs`) can
-- optionally be filed into a folder. Deleting a folder does NOT cascade to
-- its contents — projects/programs just fall back to unfiled (folder_id
-- NULL); only empty folder rows disappear along with their subfolders.

CREATE TABLE IF NOT EXISTS folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,                       -- lucide icon name string
  color       TEXT,                       -- hex, for nav/badge accent
  sort_order  INT NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS folders_company_idx ON folders (company_id, parent_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_folder_idx ON projects (folder_id);
CREATE INDEX IF NOT EXISTS programs_folder_idx ON programs (folder_id);
