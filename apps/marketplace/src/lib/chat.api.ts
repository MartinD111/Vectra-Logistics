import { apiFetch } from '@vectra/api-client';

export interface ChatMessage {
  id: string;
  thread_id: string;
  shipment_id?: string | null;
  booking_id?: string | null;
  sender_id: string;
  sender_name?: string | null;
  body: string;
  created_at: string;
}

const BASE = '/api/v1/chat';

export const chatApi = {
  listMessages: (threadId: string) =>
    apiFetch<ChatMessage[]>(`${BASE}/threads/${threadId}/messages`),

  sendMessage: (threadId: string, body: string) =>
    apiFetch<ChatMessage>(`${BASE}/threads/${threadId}/messages`, 'POST', { body }),

  /**
   * Convenience: return-or-create a thread for a shipment. Backend should
   * return the same thread on subsequent calls.
   */
  threadForShipment: (shipmentId: string) =>
    apiFetch<{ thread_id: string }>(`${BASE}/threads/by-shipment/${shipmentId}`, 'POST'),
};
