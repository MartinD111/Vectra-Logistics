import { apiFetch } from './client';

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

const BASE = '/api/v1/notifications';

export const notificationsApi = {
  list: () => apiFetch<NotificationRecord[]>(BASE),
  unreadCount: () => apiFetch<{ count: number }>(`${BASE}/unread-count`),
  markRead: (id: string) => apiFetch<void>(`${BASE}/${id}/read`, 'POST'),
  markAllRead: () => apiFetch<void>(`${BASE}/read-all`, 'POST'),
};
