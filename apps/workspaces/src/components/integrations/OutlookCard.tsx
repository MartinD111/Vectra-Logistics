'use client';

import { Mail, CheckCircle2, Loader2, Plug, Unplug, Info } from 'lucide-react';
import { useOutlookStatus, useConnectOutlook, useDisconnectOutlook } from '@/lib/hooks/useOutlook';

export default function OutlookCard() {
  const { data: status, isLoading } = useOutlookStatus();
  const connect = useConnectOutlook();
  const disconnect = useDisconnectOutlook();

  const connected = status?.connected ?? false;

  return (
    <div className="saas-card mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Outlook / Microsoft 365</h3>
              {connected && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
              {status?.demo && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  DEMO
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
              Connect a mailbox so programs and automations can read and send Outlook email
              (e.g. watch an inbox for files, send generated documents).
            </p>
            {connected && status?.email && (
              <p className="text-xs text-gray-500 mt-2">Mailbox: <span className="font-medium text-gray-700 dark:text-gray-300">{status.email}</span></p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : connected ? (
            <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
              {disconnect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />} Disconnect
            </button>
          ) : (
            <button onClick={() => connect.mutate()} disabled={connect.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold disabled:opacity-60">
              {connect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Connect Outlook
            </button>
          )}
        </div>
      </div>

      {status?.demo && !connected && (
        <p className="mt-4 text-xs text-gray-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Demo mode: connecting simulates a link. Add a Microsoft Entra app registration
          (MS_CLIENT_ID / MS_CLIENT_SECRET / MS_REDIRECT_URI) to enable the real OAuth sign-in.
        </p>
      )}
    </div>
  );
}
