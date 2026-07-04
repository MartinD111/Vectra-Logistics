'use client';

// CRM clients block: the tenant's customers with credit-limit guardrails. Each
// row shows outstanding balance vs credit limit as a utilisation bar — the
// same numbers the backend uses to 403 an over-limit assignment.

import { useState } from 'react';
import { Loader2, Building2, Plus, AlertTriangle } from 'lucide-react';
import type { CrmClientsBlock as CrmClientsBlockType } from '@/lib/projectPage/blocks';
import { useClients, useCreateClient } from '@/lib/hooks/useBilling';
import type { CrmClient } from '@/lib/api/billing.api';

const COUNTRIES = ['SI', 'DE', 'AT', 'IT', 'HR', 'HU', 'FR', 'NL', 'BE', 'PL', 'CZ', 'SK', 'ES', 'RS', 'CH', 'GB', 'TR'];

const eur = (n: number) => `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function CreditBar({ client }: { client: CrmClient }) {
  const pct = client.credit_limit > 0 ? Math.min(100, (client.outstanding_balance / client.credit_limit) * 100) : 100;
  const over = client.outstanding_balance >= client.credit_limit;
  const color = over ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
        <span>{eur(client.outstanding_balance)} outstanding</span>
        <span>limit {eur(client.credit_limit)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {over && (
        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Over limit — new loads are blocked
        </p>
      )}
    </div>
  );
}

export function CrmClientsView({ block }: { block: CrmClientsBlockType }) {
  const { data: clients, isLoading } = useClients();
  const create = useCreateClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');
  const [limit, setLimit] = useState('10000');
  const [rate, setRate] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(), country,
      vat_id: vatId.trim() || null,
      credit_limit: Number(limit) || 10000,
      default_rate_eur: rate ? Number(rate) : null,
    });
    setName(''); setVatId(''); setShowForm(false);
  };

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-gray-400" /> {block.title || 'Clients'}
          {(clients?.length ?? 0) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">{clients!.length}</span>
          )}
        </h3>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
          <Plus className="w-3.5 h-3.5" /> Client
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-100 dark:border-slate-800 p-2.5 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" className="saas-input !py-1.5 text-sm col-span-2" />
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="saas-input !py-1.5 text-sm">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder="VAT ID (e.g. DE811907980)" className="saas-input !py-1.5 text-sm" />
            <input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" placeholder="Credit limit €" className="saas-input !py-1.5 text-sm" />
            <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" placeholder="Default rate € (optional)" className="saas-input !py-1.5 text-sm" />
          </div>
          <button onClick={submit} disabled={!name.trim() || create.isPending}
            className="w-full py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
            {create.isPending ? 'Adding…' : 'Add client'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (clients ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Building2 className="w-6 h-6" />
          <p className="text-xs">No clients yet. Add your first customer.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {(clients ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 dark:border-slate-800 px-2.5 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">{c.country}</span>
                {c.vat_id && <span className="text-[10px] text-gray-400 font-mono truncate">{c.vat_id}</span>}
                {c.default_rate_eur != null && <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{eur(c.default_rate_eur)}/load</span>}
              </div>
              <CreditBar client={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
