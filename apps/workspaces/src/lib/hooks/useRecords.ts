'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  recordsApi, type CollectionPropertyDef, type UpdateRecordInput, type CreateRecordInput,
  type CollectionRecord, type CreateCollectionInput, type CreateViewInput,
} from '@/lib/api/records.api';

const qk = {
  collection: (id: string) => ['records-collection', id] as const,
  record: (id: string) => ['records-record', id] as const,
  collections: () => ['records-collections'] as const,
  records: (collectionId: string) => ['records-list', collectionId] as const,
  views: (collectionId: string) => ['records-views', collectionId] as const,
  view: (id: string) => ['records-view', id] as const,
};

export function useCollection(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.collection(id),
    queryFn: () => recordsApi.getCollection(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useRecord(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.record(id),
    queryFn: () => recordsApi.getRecord(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useUpdateCollectionSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schema: CollectionPropertyDef[]) => recordsApi.updateCollection(id, { schema }),
    onSuccess: (collection) => qc.setQueryData(qk.collection(id), collection),
  });
}

export function useUpdateRecord(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateRecordInput) => recordsApi.updateRecord(id, data),
    onSuccess: (record) => qc.setQueryData(qk.record(id), record),
  });
}

export function useCreateRecord(collectionId: string) {
  return useMutation({
    mutationFn: (data: CreateRecordInput) => recordsApi.createRecord(collectionId, data),
  });
}

export function useCollections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.collections(),
    queryFn: () => recordsApi.listCollections(),
    enabled: !!user?.company_id,
  });
}

export function useRecords(collectionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.records(collectionId),
    queryFn: () => recordsApi.listRecords(collectionId),
    enabled: !!user?.company_id && !!collectionId,
  });
}

export function useViews(collectionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.views(collectionId),
    queryFn: () => recordsApi.listViews(collectionId),
    enabled: !!user?.company_id && !!collectionId,
  });
}

export function useView(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.view(id),
    queryFn: () => recordsApi.getView(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: (data: CreateCollectionInput) => recordsApi.createCollection(data),
  });
}

export function useCreateView(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateViewInput) => recordsApi.createView(collectionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.views(collectionId) }),
  });
}

export function useUpdateAnyRecord(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecordInput }) => recordsApi.updateRecord(id, data),
    onSuccess: (updated, variables) => {
      qc.setQueryData(qk.record(variables.id), updated);
      qc.setQueryData(qk.records(collectionId), (prev: CollectionRecord[] | undefined) =>
        prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev);
    },
  });
}
