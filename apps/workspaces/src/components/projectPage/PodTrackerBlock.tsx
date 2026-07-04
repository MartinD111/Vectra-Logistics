'use client';

// POD tracker block: the live proof-of-delivery board. Dispatchers request a
// POD (or a geofence arrival auto-creates one), get a single-use driver link to
// copy/send, and watch requests flip to "Delivered" with the driver's photo the
// moment it's uploaded (socket pod:delivered). The driver page lives in the CMR
// app at /pod/<token>.

import { useState } from 'react';
import { crossAppUrl } from '@vectra/ui';
import { Loader2, PackageCheck, ScanLine, Copy, Check, Camera, Clock } from 'lucide-react';
import type { PodTrackerBlock as PodTrackerBlockType } from '@/lib/projectPage/blocks';
import { usePodRequests, useCreatePodRequest, useSimulateArrival } from '@/lib/hooks/usePod';
import { useClients } from '@/lib/hooks/useBilling';
import type { PodRequest } from '@/lib/api/pod.api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function driverLink(token: string): string {
  return crossAppUrl('cmr', `/pod/${token}`);
}

export function PodTrackerView({ block }: { block: PodTrackerBlockType }) {
  const { data: requests, isLoading } = usePodRequests();
  const { data: clients } = useClients();
  const create = useCreatePodRequest();
  const simulate = useSimulateArrival();
  const [label, setLabel] = useState('');
  const [clientId, setClientId] = useState('');
  const [rate, setRate] = useState('');
  const [showForm, setShowForm] = useState(false);

  const pending = (requests ?? []).filter((r) => r.status === 'pending');
  const delivered = (requests ?? []).filter((r) => r.status === 'delivered');

  const submit = () => {
    if (!label.trim()) return;
    create.mutate({
      label: label.trim(),
      client_id: clientId || null,
      agreed_rate_eur: rate ? Number(rate) : null,
    }, {
      onSuccess: () => { setLabel(''); setRate(''); setShowForm(false); },
    });
  };

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <PackageCheck className="w-4 h-4 text-gray-400" /> {block.title || 'Proof of delivery'}
        </h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => simulate.mutate()} disabled={simulate.isPending}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-60"
            title="Simulate a truck entering the destination geofence — auto-creates a POD request.">
            {simulate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />} Simulate arrival
          </button>
          <button onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            + Request
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-3 space-y-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Delivery label, e.g. Load BRK-4471 → Munich" className="saas-input !py-1.5 text-sm w-full" />
          <div className="flex items-center gap-1.5">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="saas-input !py-1.5 text-sm flex-1" title="Bill this client — credit limit is checked on assignment.">
              <option value="">No client (no invoice)</option>
              {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
            </select>
            <input value={rate} onChange={(e) => setRate(e.target.value)} type="number"
              placeholder="Rate €" className="saas-input !py-1.5 text-sm w-24" />
            <button onClick={submit} disabled={!label.trim() || create.isPending}
              className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">Create</button>
          </div>
          {create.isError && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{(create.error as Error)?.message ?? 'Could not create the request.'}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (requests ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <PackageCheck className="w-6 h-6" />
          <p className="text-xs">No POD requests yet. &ldquo;Simulate arrival&rdquo; to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Column title="Awaiting upload" count={pending.length} accent="text-amber-600">
            {pending.map((r) => <PendingCard key={r.id} req={r} />)}
          </Column>
          <Column title="Delivered" count={delivered.length} accent="text-emerald-600">
            {delivered.map((r) => <DeliveredCard key={r.id} req={r} />)}
          </Column>
        </div>
      )}
    </div>
  );
}

function Column({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{title}</span>
        <span className="text-[10px] text-gray-400">{count}</span>
      </div>
      <div className="space-y-1.5">{children}{count === 0 && <p className="text-[11px] text-gray-400 px-1 py-2">Empty</p>}</div>
    </div>
  );
}

function PendingCard({ req }: { req: PodRequest }) {
  const [copied, setCopied] = useState(false);
  const link = driverLink(req.token);
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{req.label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> awaiting driver photo</p>
      <div className="flex items-center gap-1 mt-1.5">
        <a href={link} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:underline">
          <Camera className="w-3 h-3" /> Open driver link
        </a>
        <button onClick={copy} className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-600 ml-auto">
          {copied ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
    </div>
  );
}

function DeliveredCard({ req }: { req: PodRequest }) {
  const src = req.pod_url ? `${API_ORIGIN}${req.pod_url}` : null;
  return (
    <div className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Proof of delivery" className="w-full h-24 object-cover" />
      )}
      <div className="px-2.5 py-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{req.label}</p>
        <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
          <Check className="w-3 h-3" /> Delivered{req.delivered_at ? ` · ${new Date(req.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
      </div>
    </div>
  );
}
