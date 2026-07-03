'use client';

// Settings editor for the selected block in the builder. Each kind gets a small
// form; available column names are read from the shared runtime (populated when the
// user drops a sample file into the live preview), so pickers show real columns.

import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type {
  Block, FileInputBlock, PasteInputBlock, FormBlock, FormField, ColumnsBlock, TransformBlock,
  TableBlock, ExportBlock, CopyBlock, DocumentBlock, RecordsBlock, TextBlock, FileType, ExportFormat,
  CodeBlock, TsvOutputBlock, DropdownBlock, DataSourceRef,
} from '@/lib/miniProgram/blocks';
import { uid, blockDef, getDataSource, ROW_PRODUCING_KINDS } from '@/lib/miniProgram/blocks';
import { useRuntime, columnsOf } from '@/lib/miniProgram/runtime';
import { inferColumns } from '@/lib/programBuilder/parse';
import { derivedColumns } from '@/lib/programBuilder/engine';
import type { TransformStep, TransformOp } from '@/lib/programBuilder/types';
import { DynamicBlockSettings } from './DynamicBlockSettings';

export function BlockSettings({ block, allBlocks, onChange }: { block: Block; allBlocks: Block[]; onChange: (b: Block) => void }) {
  const rt = useRuntime();
  const incoming = rt.result.inputTo[block.id] ?? [];
  const availableColumns = columnsOf(incoming);
  const patch = (p: Partial<Block>) => onChange({ ...block, ...p } as Block);
  const sourcePicker = <SourcePicker block={block} allBlocks={allBlocks} patch={patch} />;

  switch (block.kind) {
    case 'text': return <TextSettings block={block} patch={patch} />;
    case 'file-input': return <FileInputSettings block={block} patch={patch} />;
    case 'paste-input': return <PasteSettings block={block} patch={patch} />;
    case 'form': return <FormSettings block={block} patch={patch} />;
    case 'columns': return <div className="space-y-3">{sourcePicker}<ColumnsSettings block={block} patch={patch} sample={incoming} /></div>;
    case 'transform': return <div className="space-y-3">{sourcePicker}<TransformSettings block={block} patch={patch} columns={availableColumns} /></div>;
    case 'table': return <div className="space-y-3">{sourcePicker}<TableSettings block={block} patch={patch} columns={availableColumns} /></div>;
    case 'export': return <div className="space-y-3">{sourcePicker}<ExportSettings block={block} patch={patch} /></div>;
    case 'copy': return <div className="space-y-3">{sourcePicker}<CopySettings block={block} patch={patch} columns={availableColumns} /></div>;
    case 'document': return <div className="space-y-3">{sourcePicker}<DocumentSettings block={block} patch={patch} columns={availableColumns} /></div>;
    case 'records': return <RecordsSettings block={block} patch={patch} />;
    case 'code': return <div className="space-y-3">{sourcePicker}<CodeSettings block={block} patch={patch} /></div>;
    case 'tsv-output': return <div className="space-y-3">{sourcePicker}<TsvOutputSettings block={block} patch={patch} /></div>;
    case 'dropdown': return <DropdownSettings block={block} patch={patch} />;
    case 'plugin': return <div className="space-y-3">{sourcePicker}<DynamicBlockSettings block={block} columns={availableColumns} patch={(config) => patch({ config } as Partial<Block>)} /></div>;
    default: return null;
  }
}

