import { apiFetch } from './client';

export type ChatChannel = 'internal' | 'whatsapp' | 'email';

export interface ChatMessage {
  id: string;
  thread_id: string;
  shipment_id: string | null;
  booking_id: string | null;
  sender_id: string;
  sender_name: string | null;
  body: string;
  channel: ChatChannel;
  created_at: string;
}

const BASE = '/api/v1/chat';

export const chatApi = {
  /** Get-or-create the omnichannel thread attached to a project. */
  threadByProject: (projectId: string) =>
    apiFetch<{ thread_id: string }>(`${BASE}/threads/by-project/${projectId}`, 'POST').then((r) => r.thread_id),
  listMessages: (threadId: string) =>
    apiFetch<ChatMessage[]>(`${BASE}/threads/${threadId}/messages`),
  sendMessage: (threadId: string, body: string, channel: ChatChannel = 'internal') =>
    apiFetch<ChatMessage>(`${BASE}/threads/${threadId}/messages`, 'POST', { body, channel }),
};
