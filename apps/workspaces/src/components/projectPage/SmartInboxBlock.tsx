'use client';

// Smart Inbox block: paste a broker email / railway update (or pick a demo
// one), run it through the AI extraction + deterministic validation pipeline,
// and file the result as a draft shipment. The created draft appears live in
// any Drafts board on the page (via the socket), so this block just shows the
// last parse result inline.

import { useState } from 'react';
import { Loader2, ScanText, MailOpen, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import type { SmartInboxBlock as SmartInboxBlockType } from '@/lib/projectPage/blocks';
import { useDemoEmails, useParseEmail } from '@/lib/hooks/useInbox';
import type { ShipmentDraft } from '@/lib/api/inbox.api';

/** DATE columns serialize as full ISO timestamps; show just the date. */
const fmtDate = (v: string | null) => (v ? v.slice(0, 10) : null);

const STATUS_BADGE: Record<string, string> = {
  validated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  needs_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
};

export function SmartInboxView({ block, projectId }: { block: SmartInboxBlockType; projectId: string }) {
  const { data: demoEmails } = useDemoEmails();
  const parse = useParseEmail(projectId);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const result = parse.data?.draft;
  const demo = parse.data?.demo;

  const loadDemo = (i: number) => {
    const e = demoEmails?.[i];
    if (!e) return;
    setSubject(e.subject);
    setBody(e.body);
    parse.reset();
  };

  const run = () => {
    if (!body.trim()) return;
    parse.mutate({ subject: subject || undefined, body });
  };

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <ScanText className="w-4 h-4 text-gray-400" /> {block.title || 'Smart inbox'}
        </h3>
        {(demoEmails?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">demo:</span>
            {demoEmails!.map((_, i) => (
              <button key={i} onClick={() => loadDemo(i)}
                className="h-5 w-5 rounded text-[10px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700"
                title={demoEmails![i].subject}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <input value={subject} onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (optional)" className="saas-input !py-2 text-sm mb-2" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)}
        placeholder="Paste a broker email or railway update…" rows={5}
        className="saas-input !py-2 text-sm resize-none w-full" />

      <button onClick={run} disabled={parse.isPending || !body.trim()}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {parse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Parse into draft
      </button>

      {parse.isError && (
        <p className="mt-2 text-xs text-red-500">{(parse.error as Error)?.message ?? 'Could not parse this email.'}</p>
      )}

      {result && <ParseResult draft={result} demo={!!demo} />}
    </div>
  );
}

function ParseResult({ draft, demo }: { draft: ShipmentDraft; demo: boolean }) {
  const v = draft.validation;
  const fields: [string, string | number | null][] = [
    ['Origin', draft.origin],
    ['Destination', draft.destination],
    ['Cargo', draft.cargo_type],
    ['Weight', draft.weight_kg != null ? `${draft.weight_kg.toLocaleString()} kg` : null],
    ['Pickup', fmtDate(draft.pickup_date)],
    ['Delivery', fmtDate(draft.delivery_date)],
    ['Wagon', draft.wagon_number],
    ['Reference', draft.reference],
  ];
  return (
    <div className="mt-3 rounded-lg border border-gray-100 dark:border-slate-800 p-3">
      <div className="flex items-center gap-2 mb-2">
        <MailOpen className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Extracted draft</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[draft.status] ?? ''}`}>
          {draft.status.replace('_', ' ')}
        </span>
        {draft.confidence != null && (
          <span className="text-[10px] text-gray-400 ml-auto">{Math.round(draft.confidence * 100)}% conf.</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {fields.filter(([, val]) => val != null).map(([label, val]) => (
          <div key={label} className="text-xs">
            <span className="text-gray-400">{label}: </span>
            <span className="text-gray-800 dark:text-gray-100 font-medium">{val}</span>
          </div>
        ))}
      </div>

      {v?.errors?.length > 0 && (
        <div className="mt-2 space-y-1">
          {v.errors.map((err, i) => (
            <p key={i} className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {err}
            </p>
          ))}
        </div>
      )}
      {v?.warnings?.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {v.warnings.map((warn, i) => (
            <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400">• {warn}</p>
          ))}
        </div>
      )}
      {v?.ok && (
        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Validated — added to the Drafts board.
        </p>
      )}
      {demo && (
        <p className="mt-2 text-[10px] text-gray-400">Extracted by the built-in parser (no AI provider configured).</p>
      )}
    </div>
  );
}
