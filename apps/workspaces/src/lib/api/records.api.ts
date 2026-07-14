import { apiFetch } from './client';

export interface CollectionPropertyDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'checkbox'
    | 'person' | 'url' | 'email' | 'phone' | 'files' | 'relation';
  options?: { id: string; label: string }[];
  [key: string]: unknown;
}

export interface DataCollection {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  schema: CollectionPropertyDef[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionRecord {
  id: string;
  company_id: string;
  collection_id: string;
  parent_record_id: string | null;
  props: Record<string, unknown>;
  body: Record<string, unknown>;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateCollectionInput {
  schema?: CollectionPropertyDef[];
  name?: string;
}

export interface UpdateRecordInput {
  props?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface CreateRecordInput {
  props?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

const BASE = '/api/v1/records';

export const recordsApi = {
  getCollection: (id: string) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`).then((r) => r.collection),
  updateCollection: (id: string, data: UpdateCollectionInput) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`, 'PATCH', data).then((r) => r.collection),
  getRecord: (id: string) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`).then((r) => r.record),
  updateRecord: (id: string, data: UpdateRecordInput) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`, 'PATCH', data).then((r) => r.record),
  createRecord: (collectionId: string, data: CreateRecordInput) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/collections/${collectionId}/records`, 'POST', data).then((r) => r.record),
};
