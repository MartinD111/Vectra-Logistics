'use client';

import Link from 'next/link';
import { AlertTriangle, FileText, Loader2, Trash2 } from 'lucide-react';
import {
  DOC_TYPE_LABELS,
  expiresWithinDays,
  isExpired,
  type DocumentSubject,
} from '@/lib/api/documents.api';
import { useDeleteDocument, useDocuments } from '@/lib/hooks/useDocuments';

interface Props {
  subject: DocumentSubject;
  subjectId?: string;
  emptyMessage?: string;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

function absoluteUrl(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

export default function DocumentList({ subject, subjectId, emptyMessage }: Props) {
  const { data, isLoading, error } = useDocuments(subject, subjectId);
  const del = useDeleteDocument(subject, subjectId);

  if (isLoading) {
    return (
      <p className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">Failed to load documents.</p>;
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        {emptyMessage ?? 'No documents uploaded yet.'}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {data.map((d) => {
        const expired = isExpired(d);
        const expiring = !expired && expiresWithinDays(d, 30);
        return (
          <li key={d.id} className="py-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={absoluteUrl(d.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline truncate max-w-xs"
                >
                  {d.file_name ?? DOC_TYPE_LABELS[d.document_type] ?? d.document_type}
                </Link>
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {DOC_TYPE_LABELS[d.document_type] ?? d.document_type}
                </span>
                {expired && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50">
                    <AlertTriangle className="w-3 h-3" /> Expired
                  </span>
                )}
                {expiring && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                    <AlertTriangle className="w-3 h-3" /> Expires soon
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Uploaded {fmtDate(d.created_at)} · Expires {fmtDate(d.expires_at)}
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Delete this document?')) del.mutate(d.id);
              }}
              disabled={del.isPending}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
