'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UploadCloud, Save, Download, Loader2, Plus, Trash2, ArrowUp, ArrowDown,
  Wand2, CheckCircle2, Table2, Columns, GripVertical,
} from 'lucide-react';
import { useProgram, useUpdateProgram } from '@/lib/hooks/useProjects';
import { parseFile, inferColumns, type ParsedFile } from '@/lib/programBuilder/parse';
import { applyPipeline, projectColumns, derivedColumns } from '@/lib/programBuilder/engine';
import { downloadRows } from '@/lib/programBuilder/exporter';
import {
  emptyPipeline, type PipelineConfig, type TransformStep, type TransformOp, type Row, type ColumnType,
} from '@/lib/programBuilder/types';
import { isMiniProgramConfig } from '@/lib/miniProgram/blocks';
import MiniProgramBuilderView from '@/components/miniProgram/MiniProgramBuilderView';

const uid = () => Math.random().toString(36).slice(2, 10);

const TYPE_BADGE: Record<ColumnType, string> = {
  number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  text: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  empty: 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500',
};

const OPS: { op: TransformOp; label: string }[] = [
  { op: 'trim', label: 'Trim whitespace' },
  { op: 'case', label: 'Change case' },
  { op: 'replace', label: 'Find & replace' },
  { op: 'extract', label: 'Regex extract → new column' },
  { op: 'split', label: 'Split column' },
  { op: 'concat', label: 'Combine columns' },
  { op: 'computed', label: 'Computed column (math)' },
  { op: 'rename', label: 'Rename column' },
  { op: 'drop', label: 'Drop column' },
  { op: 'filter', label: 'Filter rows' },
  { op: 'code', label: 'Custom code (JS)' },
];

function newStep(op: TransformOp, col: string): TransformStep {
  const id = uid();
  switch (op) {
    case 'trim': return { id, op, column: col };
    case 'case': return { id, op, column: col, mode: 'upper' };
    case 'replace': return { id, op, column: col, find: '', replace: '', regex: false };
    case 'extract': return { id, op, column: col, pattern: '', into: `${col}_extracted` };
    case 'split': return { id, op, column: col, delimiter: ',', into: [`${col}_1`, `${col}_2`] };
    case 'concat': return { id, op, columns: [col], separator: ' ', into: 'combined' };
    case 'computed': return { id, op, left: col, operator: '+', right: col, into: 'result' };
    case 'rename': return { id, op, column: col, to: col };
    case 'drop': return { id, op, column: col };
    case 'filter': return { id, op, column: col, condition: 'not_empty', value: '' };
    case 'code': return { id, op, code: '// row.total = Number(row.price) * Number(row.qty)\n// return false to exclude the row' };
  }
}

