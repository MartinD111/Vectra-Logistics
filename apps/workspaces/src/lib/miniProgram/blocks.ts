// Mini Program v2 config — a generic, industry-agnostic definition of a composable
// tool page. A mini program is an ordered list of BLOCKS the user assembles in the
// builder; the same list renders read-to-use in the Player. Stored as-is in
// program.config (JSONB). Contains no domain logic — only generic building blocks.
//
// EXTENSIBILITY CONTRACT: adding a new block kind = (1) add a member to the `Block`
// union here, (2) add a renderer + settings panel in components/miniProgram/blocks,
// (3) register both in the BlockRegistry. Nothing in the engine/runtime/builder/player
// needs to change. New starter programs are plain MiniProgramConfig JSON — zero code.

import type { ColumnDef, TransformStep, Row } from '@/lib/programBuilder/types';

export type { ColumnDef, TransformStep, Row };

// ── Block kinds ───────────────────────────────────────────────────────────────
// Grouped only for the palette UI; the runtime treats all blocks uniformly.

export type BlockKind =
  // Inputs — set the runtime dataset / vars
  | 'file-input'
  | 'paste-input'
  | 'form'
  | 'dropdown'
  // Processing — read + rewrite the dataset
  | 'columns'
  | 'transform'
  | 'code'
  // Outputs / display — render or act on the current dataset
  | 'table'
  | 'export'
  | 'copy'
  | 'document'
  | 'records'
  | 'text'
  | 'tsv-output'
  // A block contributed by a plugin (see lib/miniProgram/plugins). Its real
  // identity is `pluginId`; behaviour/UI come from the plugin manifest.
  | 'plugin';

export type BlockGroup = 'input' | 'process' | 'output' | 'layout';

interface BlockBase {
  id: string;
  kind: BlockKind;
}

// ── Multi-source data references ────────────────────────────────────────────
// Most blocks implicitly read "whatever dataset the previous block produced" —
// that stays the default. A block may instead pin its input to an EARLIER
// block's output explicitly (used for lookup/join-style blocks and for reusing
// an upstream dataset out of position). `port` is only meaningful for blocks
// that produce more than one named output (e.g. a future split block).

export interface DataSourceRef {
  blockId: string;
  port?: string;
}

/** Block kinds whose output is a plain dataset other blocks can point `source` at. */
export const ROW_PRODUCING_KINDS: BlockKind[] = ['file-input', 'paste-input', 'columns', 'transform', 'code'];

// ── Input blocks ──────────────────────────────────────────────────────────────

export type FileType = 'xlsx' | 'csv' | 'zip';

export interface FileInputBlock extends BlockBase {
  kind: 'file-input';
  label: string;
  accept: FileType[];
  multiple: boolean;
  /** Scan the first N rows for the header row instead of assuming row 0. */
  headerAutoDetect: boolean;
}

export interface PasteInputBlock extends BlockBase {
  kind: 'paste-input';
  label: string;
  delimiter: 'tab' | 'comma' | 'auto';
  /** First pasted line is a header row. */
  hasHeader: boolean;
  placeholder?: string;
}

export type FormFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[]; // for select
  placeholder?: string;
}

export interface FormBlock extends BlockBase {
  kind: 'form';
  title?: string;
  fields: FormField[];
  /** Where submitted values go: `vars` (single object) or `records` (append to list). */
  target: 'vars' | 'records';
  submitLabel: string;
}

// ── Processing blocks ─────────────────────────────────────────────────────────

