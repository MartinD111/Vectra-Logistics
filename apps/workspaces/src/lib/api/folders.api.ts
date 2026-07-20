import { apiFetch } from './client';

export interface Folder {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
}

// Discriminated-union-shaped node returned by the aggregated tree read
// endpoint (GET /folders/tree/full, Phase 32/TREEAPI-01). `raw` is kept as
// `Record<string, unknown>` on the client — call sites narrow it per
// node_type as needed rather than importing backend row types.
export interface TreeNode {
  node_type: 'folder' | 'project' | 'program' | 'data_collection' | 'project_page';
  id: string;
  company_id: string;
  name: string;
  children: TreeNode[];
  raw: Record<string, unknown>;
}

const BASE = '/api/v1/folders';

export const foldersApi = {
  tree: () => apiFetch<{ folders: FolderTree[] }>(BASE).then((r) => r.folders),
  get: (id: string) => apiFetch<{ folder: Folder }>(`${BASE}/${id}`).then((r) => r.folder),
  create: (data: { name: string; parent_id?: string | null; icon?: string | null; color?: string | null }) =>
    apiFetch<{ folder: Folder }>(BASE, 'POST', data).then((r) => r.folder),
  update: (id: string, data: Partial<{ name: string; icon: string | null; color: string | null }>) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}`, 'PATCH', data).then((r) => r.folder),
  move: (id: string, parentId: string | null) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}/move`, 'PATCH', { parent_id: parentId }).then((r) => r.folder),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
  getFullTree: () => apiFetch<{ tree: TreeNode[] }>(`${BASE}/tree/full`).then((r) => r.tree),
  archive: (id: string) => apiFetch<{ folder: Folder }>(`${BASE}/${id}/archive`, 'POST').then((r) => r.folder),
  unarchive: (id: string) => apiFetch<{ folder: Folder }>(`${BASE}/${id}/unarchive`, 'POST').then((r) => r.folder),
  reorder: (data: {
    node_type: 'folder' | 'project' | 'program' | 'data_collection';
    parent_id: string | null;
    project_id?: string | null;
    ordered_ids: string[];
  }) =>
    apiFetch<{ node_type: string; parent_id: string | null; project_id: string | null; ordered_ids: string[] }>(
      `${BASE}/tree/reorder`,
      'POST',
      data
    ),
  moveNode: (data: {
    node_type: 'folder' | 'project' | 'program' | 'data_collection';
    node_id: string;
    new_parent_id: string | null;
    project_id?: string | null;
  }) => apiFetch<unknown>(`${BASE}/tree/move`, 'POST', data),
};
