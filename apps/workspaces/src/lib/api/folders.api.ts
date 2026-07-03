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
};
