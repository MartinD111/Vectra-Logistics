'use client';

import { useEffect, useState } from 'react';
import {
  subscribeToSmartActions,
  dismissSmartActions,
  SmartActionsToast as ToastState,
} from '../hooks/useAssignmentNotifier';

// ── Icons (inline SVG — no icon library dep) ──────────────────────────────────

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartActionsToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => subscribeToSmartActions(setToast), []);

  if (!toast) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100/60 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-indigo-600 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-white">
          {toast.aiGenerated && <SparkleIcon />}
          <span className="text-sm font-semibold">
            {toast.aiGenerated ? 'AI Smart Actions' : 'Smart Actions'}
          </span>
          {toast.aiGenerated && (
            <span className="ml-1 rounded-full bg-indigo-500/60 px-1.5 py-0.5 text-[10px] font-medium text-indigo-100">
              Gemini
            </span>
          )}
        </div>
        <button
          onClick={dismissSmartActions}
          className="rounded p-0.5 text-indigo-200 transition-colors hover:bg-indigo-500 hover:text-white"
          aria-label="Dismiss"
        >
          <XIcon />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="mb-3 text-xs text-slate-500">
          Assignment confirmed. Notify stakeholders now:
        </p>

        <div className="flex flex-col gap-2">
          {/* WhatsApp */}
          {toast.whatsappUrl ? (
            <a
              href={toast.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <PhoneIcon />
              WhatsApp Driver
              {toast.whatsappPhone && (
                <span className="ml-auto text-xs font-normal text-emerald-500 tabular-nums">
                  {toast.whatsappPhone}
                </span>
              )}
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
              <PhoneIcon />
              <span>No driver phone on file</span>
            </div>
          )}

          {/* Email */}
          <a
            href={toast.mailtoUrl}
            className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <MailIcon />
            Email Client (Outlook)
            <span className="ml-auto text-xs font-normal text-indigo-400 truncate max-w-[100px]" title={toast.subject}>
              {toast.subject.split(':')[0]}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
