// The Program Builder pipeline: a generic, industry-agnostic definition of how a
// tabular file (Excel/CSV) is parsed, transformed, and output. Stored as-is in
// program.config. Contains no domain logic — only generic operations.

export type ColumnType = 'text' | 'number' | 'date' | 'email' | 'empty';

export type Row = Record<string, unknown>;

export interface ColumnDef {
  /** Original header key from the source file. */
  key: string;
  /** User-facing / output label (defaults to key). */
  label: string;
  /** Inferred type (advisory). */
  type: ColumnType;
  /** Whether to keep this column in the output. */
  included: boolean;
}

// ── Transform steps ───────────────────────────────────────────────────────────
// Each step is one operation applied to all rows, in order. Params are typed per
// operation. `column` refers to a column label (post-rename), so steps compose.

export type TransformStep =
  | { id: string; op: 'trim'; column: string }
  | { id: string; op: 'case'; column: string; mode: 'upper' | 'lower' | 'title' }
  | { id: string; op: 'replace'; column: string; find: string; replace: string; regex?: boolean }
  | { id: string; op: 'extract'; column: string; pattern: string; into: string }
  | { id: string; op: 'split'; column: string; delimiter: string; into: string[] }
  | { id: string; op: 'concat'; columns: string[]; separator: string; into: string }
  | { id: string; op: 'computed'; left: string; operator: '+' | '-' | '*' | '/'; right: string; into: string }
  | { id: string; op: 'rename'; column: string; to: string }
  | { id: string; op: 'drop'; column: string }
  | {
      id: string; op: 'filter'; column: string;
      condition: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'gt' | 'lt' | 'regex';
      value?: string;
    };

export type TransformOp = TransformStep['op'];

export interface OutputConfig {
  format: 'xlsx' | 'csv';
  fileName: string;
}

export interface PipelineConfig {
  version: 1;
  sheetName: string | null;
  columns: ColumnDef[];
  steps: TransformStep[];
  output: OutputConfig;
}

export function emptyPipeline(): PipelineConfig {
  return {
    version: 1,
    sheetName: null,
    columns: [],
    steps: [],
    output: { format: 'xlsx', fileName: 'output.xlsx' },
  };
}
