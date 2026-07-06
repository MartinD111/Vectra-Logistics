'use client';

// Client detail page block: last-10-emails "current situation" summary.
// The backing endpoint (crmApi.getClientEmails) always returns [] until
// Phase 5 wires real Outlook sync — the empty state below is not a loading
// placeholder, it's the correct, permanent rendering until that phase ships.

import { Loader2, Mail } from 'lucide-react';
import type { ClientCurrentSituationBlock } from '@/lib/projectPage/blocks';
import { useClientEmails } from '@/lib/hooks/useCrm';

export function ClientCurrentSituationBlockView({
  block, clientId,
}: { block: ClientCurrentSituationBlock; clientId: string }) {
  const { data: emails, isLoading } = useClientEmails(clientId);

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
          <Mail className="w-6 h-6 text-gray-300" />
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">No emails synced yet</p>
          <p className="text-xs text-center max-w-sm">
            Sent-mail history will appear here once email sync is connected (coming in a later phase).
          </p>
        </div>
      )}
    </div>
  );
}
