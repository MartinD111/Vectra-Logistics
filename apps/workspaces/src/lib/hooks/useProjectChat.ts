'use client';

// Omnichannel project chat: one thread per project, live over the socket
// (room 'chat:{threadId}'), with optional per-message auto-translate via the
// AI domain (demo-marked fallback when no provider is configured).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, useSocketRoom, type ChatMessageEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import { chatApi, type ChatChannel, type ChatMessage } from '@/lib/api/chat.api';
import { aiApi } from '@/lib/api/ai.api';

export function useProjectThread(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-chat-thread', projectId],
    queryFn: () => chatApi.threadByProject(projectId),
    enabled: !!user?.company_id && !!projectId,
    staleTime: Infinity,
  });
}

export function useChatMessages(threadId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  useSocketRoom(threadId ? `chat:${threadId}` : null);
  useSocketEvent<ChatMessageEvent>('chat:message', (msg) => {
    if (!threadId || msg.thread_id !== threadId) return;
    qc.setQueryData<ChatMessage[]>(['chat-messages', threadId], (prev) => {
      if (!prev) return prev;
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg as unknown as ChatMessage];
    });
  });

  return useQuery({
    queryKey: ['chat-messages', threadId],
    queryFn: () => chatApi.listMessages(threadId as string),
    enabled: !!user?.company_id && !!threadId,
  });
}

export function useSendChatMessage(threadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, channel }: { body: string; channel?: ChatChannel }) =>
      chatApi.sendMessage(threadId as string, body, channel ?? 'internal'),
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(['chat-messages', threadId], (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
  });
}

export function useTranslateMessage() {
  return useMutation({
    mutationFn: ({ text, targetLang }: { text: string; targetLang: string }) =>
      aiApi.translate(text, targetLang),
  });
}
