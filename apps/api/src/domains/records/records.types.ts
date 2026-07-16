export interface CollectionPropertyDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'checkbox'
    | 'person' | 'url' | 'email' | 'phone' | 'files' | 'relation';
  [key: string]: unknown;
}

export interface DataCollectionRow {
  id: string;
  company_id: string;
  project_id: string | null;
  folder_id: string | null;
  name: string;
  schema: CollectionPropertyDef[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

export interface CollectionRecordRow {
  id: string;
  company_id: string;
  collection_id: string;
  parent_record_id: string | null;
  props: Record<string, unknown>;
  body: Record<string, unknown>;
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CollectionViewRow {
  id: string;
  company_id: string;
  collection_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sort_order: number;
  created_at: Date;
}
