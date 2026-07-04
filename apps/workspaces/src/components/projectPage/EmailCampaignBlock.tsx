'use client';

// Composer + sent-campaign list for the `email-campaign` page block. Sends go
// through the connected Outlook mailbox (Mail.Send scope); each recipient gets
// a unique tracking-pixel URL appended to the HTML body, so opens are logged
// to activity_events even for recipients outside the company's tenant.

import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Mail, Loader2, Send, CheckCircle2, Eye } from 'lucide-react';
import { useCampaigns, useCreateCampaign } from '@/lib/hooks/useCampaigns';
import { useOutlookStatus } from '@/lib/hooks/useOutlook';

export function EmailCampaignView({ projectId }: { projectId: string }) {
  const { data: status } = useOutlookStatus();
  const { data: campaigns, isLoading } = useCampaigns(projectId);
  const create = useCreateCampaign(projectId);

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p>Hi,</p>');
  const [recipientsText, setRecipientsText] = useState('');
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const recipients = recipientsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!subject.trim() || recipients.length === 0) return;
    const campaign = await create.mutateAsync({
      project_id: projectId,
      subject: subject.trim(),
      body_html: DOMPurify.sanitize(bodyHtml),
      recipients,
    });
    setSentNotice(`Queued for ${campaign.recipient_count} recipient(s).`);
    setSubject(''); setBodyHtml('<p>Hi,</p>'); setRecipientsText(''); setOpen(false);
    setTimeout(() => setSentNotice(null), 4000);
  }

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Mail className="w-4 h-4 text-gray-400" /> Email campaigns
        </h3>
        <button onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline">
          <Send className="w-3.5 h-3.5" /> New campaign
        </button>
      </div>

      {status && !status.connected && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
          Outlook isn&apos;t connected — campaigns will be created but not actually sent. Connect it in Settings → Integrations.
        </p>
      )}
      {sentNotice && (
        <p className="text-xs text-primary-600 mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {sentNotice}</p>
      )}

      {open && (
        <form onSubmit={send} className="space-y-2 mb-4 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
          <input className="saas-input !py-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject" autoFocus />
          <textarea className="saas-input text-sm font-mono" rows={4} value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)} placeholder="<p>HTML body…</p>" />
          <textarea className="saas-input text-xs" rows={3} value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="Recipient emails — one per line or comma-separated" />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={create.isPending || !subject.trim() || !recipientsText.trim()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-xs font-semibold">
              {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (campaigns ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No campaigns sent for this project yet.</p>
      ) : (
        <div className="space-y-2">
          {(campaigns ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
              <span className="text-gray-700 dark:text-gray-200 truncate">{c.subject}</span>
              <span className="text-gray-400 flex-shrink-0 flex items-center gap-1">
                <Eye className="w-3 h-3" /> {c.opened_count}/{c.sent_count} opened · {c.recipient_count} recipient(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
