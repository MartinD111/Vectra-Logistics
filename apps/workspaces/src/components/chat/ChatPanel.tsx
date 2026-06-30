'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChatMessages, useSendMessage, useShipmentThread } from '@/lib/hooks/useChat';
import { useSocket } from '@/lib/hooks/useSocket';

interface Props {
  shipmentId: string;
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export default function ChatPanel({ shipmentId }: Props) {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { data: thread, isLoading: threadLoading } = useShipmentThread(shipmentId);
  const threadId = thread?.thread_id;
  const { data: messages, isLoading } = useChatMessages(threadId);
  const send = useSendMessage(threadId);

  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody('');
    try { await send.mutateAsync(trimmed); } catch { setBody(trimmed); }
  }

  return (
    <div className="saas-card flex flex-col" style={{ minHeight: 380 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Chat</h2>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-400'}`} />
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-96 min-h-[200px]">
        {(threadLoading || isLoading) && (
          <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading chat…</p>
        )}
        {messages && messages.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-6">No messages yet — say hi.</p>
        )}
        {messages?.map((m) => {
          const mine = user?.id === m.sender_id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                mine
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
              }`}>
                {!mine && m.sender_name && (
                  <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.sender_name}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-slate-500'}`}>
                  {fmtTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
        <input
          className="saas-input flex-1 py-2 text-sm"
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!threadId}
        />
        <button
          type="submit"
          disabled={!body.trim() || send.isPending || !threadId}
          className="inline-flex items-center justify-center w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl"
        >
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
