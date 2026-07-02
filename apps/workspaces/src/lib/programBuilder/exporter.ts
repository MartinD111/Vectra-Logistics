import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import type { Row, OutputConfig } from './types';
import { downloadBlob, saveBlob, type FolderTarget } from '@/lib/miniProgram/fileSaver';

export type AnyFormat = 'xlsx' | 'csv' | 'pdf';

/** Build a downloadable blob from rows in the requested format. */
export function rowsToBlob(rows: Row[], format: AnyFormat): Blob {
  if (format === 'csv') {
    const ws = xlsx.utils.json_to_sheet(rows);
    return new Blob([xlsx.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' });
  }
  if (format === 'pdf') {
    return rowsToPdfBlob(rows);
  }
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Output');
  const out = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/octet-stream' });
}

/** Render rows as a simple paginated table PDF (no plugin needed). */
export function rowsToPdfBlob(rows: Row[], title?: string): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = margin;

  if (title) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(title, margin, y); y += 22;
  }

  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const usableW = pageW - margin * 2;
  const colW = cols.length ? usableW / cols.length : usableW;
  const lineH = 16;

  const fit = (text: string): string => {
    const max = Math.max(1, Math.floor(colW / 5)); // ~5pt per char at size 9
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };

  const drawRow = (cells: string[], bold: boolean) => {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    cells.forEach((c, i) => doc.text(fit(String(c ?? '')), margin + i * colW + 2, y));
    y += lineH;
    doc.setDrawColor(230); doc.line(margin, y - lineH + 4, pageW - margin, y - lineH + 4);
  };

  if (cols.length) drawRow(cols, true);
  for (const r of rows) drawRow(cols.map((c) => String(r[c] ?? '')), false);
  if (!rows.length) { doc.setFontSize(10); doc.text('No data', margin, y); }

  return doc.output('blob');
}

function ensureExt(name: string, ext: string): string {
  const base = name.replace(/\.(xlsx|csv|pdf)$/i, '');
  return `${base}.${ext}`;
}

/** Legacy Program Builder path: xlsx/csv download. Unchanged behaviour. */
export function downloadRows(rows: Row[], output: OutputConfig): void {
  const blob = rowsToBlob(rows, output.format);
  downloadBlob(blob, ensureExt(output.fileName, output.format));
}

/** Mini Program export: any format, optional save-to-folder (with download fallback). */
export async function saveRows(
  rows: Row[],
  fileName: string,
  format: AnyFormat,
  folder?: FolderTarget | null,
  subpath?: string,
): Promise<void> {
  const blob = rowsToBlob(rows, format);
  await saveBlob(blob, ensureExt(fileName, format), folder, subpath);
}
