'use client';

// Invoices block: the quote-to-cash board. Invoices are auto-drafted the
// moment a POD lands (live over invoice:new) with the Smart-VAT treatment and
// the POD attached; a human approves them here (draft → approved → paid).
// Approve/pay move the client's outstanding balance behind the guardrail.

import { Loader2, Receipt, Check, Banknote, Camera } from 'lucide-react';
import type { InvoicesBlock as InvoicesBlockType } from '@/lib/projectPage/blocks';
import { useInvoices, useApproveInvoice, useMarkInvoicePaid } from '@/lib/hooks/useBilling';
import type { Invoice, VatTreatment } from '@/lib/api/billing.api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const TREATMENT_BADGE: Record<VatTreatment, { label: string; cls: string }> = {
  standard: { label: 'VAT', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  reverse_charge: { label: 'Reverse charge', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  export_zero: { label: '0% export', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const eur = (n: number) => `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function InvoiceRow({ inv, onApprove, onPay, busy }: {
  inv: Invoice; onApprove: () => void; onPay: () => void; busy: boolean;
}) {
  const treatment = TREATMENT_BADGE[inv.vat_treatment] ?? TREATMENT_BADGE.standard;
  return (
    <div className="rounded-lg border border-gray-100 dark:border-slate-800 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{inv.number}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[inv.status] ?? ''}`}>{inv.status}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${treatment.cls}`}>{treatment.label}{inv.vat_rate > 0 ? ` ${inv.vat_rate}%` : ''}</span>
        {inv.pod_url && (
          <a href={`${API_ORIGIN}${inv.pod_url}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:underline">
            <Camera className="w-3 h-3" /> POD
          </a>
        )}
        <span className="text-sm font-black text-gray-900 dark:text-white ml-auto">{eur(inv.amount_total)}</span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{inv.description}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400">
          net {eur(inv.amount_net)}{inv.vat_amount > 0 ? ` + VAT ${eur(inv.vat_amount)}` : ''}{inv.due_at ? ` · due ${inv.due_at.slice(0, 10)}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {inv.status === 'draft' && (
            <button onClick={onApprove} disabled={busy}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:underline disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
            </button>
          )}
          {inv.status === 'approved' && (
            <button onClick={onPay} disabled={busy}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />} Mark paid
            </button>
          )}
        </div>
      </div>
      {inv.vat_note && inv.status === 'draft' && (
        <p className="text-[10px] text-gray-400 mt-1 leading-snug italic">{inv.vat_note}</p>
      )}
    </div>
  );
}

export function InvoicesView({ block }: { block: InvoicesBlockType }) {
  const { data: invoices, isLoading } = useInvoices();
  const approve = useApproveInvoice();
  const pay = useMarkInvoicePaid();

  const drafts = (invoices ?? []).filter((i) => i.status === 'draft');
  const rest = (invoices ?? []).filter((i) => i.status !== 'draft');

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <Receipt className="w-4 h-4 text-gray-400" /> {block.title || 'Invoices'}
        {drafts.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {drafts.length} awaiting approval
          </span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (invoices ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Receipt className="w-6 h-6" />
          <p className="text-xs">No invoices yet. They draft themselves when a POD lands.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...drafts, ...rest].map((inv) => (
            <InvoiceRow key={inv.id} inv={inv}
              onApprove={() => approve.mutate(inv.id)}
              onPay={() => pay.mutate(inv.id)}
              busy={(approve.isPending && approve.variables === inv.id) || (pay.isPending && pay.variables === inv.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
