// Folders are a tenant-owned, nestable organizational tree. Projects and
// programs (mini programs + automations) can optionally be filed into one.

export interface Folder {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
}
