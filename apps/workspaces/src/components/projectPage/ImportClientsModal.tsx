'use client';

// Bulk client import modal — sibling to AddClientModal's single-add flow.
// Upload -> parse (client-side xlsx) -> preview -> confirm -> per-row report.
// Mirrors AddClientModal's overlay/card shell and ExcelAutomationTool.tsx's
// xlsx parsing mechanics (see 04-PATTERNS.md).

import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { X, Download, UploadCloud, CheckCircle2 } from 'lucide-react';
import { useImportClients } from '@/lib/hooks/useCrm';
import type { ImportClientsResult } from '@/lib/api/crm.api';

const TEMPLATE_COLUMNS = [
  'name',
  'country',
  'vat_id',
  'address',
  'responsible_employee',
  'credit_limit',
  'default_rate_eur',
] as const;

type Step = 'upload' | 'preview' | 'report';

interface ImportClientsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportClientsModal({ open, onClose }: ImportClientsModalProps) {
  const importClients = useImportClients();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [report, setReport] = useState<ImportClientsResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const resetAll = () => {
    setStep('upload');
    setRows([]);
    setReport(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const downloadTemplate = () => {
    const ws = xlsx.utils.json_to_sheet([
      {
        name: '',
        country: '',
        vat_id: '',
        address: '',
        responsible_employee: '',
        credit_limit: '',
        default_rate_eur: '',
      },
    ]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Clients');
    xlsx.writeFile(wb, 'client-import-template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = xlsx.read(data, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const parsedRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
      setRows(parsedRows);
      setStep('preview');
    };
    reader.readAsArrayBuffer(uploadedFile);
    // allow re-selecting the same file later
    e.target.value = '';
  };

  const confirmImport = () => {
    const payload = rows.map((row) => {
      const { responsible_employee, credit_limit, default_rate_eur, ...rest } = row;
      const mapped: Record<string, unknown> = {
        ...rest,
        responsible_employee_email: responsible_employee,
      };
      if (credit_limit !== undefined && credit_limit !== '' && credit_limit !== null) {
        mapped.credit_limit = Number(credit_limit);
      }
      if (default_rate_eur !== undefined && default_rate_eur !== '' && default_rate_eur !== null) {
        mapped.default_rate_eur = Number(default_rate_eur);
      }
      return mapped;
    });

    importClients.mutate(payload, {
      onSuccess: (result) => {
        setReport(result);
        setStep('report');
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="saas-card max-w-3xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import clients from Excel</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-slate-800/50">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Download the template, fill in your client rows, then upload it below.
              </div>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Download template
              </button>
            </div>

            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <div
              className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center text-center hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-primary-500 dark:hover:border-primary-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="w-8 h-8 text-primary-500 mb-2" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Click to upload your filled .xlsx file</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only .xlsx files are supported</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {rows.length} row{rows.length === 1 ? '' : 's'} parsed. Review before confirming.
            </p>
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-dark-border sticky top-0">
                  <tr>
                    {TEMPLATE_COLUMNS.map((col) => (
                      <th key={col} className="p-2 font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-dark-border last:border-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      {TEMPLATE_COLUMNS.map((col) => (
                        <td key={col} className="p-2 text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-dark-border last:border-0 truncate max-w-[160px]">
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-1">
              <button
                onClick={() => setStep('upload')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                onClick={confirmImport}
                disabled={importClients.isPending || rows.length === 0}
                className="px-4 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
              >
                {importClients.isPending ? 'Importing…' : 'Confirm import'}
              </button>
            </div>
          </div>
        )}

        {step === 'report' && report && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {report.created} created, {report.failed} failed
            </div>
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-dark-border sticky top-0">
                  <tr>
                    <th className="p-2 font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-dark-border">Row</th>
                    <th className="p-2 font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-dark-border">Status</th>
                    <th className="p-2 font-bold text-gray-700 dark:text-gray-300">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {report.results.map((r) => (
                    <tr key={r.row} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="p-2 text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-dark-border">{r.row}</td>
                      <td className="p-2 border-r border-gray-100 dark:border-dark-border">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.status === 'created'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500 dark:text-gray-400">
                        {r.status === 'created' ? r.client?.name ?? '' : r.reason ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-1">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
