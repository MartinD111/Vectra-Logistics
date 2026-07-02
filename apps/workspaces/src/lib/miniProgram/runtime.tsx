'use client';

// Mini Program runtime: a shared reactive context that flows a dataset top-to-bottom
// through the block list, plus pure evaluation helpers. Input blocks feed rows in;
// processing blocks (columns/transform) rewrite the current dataset using the SAME
// engine as the classic Program Builder; output blocks read the dataset visible at
// their position. Deterministic and unit-testable via `evaluate()`.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyPipeline, projectColumns } from '@/lib/programBuilder/engine';
import type { Block, MiniProgramConfig, Row } from './blocks';

export interface RuntimeState {
  /** Rows produced by each input block (keyed by block id). */
  inputs: Record<string, Row[]>;
  /** Single-object variables (from a 'vars'-target form). */
  vars: Record<string, unknown>;
  /** Growing list of saved records (from a 'records'-target form). */
  records: Row[];
}

export interface EvalResult {
  /** Dataset entering each block (before it runs). */
  inputTo: Record<string, Row[]>;
  /** Dataset leaving each block (after it runs). */
  outputOf: Record<string, Row[]>;
  /** Dataset after the whole chain. */
  final: Row[];
}

export function emptyRuntimeState(): RuntimeState {
  return { inputs: {}, vars: {}, records: [] };
}

/** Fold the block list into a dataset, snapshotting what each block sees. Pure. */
export function evaluate(blocks: Block[], state: RuntimeState): EvalResult {
  let current: Row[] = [];
  const inputTo: Record<string, Row[]> = {};
  const outputOf: Record<string, Row[]> = {};

  for (const b of blocks) {
    inputTo[b.id] = current;
    switch (b.kind) {
      case 'file-input':
      case 'paste-input':
        current = state.inputs[b.id] ?? current;
        break;
      case 'columns':
        if (b.columns.length > 0) current = projectColumns(current, b.columns);
        break;
      case 'transform':
        current = applyPipeline(current, b.steps);
        break;
      default:
        break; // form / output / display blocks don't mutate the chain
    }
    outputOf[b.id] = current;
  }

  return { inputTo, outputOf, final: current };
}

/** Column names present in a set of rows (first row wins; empty → []). */
export function columnsOf(rows: Row[]): string[] {
  return rows[0] ? Object.keys(rows[0]) : [];
}

/** Resolve {{column}} and {{vars.key}} placeholders against a row + vars. */
export function resolvePlaceholders(
  template: string,
  row: Row | undefined,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    if (path.startsWith('vars.')) return stringify(vars[path.slice(5)]);
    if (row && path in row) return stringify(row[path]);
    if (path in vars) return stringify(vars[path]);
    return '';
  });
}

const stringify = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

// ── React context ─────────────────────────────────────────────────────────────

export interface RuntimeApi {
  state: RuntimeState;
  result: EvalResult;
  setInput: (blockId: string, rows: Row[]) => void;
  clearInput: (blockId: string) => void;
  setVar: (key: string, value: unknown) => void;
  setVars: (values: Record<string, unknown>) => void;
  addRecord: (row: Row) => void;
  removeRecord: (index: number) => void;
  resetAll: () => void;
}

const RuntimeContext = createContext<RuntimeApi | null>(null);

export function RuntimeProvider({ config, children }: { config: MiniProgramConfig; children: ReactNode }) {
  const [state, setState] = useState<RuntimeState>(emptyRuntimeState);

  const api = useMemo<RuntimeApi>(() => {
    const result = evaluate(config.blocks, state);
    return {
      state,
      result,
      setInput: (blockId, rows) => setState((s) => ({ ...s, inputs: { ...s.inputs, [blockId]: rows } })),
      clearInput: (blockId) => setState((s) => {
        const inputs = { ...s.inputs };
        delete inputs[blockId];
        return { ...s, inputs };
      }),
      setVar: (key, value) => setState((s) => ({ ...s, vars: { ...s.vars, [key]: value } })),
      setVars: (values) => setState((s) => ({ ...s, vars: { ...s.vars, ...values } })),
      addRecord: (row) => setState((s) => ({ ...s, records: [...s.records, row] })),
      removeRecord: (index) => setState((s) => ({ ...s, records: s.records.filter((_, i) => i !== index) })),
      resetAll: () => setState(emptyRuntimeState()),
    };
  }, [config.blocks, state]);

  return <RuntimeContext.Provider value={api}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeApi {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used within a RuntimeProvider');
  return ctx;
}
