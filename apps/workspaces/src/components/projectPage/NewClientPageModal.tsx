'use client';

// Picker modal for DET-04: create (or re-open) a client's detail page directly
// from the Notion-like project page creator, not just from the CRM dashboard.
// Search existing clients or quick-create a new one, then get-or-create that
// client's client_pages row (Plan 01's dedupe-safe backend endpoint) and open
// it in a new tab — same same-app new-tab pattern as the CRM dashboard
// (apps/workspaces/src/app/records/page.tsx), NOT crossAppUrl.

import { useMemo, useState } from 'react';
import { Loader2, Search, X, Building2, UserPlus } from 'lucide-react';
import { useClients, useCreateClient } from '@/lib/hooks/useCrm';
import { crmApi } from '@/lib/api/crm.api';

const COUNTRIES = ['SI', 'DE', 'AT', 'IT', 'HR', 'HU', 'FR', 'NL', 'BE', 'PL', 'CZ', 'SK', 'ES', 'RS', 'CH', 'GB', 'TR'];

interface NewClientPageModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewClientPageModal({ open, onClose }: NewClientPageModalProps) {
  const { data: clients, isLoading } = useClients();
  const create = useCreateClient();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');
  const [limit, setLimit] = useState('10000');
  const [rate, setRate] = useState('');

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients ?? [];
    return (clients ?? []).filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  if (!open) return null;

  const reset = () => {
    setSearch('');
    setShowCreate(false);
    setName('');
    setCountry('DE');
    setVatId('');
    setLimit('10000');
    setRate('');
    setOpeningId(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const openClientPage = async (clientId: string) => {
    setOpeningId(clientId);
    setError(null);
    try {
      await crmApi.getClientPage(clientId);
      window.open(`/records/${clientId}`, '_blank', 'noopener,noreferrer');
      handleClose();
    } catch {
      setError("Couldn't open this client's page. Try again.");
      setOpeningId(null);
    }
  };

  const quickCreate = () => {
    if (!name.trim()) return;
    setError(null);
    create.mutate(
      {
        name: name.trim(),
        country,
        vat_id: vatId.trim() || null,
        credit_limit: Number(limit) || 10000,
        default_rate_eur: rate ? Number(rate) : null,
      },
      {
        onSuccess: (newClient) => {
          void openClientPage(newClient.id);
        },
        onError: () => {
          setError("Couldn't create this client. Try again.");
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="saas-card max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Choose a client</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
        )}

        {!showCreate && (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients by name…"
                className="saas-input !py-1.5 text-sm pl-8 w-full"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 mb-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No clients match your search.
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openClientPage(c.id)}
                    disabled={openingId === c.id}
                    className="w-full flex items-center gap-2 rounded-lg border border-gray-100 dark:border-slate-800 px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800/60 disabled:opacity-60"
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300 flex-shrink-0">
                      {c.country}
                    </span>
                    {openingId === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 text-xs font-semibold text-primary-600 hover:bg-gray-50 dark:hover:bg-slate-800/60"
            >
              <UserPlus className="w-3.5 h-3.5" /> Create new client
            </button>
          </>
        )}

        {showCreate && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client name"
                className="saas-input !py-1.5 text-sm col-span-2"
                autoFocus
              />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="saas-input !py-1.5 text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
                placeholder="VAT ID (e.g. DE811907980)"
                className="saas-input !py-1.5 text-sm"
              />
              <input
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                type="number"
                placeholder="Credit limit €"
                className="saas-input !py-1.5 text-sm"
              />
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                type="number"
                placeholder="Default rate € (optional)"
                className="saas-input !py-1.5 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
              >
                Back
              </button>
              <button
                onClick={quickCreate}
                disabled={!name.trim() || create.isPending || openingId !== null}
                className="flex-1 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
              >
                {create.isPending || openingId !== null ? 'Creating…' : 'Create new client'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