export default function ProgramBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const { data: program, isLoading } = useProgram(id);
  const update = useUpdateProgram(id);

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [pipeline, setPipeline] = useState<PipelineConfig>(emptyPipeline());
  const [seeded, setSeeded] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed pipeline from the saved program config once.
  if (!seeded && program) {
    const cfg = program.config as unknown as PipelineConfig;
    if (cfg && cfg.version === 1) setPipeline(cfg);
    setSeeded(true);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const pf = await parseFile(file);
    setParsed(pf);
    const first = pf.sheets[0] ?? '';
    loadSheet(pf, first);
  }

  function loadSheet(pf: ParsedFile, name: string) {
    setSheet(name);
    const { headers, rows: r } = pf.readSheet(name);
    setRows(r);
    setPipeline((prev) => ({
      ...prev,
      sheetName: name,
      // Keep saved column mapping if it matches the file; otherwise infer fresh.
      columns: prev.columns.length > 0 && prev.columns.every((c) => headers.includes(c.key))
        ? prev.columns
        : inferColumns(headers, r),
    }));
  }

  const headers = useMemo(() => pipeline.columns.map((c) => c.key), [pipeline.columns]);
  const availableCols = useMemo(() => derivedColumns(headers, pipeline.steps), [headers, pipeline.steps]);

  const preview = useMemo(() => {
    const transformed = applyPipeline(rows.slice(0, 50), pipeline.steps);
    return projectColumns(transformed, pipeline.columns);
  }, [rows, pipeline.steps, pipeline.columns]);

  const previewCols = useMemo(
    () => (preview[0] ? Object.keys(preview[0]) : []),
    [preview],
  );

  // ── Mutators ──────────────────────────────────────────────────────────────
  const setSteps = (steps: TransformStep[]) => setPipeline((p) => ({ ...p, steps }));
  const addStep = (op: TransformOp) => setSteps([...pipeline.steps, newStep(op, availableCols[0] ?? '')]);
  const updateStep = (i: number, patch: Partial<TransformStep>) =>
    setSteps(pipeline.steps.map((s, idx) => (idx === i ? ({ ...s, ...patch } as TransformStep) : s)));
  const removeStep = (i: number) => setSteps(pipeline.steps.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pipeline.steps.length) return;
    const next = [...pipeline.steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };
  const setColumn = (key: string, patch: { label?: string; included?: boolean }) =>
    setPipeline((p) => ({
      ...p,
      columns: p.columns.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));

  async function save() {
    await update.mutateAsync({ config: pipeline as unknown as Record<string, unknown>, status: 'published' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function runDownload() {
    const transformed = applyPipeline(rows, pipeline.steps);
    downloadRows(projectColumns(transformed, pipeline.columns), pipeline.output);
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-gray-400 py-20 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading program…</div>;
  }
  if (!program) {
    return <div className="max-w-3xl mx-auto px-6 py-16 text-gray-500">Program not found. <Link href="/projects" className="text-primary-600 underline">Back</Link></div>;
  }

  // v2 (block-based mini program) → new builder; v1/legacy → the linear builder below.
  if (isMiniProgramConfig(program.config)) {
    return <MiniProgramBuilderView program={program} />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            {program.project_id && (
              <Link href={`/projects/${program.project_id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
                <ArrowLeft className="w-4 h-4" /> Project
              </Link>
            )}
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-primary-500" /> {program.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{program.type} program</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-primary-600 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
            <button onClick={save} disabled={update.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold hover:bg-gray-50">
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save pipeline
            </button>
            <button onClick={runDownload} disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold">
              <Download className="w-4 h-4" /> Run & download
            </button>
          </div>
        </div>

        {/* Source */}
        {rows.length === 0 ? (
          <label className="saas-card flex flex-col items-center gap-3 py-16 text-center cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-primary-500 transition">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onUpload} />
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <UploadCloud className="w-7 h-7 text-blue-500" />
            </div>
            <p className="font-bold text-gray-900 dark:text-white">Upload a sample file</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Excel (.xlsx) or CSV. The builder detects your columns automatically, then you add
              transform steps and preview the result live.
            </p>
          </label>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            {/* ── Left: mapping + steps ─────────────────────────────────── */}
            <div className="space-y-6">
              {/* File / sheet */}
              <div className="saas-card !p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-primary-500" /> {fileName}
                  </span>
                  <label className="text-xs text-primary-600 cursor-pointer hover:underline">
                    Replace
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onUpload} />
                  </label>
                </div>
                {parsed && parsed.sheets.length > 1 && (
                  <select value={sheet} onChange={(e) => parsed && loadSheet(parsed, e.target.value)}
                    className="saas-input mt-3 !py-2 text-sm">
                    {parsed.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-2">{rows.length} rows detected</p>
              </div>

              {/* Column mapping */}
              <div className="saas-card !p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Columns className="w-4 h-4 text-primary-500" /> Columns
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {pipeline.columns.map((c) => (
                    <div key={c.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={c.included}
                        onChange={(e) => setColumn(c.key, { included: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <input value={c.label} onChange={(e) => setColumn(c.key, { label: e.target.value })}
                        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 focus:ring-0 p-0 truncate" />
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE[c.type]}`}>{c.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div className="saas-card !p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Transform steps</h3>
                <div className="space-y-3">
                  {pipeline.steps.map((s, i) => (
                    <StepCard key={s.id} step={s} index={i} columns={availableCols}
                      onChange={(patch) => updateStep(i, patch)}
                      onRemove={() => removeStep(i)}
                      onMove={(d) => moveStep(i, d)}
                      canUp={i > 0} canDown={i < pipeline.steps.length - 1} />
                  ))}
                  {pipeline.steps.length === 0 && (
                    <p className="text-xs text-gray-400">No steps yet. Add one below to start transforming.</p>
                  )}
                </div>
                {/* Add-step palette */}
                <details className="mt-3">
                  <summary className="text-sm font-semibold text-primary-600 cursor-pointer list-none flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add step
                  </summary>
                  <div className="grid grid-cols-1 gap-1 mt-2">
                    {OPS.map((o) => (
                      <button key={o.op} onClick={() => addStep(o.op)}
                        className="text-left text-xs px-2.5 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                        {o.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              {/* Output */}
              <div className="saas-card !p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Output</h3>
                <div className="flex gap-2">
                  {(['xlsx', 'csv'] as const).map((f) => (
                    <button key={f} onClick={() => setPipeline((p) => ({ ...p, output: { ...p.output, format: f } }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                        pipeline.output.format === f
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                          : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300'
                      }`}>{f.toUpperCase()}</button>
                  ))}
                </div>
                <input value={pipeline.output.fileName}
                  onChange={(e) => setPipeline((p) => ({ ...p, output: { ...p.output, fileName: e.target.value } }))}
                  className="saas-input !py-2 text-sm" placeholder="output.xlsx" />
              </div>
            </div>

            {/* ── Right: live preview ───────────────────────────────────── */}
            <div className="saas-card !p-0 overflow-hidden self-start">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Live preview</h3>
                <span className="text-xs text-gray-400">{preview.length} rows · {previewCols.length} columns</span>
              </div>
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      {previewCols.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-dark-border last:border-0">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {preview.slice(0, 30).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                        {previewCols.map((c) => (
                          <td key={c} className="px-3 py-1.5 text-gray-600 dark:text-gray-400 border-r border-gray-50 dark:border-dark-border/40 last:border-0 truncate max-w-[220px]">
                            {String(r[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step card (inline editor per operation) ───────────────────────────────────

function StepCard({
  step, index, columns, onChange, onRemove, onMove, canUp, canDown,
}: {
  step: TransformStep; index: number; columns: string[];
  onChange: (patch: Partial<TransformStep>) => void;
  onRemove: () => void; onMove: (dir: -1 | 1) => void; canUp: boolean; canDown: boolean;
}) {
  const ColSelect = ({ value, onSet }: { value: string; onSet: (v: string) => void }) => (
    <select value={value} onChange={(e) => onSet(e.target.value)} className="saas-input !py-1.5 text-xs">
      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  const txt = (value: string, onSet: (v: string) => void, ph = '') => (
    <input value={value} onChange={(e) => onSet(e.target.value)} placeholder={ph} className="saas-input !py-1.5 text-xs" />
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-gray-400" /> {index + 1}. {step.op}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={!canUp} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(1)} disabled={!canDown} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {step.op === 'trim' && <div className="col-span-2"><ColSelect value={step.column} onSet={(v) => onChange({ column: v })} /></div>}

        {step.op === 'case' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          <select value={step.mode} onChange={(e) => onChange({ mode: e.target.value as any })} className="saas-input !py-1.5 text-xs">
            <option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Title Case</option>
          </select>
        </>)}

        {step.op === 'replace' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" checked={!!step.regex} onChange={(e) => onChange({ regex: e.target.checked })} /> regex</label>
          {txt(step.find, (v) => onChange({ find: v }), 'find')}
          {txt(step.replace, (v) => onChange({ replace: v }), 'replace with')}
        </>)}

        {step.op === 'extract' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          {txt(step.into, (v) => onChange({ into: v }), 'new column')}
          <div className="col-span-2">{txt(step.pattern, (v) => onChange({ pattern: v }), 'regex, e.g. (\\d{4})')}</div>
        </>)}

        {step.op === 'split' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          {txt(step.delimiter, (v) => onChange({ delimiter: v }), 'delimiter')}
          <div className="col-span-2">{txt(step.into.join(', '), (v) => onChange({ into: v.split(',').map((s) => s.trim()) }), 'new columns, comma-separated')}</div>
        </>)}

        {step.op === 'concat' && (<>
          <div className="col-span-2">{txt(step.columns.join(', '), (v) => onChange({ columns: v.split(',').map((s) => s.trim()) }), 'columns to combine, comma-separated')}</div>
          {txt(step.separator, (v) => onChange({ separator: v }), 'separator')}
          {txt(step.into, (v) => onChange({ into: v }), 'new column')}
        </>)}

        {step.op === 'computed' && (<>
          <ColSelect value={step.left} onSet={(v) => onChange({ left: v })} />
          <select value={step.operator} onChange={(e) => onChange({ operator: e.target.value as any })} className="saas-input !py-1.5 text-xs">
            <option value="+">+</option><option value="-">−</option><option value="*">×</option><option value="/">÷</option>
          </select>
          <ColSelect value={step.right} onSet={(v) => onChange({ right: v })} />
          {txt(step.into, (v) => onChange({ into: v }), 'new column')}
        </>)}

        {step.op === 'rename' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          {txt(step.to, (v) => onChange({ to: v }), 'new name')}
        </>)}

        {step.op === 'drop' && <div className="col-span-2"><ColSelect value={step.column} onSet={(v) => onChange({ column: v })} /></div>}

        {step.op === 'filter' && (<>
          <ColSelect value={step.column} onSet={(v) => onChange({ column: v })} />
          <select value={step.condition} onChange={(e) => onChange({ condition: e.target.value as any })} className="saas-input !py-1.5 text-xs">
            <option value="not_empty">is not empty</option><option value="equals">equals</option>
            <option value="not_equals">does not equal</option><option value="contains">contains</option>
            <option value="gt">greater than</option><option value="lt">less than</option><option value="regex">matches regex</option>
          </select>
          {step.condition !== 'not_empty' && <div className="col-span-2">{txt(step.value ?? '', (v) => onChange({ value: v }), 'value')}</div>}
        </>)}

        {step.op === 'code' && (
          <div className="col-span-2 space-y-1.5">
            <textarea className="saas-input text-xs font-mono" rows={6} value={step.code}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder={'// row.total = Number(row.price) * Number(row.qty)\n// return false to exclude the row'} />
            <div className="rounded bg-gray-100 dark:bg-slate-800 p-2 text-[10px] text-gray-400 space-y-0.5">
              <p><span className="font-mono text-primary-500">row.col = value</span> — add or overwrite a column</p>
              <p><span className="font-mono text-primary-500">return false</span> — exclude this row from output</p>
              <p><span className="font-mono text-primary-500">Number(row.x)</span> — parse column as number</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
