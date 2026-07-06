'use client';

// CRM hooks: client data backed by the dedicated crm API domain
// (apps/api/src/domains/crm), replacing useBilling for CRM/client
// operations. useBilling.ts is kept for invoice/settlement flows only.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  crmApi, type CrmClient, type CreateClientInput, type ClientProjectLink, type LinkProjectInput,
  type UpdateClientPageInput,
} from '@/lib/api/crm.api';

const qk = {
  clients: ['crm-clients'] as const,
  client: (id: string) => ['crm-clients', id] as const,
  projectLinks: (clientId: string) => ['crm-clients', clientId, 'projects'] as const,
  clientPage: (clientId: string) => ['crm-clients', clientId, 'page'] as const,
  clientTimeline: (clientId: string) => ['crm-clients', clientId, 'timeline'] as const,
  clientEmails: (clientId: string) => ['crm-clients', clientId, 'emails'] as const,
};

export function useClients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.clients,
    queryFn: crmApi.listClients,
    enabled: !!user?.company_id,
  });
}

export function useClient(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.client(id),
    queryFn: () => crmApi.getClient(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) => crmApi.createClient(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientInput> }) => crmApi.updateClient(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}

export function useClientProjectLinks(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.projectLinks(clientId),
    queryFn: () => crmApi.listClientProjectLinks(clientId),
    enabled: !!user?.company_id && !!clientId,
  });
}

export function useUpsertClientProjectLink(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkProjectInput) => crmApi.upsertClientProjectLink(clientId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projectLinks(clientId) }),
  });
}

export function useClientPage(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.clientPage(clientId),
    queryFn: () => crmApi.getClientPage(clientId),
    enabled: !!user?.company_id && !!clientId,
  });
}

export function useUpdateClientPage(pageId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateClientPageInput) => crmApi.updateClientPage(pageId, data),
    onSuccess: (page) => qc.setQueryData(qk.clientPage(clientId), page),
  });
}

export function useClientTimeline(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.clientTimeline(clientId),
    queryFn: () => crmApi.getClientTimeline(clientId),
    enabled: !!user?.company_id && !!clientId,
  });
}

export function useClientEmails(clientId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.clientEmails(clientId),
    queryFn: () => crmApi.getClientEmails(clientId),
    enabled: !!user?.company_id && !!clientId,
  });
}
