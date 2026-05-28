'use client';

import { useRef, useState } from 'react';
import { AlertCircle, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { useUploadDocument } from '@/lib/hooks/useDocuments';
import {
  DOC_TYPE_LABELS,
  type DocumentSubject,
  type DocumentType,
} from '@/lib/api/documents.api';
import { ApiError } from '@/lib/api/client';

interface Props {
  subject: DocumentSubject;
  subjectId?: string;
  /** Document types selectable in this widget. Default: ['other']. */
  allowedTypes?: (DocumentType | string)[];
  /** When true, the uploader hides the type selector and forces this type. */
  fixedType?: DocumentType | string;
  /** Accept attribute for the file input. */
  accept?: string;
  /** Max file size in MB (default 10). */
  maxSizeMb?: number;
  /** Optional label override. */
  label?: string;
  /** Show expiry/issued date inputs. */
  showDates?: boolean;
  /** Called after a successful upload. */
  onUploaded?: () => void;
}

export default function FileUploader({
  subject,
  subjectId,
  allowedTypes = ['other'],
  fixedType,
  accept = '.pdf,.png,.jpg,.jpeg',
  maxSizeMb = 10,
  label,
  showDates = false,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(fixedType ?? allowedTypes[0] ?? 'other');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.size > maxSizeMb * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMb} MB limit.`);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError('Please select a file.'); return; }

    try {
      await upload.mutateAsync({
        subject,
        subjectId,
        documentType: docType,
        file,
        issuedAt: issuedAt || undefined,
        expiresAt: expiresAt || undefined,
      });
      setFile(null); setIssuedAt(''); setExpiresAt('');
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {label && (
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</h3>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <UploadCloud className="w-7 h-7 text-slate-400 mx-auto mb-2" />
        {file ? (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {file.name} <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Click or drop file
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{accept} · up to {maxSizeMb} MB</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {!fixedType && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
              Type
            </label>
            <select
              className="saas-input py-2 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {allowedTypes.map((t) => (
                <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>
              ))}
            </select>
          </div>
        )}
        {showDates && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Issued</label>
              <input type="date" className="saas-input py-2 text-sm" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Expires</label>
              <input type="date" className="saas-input py-2 text-sm" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || upload.isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
      >
        {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
        {upload.isPending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
