'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  documentsApi,
  type DocumentSubject,
  type UploadDocumentInput,
} from '@/lib/api/documents.api';

export const docQk = {
  list: (subject: DocumentSubject, subjectId?: string) =>
    ['documents', subject, subjectId ?? 'all'] as const,
};

export function useDocuments(subject: DocumentSubject, subjectId?: string) {
  return useQuery({
    queryKey: docQk.list(subject, subjectId),
    queryFn: () => documentsApi.list({ subject, subjectId }),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => documentsApi.upload(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: docQk.list(vars.subject, vars.subjectId) });
      qc.invalidateQueries({ queryKey: docQk.list(vars.subject) });
    },
  });
}

export function useDeleteDocument(subject: DocumentSubject, subjectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docQk.list(subject, subjectId) });
    },
  });
}
