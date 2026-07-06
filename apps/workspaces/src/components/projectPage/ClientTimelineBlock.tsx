'use client';

// Client detail page block: unified reverse-chronological feed of emails,
// invoices, and KPI results for a single client (D-12). No filter tabs — a
// single merged feed per the UI-SPEC's explicit "no tabs/filters" contract.

import { Loader2, Mail, Receipt, BarChart3 } from 'lucide-react';
import type { ClientTimelineBlock } from '@/lib/projectPage/blocks';
import { useClientTimeline } from '@/lib/hooks/useCrm';
import type { ClientTimelineEntry } from '@/lib/api/crm.api';

const ENTRY_ICON: Record<ClientTimelineEntry['type'], typeof Mail> = {
  email: Mail,
  invoice: Receipt,
  kpi: BarChart3,
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function ClientTimelineBlockView({
  block, clientId,
}: { block: ClientTimelineBlock; clientId: string }) {
  const { data: timeline, isLoading } = useClientTimeline(clientId);
  const entries = timeline ?? [];

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <BarChart3 className="w-6 h-6 text-gray-300" />
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">No activity yet</p>
          <p className="text-xs text-center max-w-sm">
            Emails, invoices, and other client activity will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {entries.map((e) => {
            const Icon = ENTRY_ICON[e.type];
            return (
              <div key={`${e.type}-${e.id}`} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
                <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-200 truncate flex-1">{e.summary}</span>
                <span className="text-gray-400 flex-shrink-0">{formatTimestamp(e.occurred_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
