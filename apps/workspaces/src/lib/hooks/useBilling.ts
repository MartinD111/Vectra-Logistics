'use client';

// Billing hooks: CRM clients (credit limits), the Smart-VAT evaluator, and the
// live invoice board (invoice:new pushes when a POD upload auto-drafts one).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, type InvoiceEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import { billingApi, type CrmClient, type Invoice, type CreateClientInput } from '@/lib/api/billing.api';

const qk = {
  clients: ['billing-clients'] as const,
  invoices: ['billing-invoices'] as const,
};

export function useClients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.clients,
    queryFn: billingApi.listClients,
    enabled: !!user?.company_id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) => billingApi.createClient(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientInput> }) => billingApi.updateClient(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}

export function useEvaluateVat() {
  return useMutation({
    mutationFn: (data: { client_country: string; client_vat_id?: string | null }) => billingApi.evaluateVat(data),
  });
}

export function useInvoices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.invoices,
    queryFn: billingApi.listInvoices,
    enabled: !!user?.company_id,
  });

  const upsert = (inv: Invoice) => {
    qc.setQueryData<Invoice[]>(qk.invoices, (prev) => [inv, ...(prev ?? []).filter((i) => i.id !== inv.id)]);
    // Approve/pay moves the client balance — refresh the CRM view too.
    qc.invalidateQueries({ queryKey: qk.clients });
  };
  useSocketEvent<InvoiceEvent>('invoice:new', (i) => upsert(i as unknown as Invoice));
  useSocketEvent<InvoiceEvent>('invoice:updated', (i) => upsert(i as unknown as Invoice));

  return query;
}

export function useApproveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.approveInvoice(id),
    onSuccess: (inv) => {
      qc.setQueryData<Invoice[]>(qk.invoices, (prev) => [inv, ...(prev ?? []).filter((i) => i.id !== inv.id)]);
      qc.invalidateQueries({ queryKey: qk.clients });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.markPaid(id),
    onSuccess: (inv) => {
      qc.setQueryData<Invoice[]>(qk.invoices, (prev) => [inv, ...(prev ?? []).filter((i) => i.id !== inv.id)]);
      qc.invalidateQueries({ queryKey: qk.clients });
    },
  });
}
