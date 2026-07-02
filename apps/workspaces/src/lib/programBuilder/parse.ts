// File parsing (Excel/CSV via SheetJS) + intelligent column type inference.

import * as xlsx from 'xlsx';
import JSZip from 'jszip';
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

// ── Mini Program parsing: ZIP, header auto-detect, paste, multi-file ───────────

const SPREADSHEET_RE = /\.(xlsx|xls|csv)$/i;

/** Recursively extract spreadsheet entries from a ZIP into File objects. */
export async function extractZip(file: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(file);
  const out: File[] = [];
  const entries = Object.values(zip.files) as JSZip.JSZipObject[];
  for (const entry of entries) {
    if (entry.dir) continue;
    if (entry.name.startsWith('__MACOSX')) continue;
    if (!SPREADSHEET_RE.test(entry.name)) continue;
    const blob = await entry.async('blob');
    out.push(new File([blob], entry.name.split('/').pop() ?? entry.name));
  }
  return out;
}

/** Header-row heuristic: within the first 15 rows, the one with the most
 *  non-empty cells is treated as the header (mirrors the hand-written tools). */
export function detectHeaderRow(matrix: unknown[][]): number {
  const scan = Math.min(matrix.length, 15);
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r < scan; r++) {
    const row = matrix[r] ?? [];
    const score = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

/** Turn a raw matrix into { headers, rows } using the given header row index. */
export function matrixToRows(matrix: unknown[][], headerRow: number): { headers: string[]; rows: Row[] } {
  if (matrix.length === 0) return { headers: [], rows: [] };
  const rawHeader = (matrix[headerRow] ?? []) as unknown[];
  const headers = rawHeader.map((h, i) =>
    h !== null && h !== undefined && String(h).trim() !== '' ? String(h).trim() : `Column ${i + 1}`,
  );
  const rows: Row[] = matrix.slice(headerRow + 1).map((r) => {
    const arr = (r ?? []) as unknown[];
    const obj: Row = {};
    headers.forEach((h, i) => { obj[h] = arr[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

/** Parse one spreadsheet File (first sheet) into rows, with optional header scan. */
export async function parseSpreadsheet(file: File, headerAutoDetect = true): Promise<{ headers: string[]; rows: Row[] }> {
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(new Uint8Array(buf), { type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) return { headers: [], rows: [] };
  const matrix = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[first], { header: 1, blankrows: false });
  const headerRow = headerAutoDetect ? detectHeaderRow(matrix) : 0;
  return matrixToRows(matrix, headerRow);
}

/** Merge many parsed results into one dataset (union of headers, preserving order). */
export function mergeDatasets(parts: { headers: string[]; rows: Row[] }[]): { headers: string[]; rows: Row[] } {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) for (const h of p.headers) if (!seen.has(h)) { seen.add(h); headers.push(h); }
  const rows: Row[] = [];
  for (const p of parts) {
    for (const r of p.rows) {
      const obj: Row = {};
      for (const h of headers) obj[h] = r[h] ?? '';
      rows.push(obj);
    }
  }
  return { headers, rows };
}

/** High-level: parse a drop of files (xlsx/csv/zip) into a single dataset. */
export async function parseFilesToDataset(
  files: File[],
  headerAutoDetect = true,
): Promise<{ headers: string[]; rows: Row[] }> {
  const spreadsheets: File[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) spreadsheets.push(...(await extractZip(f)));
    else if (SPREADSHEET_RE.test(f.name)) spreadsheets.push(f);
  }
  const parts = await Promise.all(spreadsheets.map((f) => parseSpreadsheet(f, headerAutoDetect)));
  return mergeDatasets(parts);
}

/** Parse pasted tabular text (copied from Excel/CSV) into a dataset. */
export function parsePaste(
  text: string,
  opts: { delimiter?: 'tab' | 'comma' | 'auto'; hasHeader?: boolean } = {},
): { headers: string[]; rows: Row[] } {
  const { delimiter = 'auto', hasHeader = true } = opts;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = delimiter === 'auto'
    ? (lines[0].includes('\t') ? '\t' : ',')
    : delimiter === 'tab' ? '\t' : ',';
  const matrix = lines.map((l) => l.split(delim).map((c) => c.trim()));
  if (hasHeader) return matrixToRows(matrix, 0);
  // No header row: synthesize Column 1..N and keep every line as data.
  const width = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  const synthetic = [Array.from({ length: width }, (_, i) => `Column ${i + 1}`), ...matrix];
  return matrixToRows(synthetic, 0);
}
