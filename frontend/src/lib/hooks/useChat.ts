'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi, type ChatMessage } from '@/lib/api/chat.api';
import { useSocketEvent, useSocketRoom } from './useSocket';
import type { ChatMessageEvent } from '@/lib/socket';

const QK = {
  thread: (id: string) => ['chat', 'thread', id] as const,
  shipmentThread: (id: string) => ['chat', 'shipment-thread', id] as const,
};

export function useShipmentThread(shipmentId: string | undefined) {
  return useQuery({
    queryKey: shipmentId ? QK.shipmentThread(shipmentId) : ['chat', 'shipment-thread', 'noop'],
    queryFn: () => chatApi.threadForShipment(shipmentId!),
    enabled: !!shipmentId,
  });
}

export function useChatMessages(threadId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: threadId ? QK.thread(threadId) : ['chat', 'thread', 'noop'],
    queryFn: () => chatApi.listMessages(threadId!),
    enabled: !!threadId,
  });

  // Join socket room for real-time deliveries.
  useSocketRoom(threadId ? `chat:${threadId}` : null);

  useSocketEvent<ChatMessageEvent>('chat:message', (m) => {
    if (!threadId || m.thread_id !== threadId) return;
    qc.setQueryData<ChatMessage[]>(QK.thread(threadId), (prev) => {
      const incoming: ChatMessage = {
        id: m.id,
        thread_id: m.thread_id,
        shipment_id: m.shipment_id ?? null,
        booking_id: m.booking_id ?? null,
        sender_id: m.sender_id,
        sender_name: m.sender_name ?? null,
        body: m.body,
        created_at: m.created_at,
      };
      if (!prev) return [incoming];
      if (prev.some((p) => p.id === incoming.id)) return prev;
      return [...prev, incoming];
    });
  });

  return query;
}

export function useSendMessage(threadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => {
      if (!threadId) throw new Error('No thread selected');
      return chatApi.sendMessage(threadId, body);
    },
    onSuccess: (msg) => {
      if (!threadId) return;
      qc.setQueryData<ChatMessage[]>(QK.thread(threadId), (prev) =>
        prev ? (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]) : [msg]);
    },
  });
}
