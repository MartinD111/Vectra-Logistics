'use client';

// LTL matching hooks: the live "empty space" suggestion board. A scan asks the
// FastAPI engine for profitable insertions; each is pushed over the company
// room (ltl:suggestion) so the dispatcher sees matches appear silently.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, type LtlSuggestionEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import { ltlApi, type LtlSuggestion } from '@/lib/api/ltl.api';

const qk = { suggestions: ['ltl-suggestions'] as const };

export function useLtlSuggestions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.suggestions,
    queryFn: ltlApi.listSuggestions,
    enabled: !!user?.company_id,
  });

  useSocketEvent<LtlSuggestionEvent>('ltl:suggestion', (s) => {
    qc.setQueryData<LtlSuggestion[]>(qk.suggestions, (prev) => {
      const next = (prev ?? []).filter((x) => x.id !== s.id && x.partial_load_id !== s.partial_load_id);
      return [s as unknown as LtlSuggestion, ...next].sort((a, b) => b.margin_eur - a.margin_eur);
    });
  });
  useSocketEvent<LtlSuggestionEvent>('ltl:updated', (s) => {
    qc.setQueryData<LtlSuggestion[]>(qk.suggestions, (prev) =>
      (prev ?? []).filter((x) => x.id !== s.id)); // accepted/dismissed leave the board
  });

  return query;
}

export function useLtlScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ltlApi.scan(),
    onSuccess: (list) => qc.setQueryData(qk.suggestions, list),
  });
}

export function useAcceptLtl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ltlApi.accept(id),
    onSuccess: (s) => qc.setQueryData<LtlSuggestion[]>(qk.suggestions, (prev) => (prev ?? []).filter((x) => x.id !== s.id)),
  });
}

export function useDismissLtl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ltlApi.dismiss(id),
    onSuccess: (s) => qc.setQueryData<LtlSuggestion[]>(qk.suggestions, (prev) => (prev ?? []).filter((x) => x.id !== s.id)),
  });
}