export interface ColumnsBlock extends BlockBase {
  kind: 'columns';
  /** Empty = infer from incoming data at runtime. */
  columns: ColumnDef[];
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface TransformBlock extends BlockBase {
  kind: 'transform';
  steps: TransformStep[];
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

// ── Output / display blocks ───────────────────────────────────────────────────

export interface TableBlock extends BlockBase {
  kind: 'table';
  /** Column labels to show; empty = all current columns. */
  columns: string[];
  emptyText?: string;
  maxHeight?: number;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ExportBlock extends BlockBase {
  kind: 'export';
  label: string;
  formats: ExportFormat[];
  fileName: string;
  /** Offer "Save to folder" (File System Access API) alongside download. */
  saveToFolder: boolean;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface CopyBlock extends BlockBase {
  kind: 'copy';
  label: string;
  /** 'all' (TSV of all columns) or a single column label. */
  source: 'all' | string;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface DocumentBlock extends BlockBase {
  kind: 'document';
  label: string;
  /** HTML with {{column}} / {{var.key}} placeholders. Sanitised before render. */
  template: string;
  /** 'per-row' = one document per dataset row; 'once' = single doc using vars. */
  mode: 'per-row' | 'once';
  output: 'eml' | 'pdf' | 'print';
  fileName: string;
  /** For 'eml' output. Values may contain placeholders. */
  eml?: { to?: string; cc?: string; subject?: string };
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface RecordsBlock extends BlockBase {
  kind: 'records';
  title?: string;
  /** Field keys (from a form block's fields) shown as columns. Empty = all. */
  fields: string[];
}

export interface TextBlock extends BlockBase {
  kind: 'text';
  /** Sanitised HTML — headings, instructions, branding. */
  html: string;
}

export interface DropdownBlock extends BlockBase {
  kind: 'dropdown';
  label: string;
  /** Runtime variable that receives the selected value. */
  varKey: string;
  /** One item per line; TSV = col 0 is value, col 1 (optional) is display label. */
  items: string;
  placeholder?: string;
}

export interface CodeBlock extends BlockBase {
  kind: 'code';
  /** JS executed per row. `row` is the current row object — mutate it to add/change columns. Return false to exclude the row. */
  code: string;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface TsvOutputBlock extends BlockBase {
  kind: 'tsv-output';
  label: string;
  maxRows?: number;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

export interface PluginBlockInstance extends BlockBase {
  kind: 'plugin';
  /** Which installed plugin this instance is (resolved via the plugin registry). */
  pluginId: string;
  /** Manifest version this instance was configured against (for update warnings). */
  version: string;
  /** Values for the plugin's settingsSchema fields. */
  config: Record<string, unknown>;
  /** Optional explicit input; default = previous block's output. */
  dataSource?: DataSourceRef;
}

// ── The union ─────────────────────────────────────────────────────────────────

export type Block =
  | FileInputBlock
  | PasteInputBlock
  | FormBlock
  | DropdownBlock
  | ColumnsBlock
  | TransformBlock
  | CodeBlock
  | TableBlock
  | ExportBlock
  | CopyBlock
  | DocumentBlock
  | RecordsBlock
  | TextBlock
  | TsvOutputBlock
  | PluginBlockInstance;

export interface MiniProgramMeta {
  title: string;
  subtitle?: string;
  /** lucide icon name (advisory; falls back to a default). */
  icon?: string;
  /** hex accent for the player header. */
  accent?: string;
}

export interface MiniProgramConfig {
  version: 2;
  meta: MiniProgramMeta;
  blocks: Block[];
}

// ── Type guards / helpers ─────────────────────────────────────────────────────

export function isMiniProgramConfig(cfg: unknown): cfg is MiniProgramConfig {
  return !!cfg && typeof cfg === 'object' && (cfg as { version?: unknown }).version === 2;
}

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function emptyMiniProgram(title = 'Untitled program'): MiniProgramConfig {
  return { version: 2, meta: { title }, blocks: [] };
}

// ── Block registry ────────────────────────────────────────────────────────────
// Central metadata + factory for every block kind. The palette is generated from
// this list, so a new kind appears everywhere once registered. Renderers/settings
// live in the UI layer and are keyed by `kind` (see components/miniProgram/blocks).

export interface BlockDef {
  kind: BlockKind;
  group: BlockGroup;
  title: string;
  description: string;
  /** lucide icon name (resolved in the UI). */
  icon: string;
  /** Build a fresh block with sensible defaults. */
  create: () => Block;
}

export const BLOCK_REGISTRY: BlockDef[] = [
  {
    kind: 'file-input', group: 'input', title: 'File input', icon: 'UploadCloud',
    description: 'Drag in Excel, CSV or ZIP files. Columns are detected automatically.',
    create: () => ({ id: uid(), kind: 'file-input', label: 'Upload files', accept: ['xlsx', 'csv', 'zip'], multiple: true, headerAutoDetect: true }),
  },
  {
    kind: 'paste-input', group: 'input', title: 'Paste data', icon: 'ClipboardPaste',
    description: 'Paste rows copied from Excel or a table.',
    create: () => ({ id: uid(), kind: 'paste-input', label: 'Paste data', delimiter: 'auto', hasHeader: true }),
  },
  {
    kind: 'form', group: 'input', title: 'Form', icon: 'TextCursorInput',
    description: 'Collect typed input as variables or saved records.',
    create: () => ({ id: uid(), kind: 'form', title: 'Details', fields: [{ key: 'field1', label: 'Field 1', type: 'text' }], target: 'vars', submitLabel: 'Save' }),
  },
  {
    kind: 'dropdown', group: 'input', title: 'Dropdown list', icon: 'ListFilter',
    description: 'Paste a list from Excel or TSV — renders as a dropdown selector that sets a variable.',
    create: () => ({ id: uid(), kind: 'dropdown', label: 'Select', varKey: 'selection', items: 'Option A\nOption B\nOption C', placeholder: 'Choose…' }),
  },
  {
    kind: 'columns', group: 'process', title: 'Columns', icon: 'Columns',
    description: 'Choose, rename and type the columns to keep.',
    create: () => ({ id: uid(), kind: 'columns', columns: [] }),
  },
  {
    kind: 'transform', group: 'process', title: 'Transform', icon: 'Wand2',
    description: 'Clean and reshape data: trim, case, replace, extract, filter, compute…',
    create: () => ({ id: uid(), kind: 'transform', steps: [] }),
  },
  {
    kind: 'code', group: 'process', title: 'Code', icon: 'Code2',
    description: 'Run JavaScript on every row — add columns, compute values, return false to filter.',
    create: () => ({ id: uid(), kind: 'code', code: '// row.total = Number(row.price) * Number(row.qty)\n// return false to exclude the row' }),
  },
  {
    kind: 'table', group: 'output', title: 'Results table', icon: 'Table2',
    description: 'Show the current data in a table.',
    create: () => ({ id: uid(), kind: 'table', columns: [], emptyText: 'Results will appear here' }),
  },
  {
    kind: 'export', group: 'output', title: 'Export button', icon: 'Download',
    description: 'Download the results as Excel, CSV or PDF — or save to a folder.',
    create: () => ({ id: uid(), kind: 'export', label: 'Export', formats: ['xlsx', 'csv', 'pdf'], fileName: 'output', saveToFolder: true }),
  },
  {
    kind: 'copy', group: 'output', title: 'Copy button', icon: 'Copy',
    description: 'Copy a column (or everything) to the clipboard.',
    create: () => ({ id: uid(), kind: 'copy', label: 'Copy', source: 'all' }),
  },
  {
    kind: 'document', group: 'output', title: 'Document / email', icon: 'FileText',
    description: 'Fill a template with {{placeholders}} to make emails, PDFs or printouts.',
    create: () => ({ id: uid(), kind: 'document', label: 'Generate', template: '<p>Hi {{name}},</p>', mode: 'per-row', output: 'pdf', fileName: 'document' }),
  },
  {
    kind: 'records', group: 'output', title: 'Saved records', icon: 'ListChecks',
    description: 'A list of records that builds up as forms are submitted.',
    create: () => ({ id: uid(), kind: 'records', title: 'Records', fields: [] }),
  },
  {
    kind: 'tsv-output', group: 'output', title: 'TSV text', icon: 'AlignLeft',
    description: 'Show the current data as tab-separated text — paste-ready for Excel.',
    create: () => ({ id: uid(), kind: 'tsv-output', label: 'TSV output' }),
  },
  {
    kind: 'text', group: 'layout', title: 'Text / heading', icon: 'Type',
    description: 'Instructions, headings or branding.',
    create: () => ({ id: uid(), kind: 'text', html: '<h2>Section title</h2>' }),
  },
];

export function blockDef(kind: BlockKind): BlockDef | undefined {
  return BLOCK_REGISTRY.find((b) => b.kind === kind);
}

/** Kinds whose block interface carries an optional `dataSource` override. */
const DATA_SOURCE_KINDS: BlockKind[] = ['table', 'export', 'copy', 'tsv-output', 'columns', 'transform', 'code', 'document', 'plugin'];

/** Read a block's `dataSource` override, if its kind supports one. Type-erased on purpose — only some union members declare the field. */
export function getDataSource(b: Block): DataSourceRef | undefined {
  if (!DATA_SOURCE_KINDS.includes(b.kind)) return undefined;
  return (b as unknown as { dataSource?: DataSourceRef }).dataSource;
}

/** Build the `outputOf` lookup key for a source ref. */
export function sourceKey(ref: DataSourceRef | undefined): string | undefined {
  if (!ref || !ref.blockId) return undefined;
  return ref.port ? `${ref.blockId}::${ref.port}` : ref.blockId;
}
