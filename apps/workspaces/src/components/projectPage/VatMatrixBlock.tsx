'use client';

// Smart VAT matrix block: origin (supplier) is the tenant's country; enter the
// client's country + VAT ID and the engine decides — standard VAT, 0% export,
// or EU reverse charge — with the legal note used on invoices.

import { useState } from 'react';
import { Loader2, Percent, BadgeCheck, BadgeX } from 'lucide-react';
import type { VatMatrixBlock as VatMatrixBlockType } from '@/lib/projectPage/blocks';
import { useEvaluateVat } from '@/lib/hooks/useBilling';
import type { VatTreatment } from '@/lib/api/billing.api';

const COUNTRIES = ['SI', 'DE', 'AT', 'IT', 'HR', 'HU', 'FR', 'NL', 'BE', 'PL', 'CZ', 'SK', 'ES', 'RS', 'CH', 'GB', 'TR'];

const TREATMENT_STYLE: Record<VatTreatment, { label: string; cls: string }> = {
  standard: { label: 'Standard VAT', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  reverse_charge: { label: 'EU Reverse Charge', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  export_zero: { label: '0% Export', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export function VatMatrixView({ block }: { block: VatMatrixBlockType }) {
  const evaluate = useEvaluateVat();
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');

  const result = evaluate.data;

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <Percent className="w-4 h-4 text-gray-400" /> {block.title || 'Smart VAT'}
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-xs">Client country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="saas-input !py-2 text-sm">
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">Client VAT ID</label>
          <input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder="e.g. DE811907980"
            className="saas-input !py-2 text-sm" />
        </div>
      </div>

      <button onClick={() => evaluate.mutate({ client_country: country, client_vat_id: vatId || null })}
        disabled={evaluate.isPending}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {evaluate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Percent className="w-4 h-4" />} Evaluate
      </button>

      {result && (
        <div className="mt-3 rounded-lg border border-gray-100 dark:border-slate-800 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TREATMENT_STYLE[result.treatment].cls}`}>
              {TREATMENT_STYLE[result.treatment].label}
            </span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{result.rate}%</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ml-auto ${result.vat_id_valid ? 'text-emerald-600' : 'text-gray-400'}`}>
              {result.vat_id_valid ? <><BadgeCheck className="w-3.5 h-3.5" /> VAT ID format OK</> : <><BadgeX className="w-3.5 h-3.5" /> no valid VAT ID</>}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">{result.note}</p>
          <p className="text-[10px] text-gray-400 mt-1">{result.supplier_country} → {result.client_country}</p>
        </div>
      )}
    </div>
  );
}
