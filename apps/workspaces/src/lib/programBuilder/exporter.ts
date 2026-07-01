import * as xlsx from 'xlsx';
import type { Row, OutputConfig } from './types';

/** Turn transformed rows into a downloadable Excel or CSV file. */
export function downloadRows(rows: Row[], output: OutputConfig): void {
  const ws = xlsx.utils.json_to_sheet(rows);

  if (output.format === 'csv') {
    const csv = xlsx.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, ensureExt(output.fileName, 'csv'));
    return;
  }

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Output');
  const out = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/octet-stream' });
  triggerDownload(blob, ensureExt(output.fileName, 'xlsx'));
}

function ensureExt(name: string, ext: string): string {
  const base = name.replace(/\.(xlsx|csv)$/i, '');
  return `${base}.${ext}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
