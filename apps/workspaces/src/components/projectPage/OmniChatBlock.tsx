'use client';

// Omnichannel chat block: one unified thread per project aggregating internal,
// WhatsApp and email messages, live over the socket. When the block is set to
// auto-translate, each incoming message from another sender is translated to
// the dispatcher's chosen language via the AI domain (demo fallback marked).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessagesSquare, Send, Languages } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { OmniChatBlock as OmniChatBlockType } from '@/lib/projectPage/blocks';
import {
  useProjectThread, useChatMessages, useSendChatMessage, useTranslateMessage,
} from '@/lib/hooks/useProjectChat';
import type { ChatChannel, ChatMessage } from '@/lib/api/chat.api';

const CHANNEL_STYLE: Record<ChatChannel, { label: string; cls: string }> = {
  internal: { label: 'Internal', cls: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  email: { label: 'Email', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
};

function MessageBubble({ msg, mine, translateTo }: {
  msg: ChatMessage; mine: boolean; translateTo: string;
}) {
  const translate = useTranslateMessage();
  const [translated, setTranslated] = useState<{ text: string; demo: boolean } | null>(null);
  const channel = CHANNEL_STYLE[msg.channel] ?? CHANNEL_STYLE.internal;

  // Auto-translate incoming messages (not my own) when the block is configured.
  useEffect(() => {
    if (!translateTo || mine || translated) return;
    let cancelled = false;
    translate.mutate({ text: msg.body, targetLang: translateTo }, {
      onSuccess: (r) => { if (!cancelled) setTranslated({ text: r.translated, demo: r.demo }); },
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateTo, mine, msg.body]);

  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine
        ? 'bg-primary-600 text-white rounded-br-sm'
        : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'}`}>
        {!mine && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold opacity-70">{msg.sender_name ?? 'Unknown'}</span>
            <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full ${channel.cls}`}>{channel.label}</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        {translated && (
          <p className={`text-xs mt-1 pt-1 border-t ${mine ? 'border-white/20' : 'border-gray-300 dark:border-slate-600'} italic opacity-90`}>
            <Languages className="w-3 h-3 inline mr-1" />
            {translated.text}{translated.demo && <span className="not-italic opacity-60"> (demo)</span>}
          </p>
        )}
      </div>
      <span className="text-[9px] text-gray-400 mt-0.5 px-1">
        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export function OmniChatView({ block, projectId }: { block: OmniChatBlockType; projectId: string }) {
  const { user } = useAuth();
  const { data: threadId, isLoading: threadLoading } = useProjectThread(projectId);
  const { data: messages, isLoading } = useChatMessages(threadId);
  const send = useSendChatMessage(threadId);
  const [draft, setDraft] = useState('');
  const [channel, setChannel] = useState<ChatChannel>('internal');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => messages ?? [], [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [ordered.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || !threadId) return;
    send.mutate({ body, channel });
    setDraft('');
  };

  return (
    <div className="saas-card !p-4 flex flex-col" style={{ height: 420 }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <MessagesSquare className="w-4 h-4 text-gray-400" /> {block.title || 'Chat'}
        </h3>
        {block.translateTo && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
            title={`Incoming messages auto-translated to ${block.translateTo}.`}>
            <Languages className="w-3 h-3" /> {block.translateTo}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {threadLoading || isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading chat…</div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
            <MessagesSquare className="w-6 h-6" />
            <p className="text-xs">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          ordered.map((m) => <MessageBubble key={m.id} msg={m} mine={m.sender_id === user?.id} translateTo={block.translateTo} />)
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <select value={channel} onChange={(e) => setChannel(e.target.value as ChatChannel)}
          className="saas-input !py-1.5 !px-2 text-xs w-24 flex-shrink-0" title="Send as channel">
          <option value="internal">Internal</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Type a message…" disabled={!threadId}
          className="saas-input !py-1.5 text-sm flex-1" />
        <button onClick={submit} disabled={!draft.trim() || send.isPending || !threadId}
          className="p-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 flex-shrink-0">
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
