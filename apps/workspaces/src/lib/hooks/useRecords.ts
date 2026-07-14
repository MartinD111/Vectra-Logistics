'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  recordsApi, type CollectionPropertyDef, type UpdateRecordInput, type CreateRecordInput,
} from '@/lib/api/records.api';

const qk = {
  collection: (id: string) => ['records-collection', id] as const,
  record: (id: string) => ['records-record', id] as const,
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
