// Pure transform engine: rows + steps → rows. No UI, no I/O — deterministic and
// testable. The same engine can run in the browser (builder preview) and later
// server-side (scheduled runs) unchanged.

import type { Row, TransformStep, ColumnDef } from './types';

const asStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const asNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(asStr(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function safeRegExp(pattern: string, flags = ''): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/** Apply a single step to a set of rows, returning new rows (never mutates input). */
export function applyStep(rows: Row[], step: TransformStep): Row[] {
  switch (step.op) {
    case 'trim':
      return rows.map((r) => ({ ...r, [step.column]: asStr(r[step.column]).trim() }));

    case 'case':
      return rows.map((r) => {
        const v = asStr(r[step.column]);
        const out = step.mode === 'upper' ? v.toUpperCase()
          : step.mode === 'lower' ? v.toLowerCase() : titleCase(v);
        return { ...r, [step.column]: out };
      });

    case 'replace': {
      const re = step.regex ? safeRegExp(step.find, 'g') : null;
      return rows.map((r) => {
        const v = asStr(r[step.column]);
        const out = re ? v.replace(re, step.replace) : v.split(step.find).join(step.replace);
        return { ...r, [step.column]: out };
      });
    }

    case 'extract': {
      const re = safeRegExp(step.pattern);
      return rows.map((r) => {
        const v = asStr(r[step.column]);
        const m = re ? re.exec(v) : null;
        return { ...r, [step.into]: m ? (m[1] ?? m[0]) : '' };
      });
    }

    case 'split':
      return rows.map((r) => {
        const parts = asStr(r[step.column]).split(step.delimiter);
        const next = { ...r };
        step.into.forEach((col, i) => { next[col] = parts[i] ?? ''; });
        return next;
      });

    case 'concat':
      return rows.map((r) => ({
        ...r,
        [step.into]: step.columns.map((c) => asStr(r[c])).join(step.separator),
      }));

    case 'computed':
      return rows.map((r) => {
        const a = asNum(r[step.left]);
        const b = asNum(r[step.right]);
        const out = step.operator === '+' ? a + b
          : step.operator === '-' ? a - b
          : step.operator === '*' ? a * b
          : b !== 0 ? a / b : 0;
        return { ...r, [step.into]: out };
      });

    case 'rename':
      return rows.map((r) => {
        const next: Row = {};
        for (const [k, v] of Object.entries(r)) next[k === step.column ? step.to : k] = v;
        return next;
      });

    case 'drop':
      return rows.map((r) => {
        const next = { ...r };
        delete next[step.column];
        return next;
      });

    case 'filter': {
      const re = step.condition === 'regex' ? safeRegExp(step.value ?? '') : null;
      return rows.filter((r) => {
        const v = asStr(r[step.column]);
        const target = step.value ?? '';
        switch (step.condition) {
          case 'equals': return v === target;
          case 'not_equals': return v !== target;
          case 'contains': return v.toLowerCase().includes(target.toLowerCase());
          case 'not_empty': return v.trim() !== '';
          case 'gt': return asNum(r[step.column]) > asNum(target);
          case 'lt': return asNum(r[step.column]) < asNum(target);
          case 'regex': return re ? re.test(v) : true;
          default: return true;
        }
      });
    }

    default:
      return rows;
  }
}

/** Run the full pipeline in order. */
export function applyPipeline(rows: Row[], steps: TransformStep[]): Row[] {
  return steps.reduce((acc, step) => applyStep(acc, step), rows);
}

/**
 * Project rows to only the included columns, using output labels. Applied after
 * the transform steps to produce the final shape.
 */
export function projectColumns(rows: Row[], columns: ColumnDef[]): Row[] {
  // Map from source header key → { included, label } (only for original columns).
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const excluded = new Set(columns.filter((c) => !c.included).map((c) => c.key));
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      if (excluded.has(k)) continue;            // user hid this original column
      const def = byKey.get(k);
      out[def ? def.label : k] = v;             // rename originals to their label; new step-columns pass through
    }
    return out;
  });
}

/** Column names that exist in the data after applying steps (for the palette). */
export function derivedColumns(baseColumns: string[], steps: TransformStep[]): string[] {
  const set = new Set(baseColumns);
  for (const s of steps) {
    if (s.op === 'extract' || s.op === 'concat' || s.op === 'computed') set.add(s.into);
    if (s.op === 'split') s.into.forEach((c) => set.add(c));
    if (s.op === 'rename') { set.delete(s.column); set.add(s.to); }
    if (s.op === 'drop') set.delete(s.column);
  }
  return Array.from(set);
}