/** Shared "data source" picker for every block kind that supports a `dataSource` override. Lists earlier row-producing blocks; blank = default (previous block's output). */
function SourcePicker({ block, allBlocks, patch }: { block: Block; allBlocks: Block[]; patch: (p: Partial<Block>) => void }) {
  const idx = allBlocks.findIndex((b) => b.id === block.id);
  const earlier = idx < 0 ? allBlocks : allBlocks.slice(0, idx);
  const candidates = earlier.filter((b) => ROW_PRODUCING_KINDS.includes(b.kind));
  const current = getDataSource(block);
  if (candidates.length === 0) return null;
  return (
    <div>
      <span className="label-xs">Data source</span>
      <select
        className="saas-input !py-1.5 text-xs mt-1"
        value={current?.blockId ?? ''}
        onChange={(e) => {
          const blockId = e.target.value;
          patch({ dataSource: blockId ? ({ blockId } as DataSourceRef) : undefined } as Partial<Block>);
        }}
      >
        <option value="">Same as previous block</option>
        {candidates.map((c) => <option key={c.id} value={c.id}>{blockDef(c.kind)?.title ?? c.kind} ({c.id.slice(0, 4)})</option>)}
      </select>
    </div>
  );
}

type P<T> = { block: T; patch: (p: Partial<Block>) => void };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><span className="label-xs">{label}</span>{children}</div>
);

function TextSettings({ block, patch }: P<TextBlock>) {
  return <Field label="HTML content">
    <textarea className="saas-input text-xs font-mono" rows={5} value={block.html} onChange={(e) => patch({ html: e.target.value })} />
  </Field>;
}

