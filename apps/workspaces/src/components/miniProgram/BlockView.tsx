'use client';

// Player-side rendering of a single block. Reads/writes the shared runtime. This is
// what end users interact with (and what the builder shows in its live preview).
// Adding a new block kind means adding a case here + a member in blocks.ts + settings.

import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  UploadCloud, Loader2, RotateCcw, Download, Copy, Check, FolderOpen, FileText, Trash2, Plus,
} from 'lucide-react';
import type {
  Block, FileInputBlock, PasteInputBlock, TableBlock, ExportBlock, CopyBlock,
  DocumentBlock, TextBlock, FormBlock, RecordsBlock, Row,
} from '@/lib/miniProgram/blocks';
import { useRuntime, resolvePlaceholders } from '@/lib/miniProgram/runtime';
import { parseFilesToDataset, parsePaste } from '@/lib/programBuilder/parse';
import { saveRows, type AnyFormat } from '@/lib/programBuilder/exporter';
import { pickFolder, downloadBlob, saveBlob, supportsFolderSave, type FolderTarget } from '@/lib/miniProgram/fileSaver';
import { emlBlob, printHtml, htmlToPdfBlob } from '@/lib/miniProgram/docExport';

const clean = (html: string): string =>
  typeof window === 'undefined' ? '' : DOMPurify.sanitize(html);

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text': return <TextView block={block} />;
    case 'file-input': return <FileInputView block={block} />;
    case 'paste-input': return <PasteInputView block={block} />;
    case 'table': return <TableView block={block} />;
    case 'export': return <ExportView block={block} />;
    case 'copy': return <CopyView block={block} />;
    case 'document': return <DocumentView block={block} />;
    case 'form': return <FormView block={block} />;
    case 'records': return <RecordsView block={block} />;
    case 'columns':
    case 'transform':
      return null; // processing blocks are invisible at runtime
    default:
      return null;
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

function TextView({ block }: { block: TextBlock }) {
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: clean(block.html) }} />;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

