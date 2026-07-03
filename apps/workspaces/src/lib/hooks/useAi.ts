'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  aiApi, completeLocal, type AiConfigPublic, type AiCompleteRequest, type AiCompletion,
} from '@/lib/api/ai.api';

const qk = ['ai', 'config'] as const;

/** Company AI provider config. Admin-only endpoint; enabled once a company is known. */
export function useAiConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk,
    queryFn: aiApi.getConfig,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
    retry: false,
  });
}

export function useSaveAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aiApi.saveConfig,
    onSuccess: (cfg) => {
      qc.setQueryData(qk, cfg);
      qc.invalidateQueries({ queryKey: qk });
    },
  });
}

/**
 * Single completion abstraction used by the generator features. Routes cloud
 * providers (openai/gemini) through the backend proxy (key stays server-side)
 * and local providers straight from the browser to the user's endpoint.
 * Callers don't branch on provider.
 */
export function useAiComplete() {
  const { data: config } = useAiConfig();

  const complete = useCallback(
    async (req: AiCompleteRequest): Promise<AiCompletion> => {
      const cfg: AiConfigPublic | undefined = config;
      if (!cfg) throw new Error('No AI provider configured. Set one in Settings.');
      if (cfg.provider === 'local') {
        if (!cfg.localEndpoint) throw new Error('Local provider has no endpoint configured.');
        return completeLocal(cfg.localEndpoint, cfg.localModel || 'gemma3', req);
      }
      return aiApi.complete(req);
    },
    [config],
  );

  return { complete, config };
}