function FileInputSettings({ block, patch }: P<FileInputBlock>) {
  const toggle = (t: FileType) => patch({ accept: block.accept.includes(t) ? block.accept.filter((x) => x !== t) : [...block.accept, t] });
  return (
    <div className="space-y-3">
      <Field label="Label"><input className="saas-input !py-2 text-sm" value={block.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
      <Field label="Accept">
        <div className="flex gap-2 mt-1">
          {(['xlsx', 'csv', 'zip'] as FileType[]).map((t) => (
            <button key={t} onClick={() => toggle(t)} className={`px-3 py-1 rounded-lg text-xs font-semibold border ${block.accept.includes(t) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-slate-700 text-gray-500'}`}>{t.toUpperCase()}</button>
          ))}
        </div>
      </Field>
      <Check label="Allow multiple files" checked={block.multiple} onChange={(v) => patch({ multiple: v })} />
      <Check label="Auto-detect header row" checked={block.headerAutoDetect} onChange={(v) => patch({ headerAutoDetect: v })} />
    </div>
  );
}

function PasteSettings({ block, patch }: P<PasteInputBlock>) {
  return (
    <div className="space-y-3">
      <Field label="Label"><input className="saas-input !py-2 text-sm" value={block.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
      <Field label="Delimiter">
        <select className="saas-input !py-2 text-sm" value={block.delimiter} onChange={(e) => patch({ delimiter: e.target.value as PasteInputBlock['delimiter'] })}>
          <option value="auto">Auto</option><option value="tab">Tab</option><option value="comma">Comma</option>
        </select>
      </Field>
      <Check label="First line is a header" checked={block.hasHeader} onChange={(v) => patch({ hasHeader: v })} />
    </div>
  );
}

function ColumnsSettings({ block, patch, sample }: P<ColumnsBlock> & { sample: import('@/lib/miniProgram/blocks').Row[] }) {
  const detect = () => patch({ columns: inferColumns(columnsOf(sample), sample) });
  return (
    <div className="space-y-3">
      <button onClick={detect} disabled={sample.length === 0} className="text-xs font-semibold text-primary-600 disabled:opacity-40">Detect columns from sample</button>
      {block.columns.length === 0 && <p className="text-xs text-gray-400">No columns yet. Drop a sample file in the preview, then Detect.</p>}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {block.columns.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <input type="checkbox" checked={c.included} className="rounded border-gray-300 text-primary-600"
              onChange={(e) => patch({ columns: block.columns.map((x) => x.key === c.key ? { ...x, included: e.target.checked } : x) })} />
            <input value={c.label} className="flex-1 min-w-0 bg-transparent text-sm border-0 focus:ring-0 p-0"
              onChange={(e) => patch({ columns: block.columns.map((x) => x.key === c.key ? { ...x, label: e.target.value } : x) })} />
            <span className="text-[10px] text-gray-400">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Transform steps (compact editor) ──────────────────────────────────────────

const OPS: { op: TransformOp; label: string }[] = [
  { op: 'trim', label: 'Trim whitespace' }, { op: 'case', label: 'Change case' },
  { op: 'replace', label: 'Find & replace' }, { op: 'extract', label: 'Regex extract → new column' },
  { op: 'split', label: 'Split column' }, { op: 'concat', label: 'Combine columns' },
  { op: 'computed', label: 'Computed (math)' }, { op: 'rename', label: 'Rename column' },
  { op: 'drop', label: 'Drop column' }, { op: 'filter', label: 'Filter rows' },
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

function TransformSettings({ block, patch, columns }: P<TransformBlock> & { columns: string[] }) {
  const avail = derivedColumns(columns, block.steps);
  const setSteps = (steps: TransformStep[]) => patch({ steps });
  const add = (op: TransformOp) => setSteps([...block.steps, newStep(op, avail[0] ?? '')]);
  const upd = (i: number, p: Partial<TransformStep>) => setSteps(block.steps.map((s, idx) => idx === i ? ({ ...s, ...p } as TransformStep) : s));
  const del = (i: number) => setSteps(block.steps.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= block.steps.length) return; const n = [...block.steps]; [n[i], n[j]] = [n[j], n[i]]; setSteps(n); };

  return (
    <div className="space-y-2">
      {block.steps.map((s, i) => (
        <StepEditor key={s.id} step={s} columns={avail} onChange={(p) => upd(i, p)} onRemove={() => del(i)} onMove={(d) => move(i, d)} />
      ))}
      {block.steps.length === 0 && <p className="text-xs text-gray-400">No steps. Add one below.</p>}
      <details>
        <summary className="text-sm font-semibold text-primary-600 cursor-pointer list-none flex items-center gap-1"><Plus className="w-4 h-4" /> Add step</summary>
        <div className="grid gap-1 mt-2">
          {OPS.map((o) => <button key={o.op} onClick={() => add(o.op)} className="text-left text-xs px-2.5 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">{o.label}</button>)}
        </div>
      </details>
    </div>
  );
}

function StepEditor({ step, columns, onChange, onRemove, onMove }: {
  step: TransformStep; columns: string[];
  onChange: (p: Partial<TransformStep>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
}) {
  const Col = ({ value, set }: { value: string; set: (v: string) => void }) => (
    <select value={value} onChange={(e) => set(e.target.value)} className="saas-input !py-1.5 text-xs">{columns.map((c) => <option key={c} value={c}>{c}</option>)}</select>
  );
  const T = (value: string, set: (v: string) => void, ph = '') => (
    <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} className="saas-input !py-1.5 text-xs" />
  );
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{step.op}</span>
        <div className="flex gap-1">
          <button onClick={() => onMove(-1)} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(1)} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {step.op === 'trim' && <div className="col-span-2"><Col value={step.column} set={(v) => onChange({ column: v })} /></div>}
        {step.op === 'case' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />
          <select value={step.mode} onChange={(e) => onChange({ mode: e.target.value as 'upper' | 'lower' | 'title' })} className="saas-input !py-1.5 text-xs"><option value="upper">UPPER</option><option value="lower">lower</option><option value="title">Title</option></select></>)}
        {step.op === 'replace' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />
          <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" checked={!!step.regex} onChange={(e) => onChange({ regex: e.target.checked })} /> regex</label>
          {T(step.find, (v) => onChange({ find: v }), 'find')}{T(step.replace, (v) => onChange({ replace: v }), 'replace')}</>)}
        {step.op === 'extract' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />{T(step.into, (v) => onChange({ into: v }), 'new column')}<div className="col-span-2">{T(step.pattern, (v) => onChange({ pattern: v }), 'regex e.g. (\\d{4})')}</div></>)}
        {step.op === 'split' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />{T(step.delimiter, (v) => onChange({ delimiter: v }), 'delimiter')}<div className="col-span-2">{T(step.into.join(', '), (v) => onChange({ into: v.split(',').map((s) => s.trim()) }), 'new columns, comma-sep')}</div></>)}
        {step.op === 'concat' && (<><div className="col-span-2">{T(step.columns.join(', '), (v) => onChange({ columns: v.split(',').map((s) => s.trim()) }), 'columns, comma-sep')}</div>{T(step.separator, (v) => onChange({ separator: v }), 'separator')}{T(step.into, (v) => onChange({ into: v }), 'new column')}</>)}
        {step.op === 'computed' && (<><Col value={step.left} set={(v) => onChange({ left: v })} />
          <select value={step.operator} onChange={(e) => onChange({ operator: e.target.value as '+' | '-' | '*' | '/' })} className="saas-input !py-1.5 text-xs"><option value="+">+</option><option value="-">−</option><option value="*">×</option><option value="/">÷</option></select>
          <Col value={step.right} set={(v) => onChange({ right: v })} />{T(step.into, (v) => onChange({ into: v }), 'new column')}</>)}
        {step.op === 'rename' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />{T(step.to, (v) => onChange({ to: v }), 'new name')}</>)}
        {step.op === 'drop' && <div className="col-span-2"><Col value={step.column} set={(v) => onChange({ column: v })} /></div>}
        {step.op === 'filter' && (<><Col value={step.column} set={(v) => onChange({ column: v })} />
          <select value={step.condition} onChange={(e) => onChange({ condition: e.target.value as Extract<TransformStep, { op: 'filter' }>['condition'] })} className="saas-input !py-1.5 text-xs">
            <option value="not_empty">is not empty</option><option value="equals">equals</option><option value="not_equals">not equal</option><option value="contains">contains</option><option value="gt">greater than</option><option value="lt">less than</option><option value="regex">matches regex</option>
          </select>
          {step.condition !== 'not_empty' && <div className="col-span-2">{T(step.value ?? '', (v) => onChange({ value: v }), 'value')}</div>}</>)}
        {step.op === 'code' && (
          <div className="col-span-2 space-y-1.5">
            <textarea className="saas-input text-xs font-mono" rows={6} value={step.code}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder={'// row.total = Number(row.price) * Number(row.qty)\n// return false to exclude the row'} />
            <div className="rounded bg-gray-100 dark:bg-slate-800 p-2 text-[10px] text-gray-400 space-y-0.5">
              <p><span className="font-mono text-primary-500">row.col = value</span> — add or overwrite a column</p>
              <p><span className="font-mono text-primary-500">return false</span> — exclude this row from output</p>
              <p><span className="font-mono text-primary-500">Number(row.x)</span> — parse a column as number</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TableSettings({ block, patch, columns }: P<TableBlock> & { columns: string[] }) {
  const toggle = (c: string) => patch({ columns: block.columns.includes(c) ? block.columns.filter((x) => x !== c) : [...block.columns, c] });
  return (
    <div className="space-y-3">
      <Field label="Empty text"><input className="saas-input !py-2 text-sm" value={block.emptyText ?? ''} onChange={(e) => patch({ emptyText: e.target.value })} /></Field>
      <div>
        <span className="label-xs">Columns (none = all)</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {columns.length === 0 && <p className="text-xs text-gray-400">Drop a sample file in the preview to pick columns.</p>}
          {columns.map((c) => <button key={c} onClick={() => toggle(c)} className={`px-2 py-1 rounded-lg text-xs border ${block.columns.includes(c) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-gray-200 dark:border-slate-700 text-gray-500'}`}>{c}</button>)}
        </div>
      </div>
    </div>
  );
}

function ExportSettings({ block, patch }: P<ExportBlock>) {
  const toggle = (f: ExportFormat) => patch({ formats: block.formats.includes(f) ? block.formats.filter((x) => x !== f) : [...block.formats, f] });
  return (
    <div className="space-y-3">
      <Field label="Button label"><input className="saas-input !py-2 text-sm" value={block.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
      <Field label="File name"><input className="saas-input !py-2 text-sm" value={block.fileName} onChange={(e) => patch({ fileName: e.target.value })} /></Field>
      <Field label="Formats">
        <div className="flex gap-2 mt-1">{(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((f) => <button key={f} onClick={() => toggle(f)} className={`px-3 py-1 rounded-lg text-xs font-semibold border ${block.formats.includes(f) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-gray-200 dark:border-slate-700 text-gray-500'}`}>{f.toUpperCase()}</button>)}</div>
      </Field>
      <Check label="Offer 'Save to folder'" checked={block.saveToFolder} onChange={(v) => patch({ saveToFolder: v })} />
    </div>
  );
}

function CopySettings({ block, patch, columns }: P<CopyBlock> & { columns: string[] }) {
  return (
    <div className="space-y-3">
      <Field label="Button label"><input className="saas-input !py-2 text-sm" value={block.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
      <Field label="Copy">
        <select className="saas-input !py-2 text-sm" value={block.source} onChange={(e) => patch({ source: e.target.value })}>
          <option value="all">All columns (TSV)</option>
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );
}

function DocumentSettings({ block, patch, columns }: P<DocumentBlock> & { columns: string[] }) {
  return (
    <div className="space-y-3">
      <Field label="Button label"><input className="saas-input !py-2 text-sm" value={block.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
      <Field label="File name"><input className="saas-input !py-2 text-sm" value={block.fileName} onChange={(e) => patch({ fileName: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mode"><select className="saas-input !py-2 text-sm" value={block.mode} onChange={(e) => patch({ mode: e.target.value as DocumentBlock['mode'] })}><option value="per-row">Per row</option><option value="once">Once</option></select></Field>
        <Field label="Output"><select className="saas-input !py-2 text-sm" value={block.output} onChange={(e) => patch({ output: e.target.value as DocumentBlock['output'] })}><option value="pdf">PDF</option><option value="eml">Email (.eml)</option><option value="print">Print</option></select></Field>
      </div>
      {block.output === 'eml' && (
        <div className="grid grid-cols-1 gap-2">
          <Field label="To"><input className="saas-input !py-2 text-sm" value={block.eml?.to ?? ''} onChange={(e) => patch({ eml: { ...block.eml, to: e.target.value } })} placeholder="{{email}}" /></Field>
          <Field label="Cc"><input className="saas-input !py-2 text-sm" value={block.eml?.cc ?? ''} onChange={(e) => patch({ eml: { ...block.eml, cc: e.target.value } })} /></Field>
          <Field label="Subject"><input className="saas-input !py-2 text-sm" value={block.eml?.subject ?? ''} onChange={(e) => patch({ eml: { ...block.eml, subject: e.target.value } })} /></Field>
        </div>
      )}
      <Field label="Template (HTML, use {{column}})">
        <textarea rows={6} className="saas-input text-xs font-mono" value={block.template} onChange={(e) => patch({ template: e.target.value })} />
      </Field>
      {columns.length > 0 && <p className="text-[11px] text-gray-400">Available: {columns.map((c) => `{{${c}}}`).join(' ')}</p>}
    </div>
  );
}

function RecordsSettings({ block, patch }: P<RecordsBlock>) {
  return (
    <div className="space-y-3">
      <Field label="Title"><input className="saas-input !py-2 text-sm" value={block.title ?? ''} onChange={(e) => patch({ title: e.target.value })} /></Field>
      <Field label="Fields to show (comma-sep; blank = all)">
        <input className="saas-input !py-2 text-sm" value={block.fields.join(', ')} onChange={(e) => patch({ fields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </Field>
    </div>
  );
}

// ── Form fields editor ────────────────────────────────────────────────────────

function FormSettings({ block, patch }: P<FormBlock>) {
  const setFields = (fields: FormField[]) => patch({ fields });
  const add = () => setFields([...block.fields, { key: `field${block.fields.length + 1}`, label: `Field ${block.fields.length + 1}`, type: 'text' }]);
  const upd = (i: number, p: Partial<FormField>) => setFields(block.fields.map((f, idx) => idx === i ? { ...f, ...p } : f));
  const del = (i: number) => setFields(block.fields.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      <Field label="Title"><input className="saas-input !py-2 text-sm" value={block.title ?? ''} onChange={(e) => patch({ title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Save to"><select className="saas-input !py-2 text-sm" value={block.target} onChange={(e) => patch({ target: e.target.value as FormBlock['target'] })}><option value="vars">Variables</option><option value="records">Records list</option></select></Field>
        <Field label="Submit label"><input className="saas-input !py-2 text-sm" value={block.submitLabel} onChange={(e) => patch({ submitLabel: e.target.value })} /></Field>
      </div>
      <div className="space-y-2">
        {block.fields.map((f, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-slate-700 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Field {i + 1}</span>
              <button onClick={() => del(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="saas-input !py-1.5 text-xs" value={f.key} onChange={(e) => upd(i, { key: e.target.value })} placeholder="key" />
              <input className="saas-input !py-1.5 text-xs" value={f.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="label" />
              <select className="saas-input !py-1.5 text-xs" value={f.type} onChange={(e) => upd(i, { type: e.target.value as FormField['type'] })}>
                {['text', 'number', 'date', 'select', 'checkbox', 'textarea'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" checked={!!f.required} onChange={(e) => upd(i, { required: e.target.checked })} /> required</label>
              {f.type === 'select' && <input className="saas-input !py-1.5 text-xs col-span-2" value={(f.options ?? []).join(', ')} onChange={(e) => upd(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="options, comma-sep" />}
            </div>
          </div>
        ))}
        <button onClick={add} className="text-sm font-semibold text-primary-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add field</button>
      </div>
    </div>
  );
}

// ── Code / TSV output / Dropdown ──────────────────────────────────────────────

function CodeSettings({ block, patch }: P<CodeBlock>) {
  return (
    <div className="space-y-3">
      <Field label="JavaScript (row = current row object)">
        <textarea className="saas-input text-xs font-mono" rows={9} value={block.code}
          onChange={(e) => patch({ code: e.target.value })} />
      </Field>
      <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2.5 text-[11px] text-gray-500 space-y-1">
        <p><span className="font-mono text-primary-600">row.col = value</span> — add or overwrite a column</p>
        <p><span className="font-mono text-primary-600">return false</span> — exclude the row from the dataset</p>
        <p><span className="font-mono text-primary-600">Number(row.x)</span> — parse a column as a number</p>
      </div>
    </div>
  );
}

function TsvOutputSettings({ block, patch }: P<TsvOutputBlock>) {
  return (
    <div className="space-y-3">
      <Field label="Label">
        <input className="saas-input !py-2 text-sm" value={block.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Field>
      <Field label="Max rows">
        <input type="number" min={1} className="saas-input !py-2 text-sm" value={block.maxRows ?? 500}
          onChange={(e) => patch({ maxRows: Math.max(1, Number(e.target.value)) })} />
      </Field>
    </div>
  );
}

function DropdownSettings({ block, patch }: P<DropdownBlock>) {
  return (
    <div className="space-y-3">
      <Field label="Label">
        <input className="saas-input !py-2 text-sm" value={block.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Field>
      <Field label="Variable name (use {{selection}} in templates)">
        <input className="saas-input !py-2 text-sm font-mono" value={block.varKey}
          onChange={(e) => patch({ varKey: e.target.value })} />
      </Field>
      <Field label="Placeholder">
        <input className="saas-input !py-2 text-sm" value={block.placeholder ?? ''}
          onChange={(e) => patch({ placeholder: e.target.value })} />
      </Field>
      <Field label="Items — one per line, or paste from Excel (value[tab]label)">
        <textarea className="saas-input text-xs font-mono" rows={10} value={block.items}
          onChange={(e) => patch({ items: e.target.value })}
          placeholder={'Option A\nOption B\nOption C'} />
      </Field>
    </div>
  );
}

// ── shared ────────────────────────────────────────────────────────────────────

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 text-primary-600" /> {label}
    </label>
  );
}
