'use client';

// CRM Dashboard: full-page client table replacing CrmClientsBlock's compact
// card style as the primary way to browse clients (D-01). Row click opens
// the client's detail page in a new tab (NAV-02, target route built in
// Plan 03). Search + "over limit only" filter compose client-side (A2).

import { useMemo, useState } from 'react';
import { Loader2, Building2, Plus } from 'lucide-react';
import { useClients } from '@/lib/hooks/useCrm';
import { useTeam } from '@/lib/hooks/useTeam';
import { AddClientModal } from '@/components/projectPage/AddClientModal';
import type { CrmClient } from '@/lib/api/crm.api';

function creditStatus(client: CrmClient) {
  const pct = client.credit_limit > 0
    ? Math.min(100, (client.outstanding_balance / client.credit_limit) * 100)
    : 100;
  const over = client.outstanding_balance >= client.credit_limit;
  const color = over ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return { pct, over, color };
}

export default function RecordsPage() {
  const { data: clients, isLoading } = useClients();
  const { data: team } = useTeam();
  const [search, setSearch] = useState('');
  const [overLimitOnly, setOverLimitOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (team ?? []).forEach((m) => map.set(m.id, `${m.first_name} ${m.last_name}`.trim()));
    return map;
  }, [team]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients ?? []).filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (overLimitOnly && c.outstanding_balance < c.credit_limit) return false;
      return true;
    });
  }, [clients, search, overLimitOnly]);

  const hasClients = (clients?.length ?? 0) > 0;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">CRM Dashboard</h1>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients by name…"
          className="saas-input text-sm"
          style={{ width: 280 }}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overLimitOnly}
            onChange={(e) => setOverLimitOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Over limit only
        </label>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add client
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : !hasClients ? (
        <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
          <Building2 className="w-8 h-8" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No clients yet</p>
          <p className="text-xs text-center max-w-sm">
            Add your first customer to start tracking credit limits and activity.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Add client
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No clients match your search.</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-dark-border text-left">
              <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400">Country</th>
              <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400">Credit status</th>
              <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400">Responsible employee</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => {
              const { pct, color } = creditStatus(client);
              const responsibleName = client.responsible_employee_id
                ? teamNameById.get(client.responsible_employee_id) ?? client.responsible_employee_id
                : null;
              return (
                <tr
                  key={client.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800"
                  onClick={() => window.open(`/records/${client.id}`, '_blank', 'noopener,noreferrer')}
                >
                  <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{client.name}</td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">
                      {client.country}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      {Math.round(pct)}%
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {responsibleName ?? <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
