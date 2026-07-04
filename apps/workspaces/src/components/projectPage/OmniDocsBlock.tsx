'use client';

// Omni-Document block: pick an intermodal document type (CIM / CUV / CIT7 /
// CIT20 / Port loading list), fill the key fields, and generate a print-ready
// PDF (client-side via jsPDF, same as the CMR generator). The PDF previews in
// an iframe and downloads.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import type { OmniDocsBlock as OmniDocsBlockType } from '@/lib/projectPage/blocks';
import { createOmniDoc, OMNI_DOC_META, type OmniDocType, type OmniDocData } from '@/lib/omniDocs/generator';

const DOC_TYPES: OmniDocType[] = ['CIM', 'CUV', 'CIT7', 'CIT20', 'PORT_LOADING'];

const SAMPLE: OmniDocData = {
  reference: 'RCG-99812',
  date: new Date().toISOString().slice(0, 10),
  sender: 'Balkan Freight d.o.o., Koper',
  consignee: 'Bayern Logistik GmbH, München',
  carrier: 'SŽ-Tovorni promet',
  origin: 'Koper (SIKOP)',
  destination: 'München Riem',
  wagonNumber: '33 56 4661 220-1',
  cargo: 'Steel coils',
  weightKg: 24000,
  notes: '',
  items: [
    { position: '1', wagon: '33 56 4661 220-1', cargo: 'Steel coils', weightKg: 24000 },
    { position: '2', wagon: '33 56 4661 221-9', cargo: 'Timber', weightKg: 21500 },
  ],
};

export function OmniDocsView({ block }: { block: OmniDocsBlockType }) {
  const [type, setType] = useState<OmniDocType>('CIM');
  const [data, setData] = useState<OmniDocData>(SAMPLE);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastUrl = useRef<string | null>(null);

  // Revoke the previous object URL when it changes/unmounts.
  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  const set = (patch: Partial<OmniDocData>) => setData((d) => ({ ...d, ...patch }));
  const isPort = type === 'PORT_LOADING';

  const generate = () => {
    setBusy(true);
    try {
      const blob = createOmniDoc(type, data);
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const next = URL.createObjectURL(blob);
      lastUrl.current = next;
      setUrl(next);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_${data.reference || 'doc'}.pdf`;
    a.click();
  };

  const meta = useMemo(() => OMNI_DOC_META[type], [type]);

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-gray-400" /> {block.title || 'Rail documents'}
      </h3>

      {/* Doc type tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {DOC_TYPES.map((t) => (
          <button key={t} onClick={() => { setType(t); setUrl(null); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              type === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-slate-700 text-gray-500 hover:border-gray-300'}`}>
            {OMNI_DOC_META[t].title}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{meta.subtitle}</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Reference" value={data.reference} onChange={(v) => set({ reference: v })} />
        <Field label="Date" value={data.date} onChange={(v) => set({ date: v })} />
        {!isPort && <Field label="Consignor" value={data.sender ?? ''} onChange={(v) => set({ sender: v })} />}
        {!isPort && <Field label="Consignee" value={data.consignee ?? ''} onChange={(v) => set({ consignee: v })} />}
        <Field label="Origin" value={data.origin ?? ''} onChange={(v) => set({ origin: v })} />
        <Field label="Destination" value={data.destination ?? ''} onChange={(v) => set({ destination: v })} />
        {!isPort && <Field label="Wagon number" value={data.wagonNumber ?? ''} onChange={(v) => set({ wagonNumber: v })} />}
        {!isPort && <Field label="Cargo" value={data.cargo ?? ''} onChange={(v) => set({ cargo: v })} />}
      </div>
      <div className="mt-2">
        <label className="label-xs">{type === 'CIT7' ? 'Irregularity / damage description' : 'Notes'}</label>
        <textarea value={data.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={2}
          className="saas-input !py-2 text-sm resize-none w-full" placeholder={type === 'CIT7' ? 'Describe the damage or irregularity…' : 'Special agreements / declarations…'} />
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={generate} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generate {meta.title}
        </button>
        {url && (
          <button onClick={download} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800">
            <Download className="w-4 h-4" /> Download
          </button>
        )}
      </div>

      {url && (
        <iframe title="Document preview" src={url} className="mt-3 w-full rounded-lg border border-gray-200 dark:border-slate-700" style={{ height: 420 }} />
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="saas-input !py-2 text-sm" />
    </div>
  );
}