function FileInputView({ block }: { block: FileInputBlock }) {
  const rt = useRuntime();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const rows = rt.state.inputs[block.id];
  const accept = block.accept.map((a) => `.${a}`).join(',');

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { rows } = await parseFilesToDataset(Array.from(files), block.headerAutoDetect);
      rt.setInput(block.id, rows);
      setCount(files.length);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="saas-card flex flex-col items-center gap-3 py-10 text-center cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-primary-500 transition">
        <input type="file" accept={accept} multiple={block.multiple} className="hidden"
          onChange={(e) => handle(e.target.files)} />
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          {busy ? <Loader2 className="w-6 h-6 text-blue-500 animate-spin" /> : <UploadCloud className="w-6 h-6 text-blue-500" />}
        </div>
        <p className="font-bold text-gray-900 dark:text-white">{block.label}</p>
        <p className="text-xs text-gray-500">
          {rows ? `${rows.length} rows from ${count} file${count === 1 ? '' : 's'}` : block.accept.map((a) => a.toUpperCase()).join(' · ')}
        </p>
      </label>
      {rows && (
        <button onClick={() => { rt.clearInput(block.id); setCount(0); }}
          className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

function PasteInputView({ block }: { block: PasteInputBlock }) {
  const rt = useRuntime();
  const rows = rt.state.inputs[block.id];
  function onChange(text: string) {
    if (text.trim() === '') { rt.clearInput(block.id); return; }
    const { rows } = parsePaste(text, { delimiter: block.delimiter, hasHeader: block.hasHeader });
    rt.setInput(block.id, rows);
  }
  return (
    <div className="saas-card !p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{block.label}</p>
      <textarea rows={6} className="saas-input font-mono text-xs"
        placeholder={block.placeholder ?? 'Paste rows here (copied from Excel)…'}
        onChange={(e) => onChange(e.target.value)} />
      {rows && <p className="text-xs text-gray-400 mt-2">{rows.length} rows parsed</p>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function useDatasetFor(blockId: string): Row[] {
  const rt = useRuntime();
  return rt.result.inputTo[blockId] ?? [];
}

function TableView({ block }: { block: TableBlock }) {
  const data = useDatasetFor(block.id);
  const cols = useMemo(() => {
    if (block.columns.length) return block.columns;
    return data[0] ? Object.keys(data[0]) : [];
  }, [block.columns, data]);

  if (data.length === 0) {
    return <div className="saas-card py-12 text-center text-sm text-gray-400">{block.emptyText ?? 'No data yet'}</div>;
  }
  return (
    <div className="saas-card !p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">{data.length} rows · {cols.length} columns</span>
      </div>
      <div className="overflow-auto" style={{ maxHeight: block.maxHeight ?? 480 }}>
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
            <tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-dark-border last:border-0">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {data.slice(0, 200).map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                {cols.map((c) => <td key={c} className="px-3 py-1.5 text-gray-600 dark:text-gray-400 border-r border-gray-50 dark:border-dark-border/40 last:border-0 truncate max-w-[240px]">{String(r[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function ExportView({ block }: { block: ExportBlock }) {
  const data = useDatasetFor(block.id);
  const [folder, setFolder] = useState<FolderTarget | null>(null);
  const [busy, setBusy] = useState<AnyFormat | null>(null);

  async function run(fmt: AnyFormat) {
    setBusy(fmt);
    try { await saveRows(data, block.fileName, fmt, folder); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {block.formats.map((f) => (
        <button key={f} onClick={() => run(f)} disabled={data.length === 0 || busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold">
          {busy === f ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {block.label} {f.toUpperCase()}
        </button>
      ))}
      {block.saveToFolder && supportsFolderSave() && (
        <button onClick={async () => setFolder(await pickFolder())}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border ${folder ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300'}`}>
          {folder ? <Check className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
          {folder ? folder.name : 'Save to folder…'}
        </button>
      )}
    </div>
  );
}

// ── Copy ──────────────────────────────────────────────────────────────────────

function CopyView({ block }: { block: CopyBlock }) {
  const data = useDatasetFor(block.id);
  const [done, setDone] = useState(false);

  function copy() {
    const text = block.source === 'all'
      ? [Object.keys(data[0] ?? {}).join('\t'), ...data.map((r) => Object.values(r).map((v) => String(v ?? '')).join('\t'))].join('\n')
      : data.map((r) => String(r[block.source] ?? '')).join('\n');
    navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
  }
  return (
    <button onClick={copy} disabled={data.length === 0}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50">
      {done ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} {block.label}
    </button>
  );
}

// ── Document / email ──────────────────────────────────────────────────────────

function DocumentView({ block }: { block: DocumentBlock }) {
  const rt = useRuntime();
  const data = rt.result.inputTo[block.id] ?? [];
  const [busy, setBusy] = useState(false);

  const targets: (Row | undefined)[] = block.mode === 'per-row' ? (data.length ? data : []) : [undefined];

  async function generate() {
    setBusy(true);
    try {
      for (let i = 0; i < targets.length; i++) {
        const row = targets[i];
        const html = clean(resolvePlaceholders(block.template, row, rt.state.vars));
        const name = `${block.fileName || 'document'}${targets.length > 1 ? `_${i + 1}` : ''}`;
        if (block.output === 'print') { printHtml(html, name); }
        else if (block.output === 'eml') {
          const headers = {
            to: resolvePlaceholders(block.eml?.to ?? '', row, rt.state.vars),
            cc: resolvePlaceholders(block.eml?.cc ?? '', row, rt.state.vars),
            subject: resolvePlaceholders(block.eml?.subject ?? '', row, rt.state.vars),
          };
          downloadBlob(emlBlob(html, headers), `${name}.eml`);
        } else {
          const blob = await htmlToPdfBlob(html);
          await saveBlob(blob, `${name}.pdf`);
        }
      }
    } finally { setBusy(false); }
  }

  const disabled = busy || (block.mode === 'per-row' && data.length === 0);
  return (
    <button onClick={generate} disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {block.label}{block.mode === 'per-row' && data.length > 0 ? ` (${data.length})` : ''}
    </button>
  );
}

// ── Form + records ────────────────────────────────────────────────────────────

function FormView({ block }: { block: FormBlock }) {
  const rt = useRuntime();
  const [values, setValues] = useState<Row>({});
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of block.fields) if (f.required && !String(values[f.key] ?? '').trim()) return;
    if (block.target === 'records') { rt.addRecord({ ...values }); setValues({}); }
    else rt.setVars({ ...values });
  }

  return (
    <form onSubmit={submit} className="saas-card !p-4 space-y-3">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white">{block.title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {block.fields.map((f) => (
          <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <span className="label-xs">{f.label}{f.required ? ' *' : ''}</span>
            {f.type === 'select' ? (
              <select className="saas-input !py-2 text-sm" value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" className="rounded border-gray-300 text-primary-600" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
            ) : f.type === 'textarea' ? (
              <textarea className="saas-input !py-2 text-sm" rows={3} value={String(values[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} className="saas-input !py-2 text-sm"
                value={String(values[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
        <Plus className="w-4 h-4" /> {block.submitLabel}
      </button>
    </form>
  );
}

function RecordsView({ block }: { block: RecordsBlock }) {
  const rt = useRuntime();
  const records = rt.state.records;
  const cols = block.fields.length ? block.fields : (records[0] ? Object.keys(records[0]) : []);
  return (
    <div className="saas-card !p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900 dark:text-white">{block.title ?? 'Records'}</span>
        <span className="text-xs text-gray-400">{records.length}</span>
      </div>
      {records.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No records yet</p>
      ) : (
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
              <tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{c}</th>)}<th className="w-8" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {records.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c} className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{String(r[c] ?? '')}</td>)}
                  <td className="px-2"><button onClick={() => rt.removeRecord(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
