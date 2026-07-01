// File parsing (Excel/CSV via SheetJS) + intelligent column type inference.

import * as xlsx from 'xlsx';
import type { ColumnType, ColumnDef, Row } from './types';

export interface ParsedFile {
  sheets: string[];
  /** Read a sheet into { columns, rows }. First row is treated as the header. */
  readSheet: (sheetName: string) => { headers: string[]; rows: Row[] };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(new Uint8Array(buf), { type: 'array' });

  return {
    sheets: wb.SheetNames,
    readSheet: (sheetName: string) => {
      const ws = wb.Sheets[sheetName];
      if (!ws) return { headers: [], rows: [] };
      const matrix = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      if (matrix.length === 0) return { headers: [], rows: [] };

      const rawHeader = matrix[0] as unknown[];
      const headers = rawHeader.map((h, i) =>
        h !== null && h !== undefined && String(h).trim() !== '' ? String(h).trim() : `Column ${i + 1}`,
      );

      const rows: Row[] = matrix.slice(1).map((r) => {
        const arr = r as unknown[];
        const obj: Row = {};
        headers.forEach((h, i) => { obj[h] = arr[i] ?? ''; });
        return obj;
      });

      return { headers, rows };
    },
  };
}

// ── Intelligent type inference ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?$/;
const DATE_RE = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$|^\d{4}-\d{2}-\d{2}/;

function classify(value: string): ColumnType {
  const v = value.trim();
  if (v === '') return 'empty';
  if (EMAIL_RE.test(v)) return 'email';
  if (NUMBER_RE.test(v)) return 'number';
  if (DATE_RE.test(v) || !Number.isNaN(Date.parse(v)) && /\d{4}/.test(v) && /[./-]/.test(v)) return 'date';
  return 'text';
}

/** Infer a column's type from a sample of its values (majority non-empty vote). */
export function inferColumnType(values: unknown[]): ColumnType {
  const counts: Record<ColumnType, number> = { text: 0, number: 0, date: 0, email: 0, empty: 0 };
  let nonEmpty = 0;
  for (const raw of values.slice(0, 50)) {
    const t = classify(String(raw ?? ''));
    counts[t] += 1;
    if (t !== 'empty') nonEmpty += 1;
  }
  if (nonEmpty === 0) return 'empty';
  // Pick the most common non-empty type.
  const ranked = (['email', 'number', 'date', 'text'] as ColumnType[])
    .sort((a, b) => counts[b] - counts[a]);
  return ranked[0];
}

/** Build column defs with inferred types from parsed headers + rows. */
export function inferColumns(headers: string[], rows: Row[]): ColumnDef[] {
  return headers.map((key) => ({
    key,
    label: key,
    type: inferColumnType(rows.map((r) => r[key])),
    included: true,
  }));
}
