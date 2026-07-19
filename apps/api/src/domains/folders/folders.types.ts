// Folders are a tenant-owned, nestable organizational tree. Projects and
// programs (mini programs + automations) can optionally be filed into one.

import type { Project, Program, ProjectPage } from '../projects/projects.types';
import type { DataCollectionRow } from '../records/records.types';

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
  ancestor_ids: string[];
  archived_at: Date | null;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
}

// Discriminated-union-shaped node returned by the aggregated tree read
// endpoint (TREEAPI-01). `name` is populated from `name` for
// folder/project/program/data_collection, or from `title` for project_page.
// `raw` holds the original row untouched for callers needing node-type-
// specific fields.
export interface TreeNode {
  node_type: 'folder' | 'project' | 'program' | 'data_collection' | 'project_page';
  id: string;
  company_id: string;
  name: string;
  children: TreeNode[];
  raw: Folder | Project | Program | ProjectPage | DataCollectionRow;
}
