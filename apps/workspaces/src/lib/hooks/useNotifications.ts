'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type NotificationRecord } from '@/lib/api/notifications.api';
import { useSocketEvent } from './useSocket';
import type { NotificationEvent } from '@/lib/socket';

const QK = {
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
};

export function useNotifications() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: QK.list, queryFn: notificationsApi.list });

  useSocketEvent<NotificationEvent>('notification:new', (n) => {
    // Optimistically prepend the new notification.
    qc.setQueryData<NotificationRecord[]>(QK.list, (prev) => {
      const record: NotificationRecord = {
        id: n.id,
        user_id: '',
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        is_read: false,
        created_at: n.created_at,
      };
      return prev ? [record, ...prev] : [record];
    });
    qc.invalidateQueries({ queryKey: QK.unread });
  });

  return query;
}

export function useUnreadCount() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QK.unread,
    queryFn: notificationsApi.unreadCount,
    staleTime: 30_000,
  });
  useSocketEvent('notification:new', () => {
    qc.setQueryData<{ count: number }>(QK.unread, (prev) =>
      ({ count: (prev?.count ?? 0) + 1 }));
  });
  return query;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (_, id) => {
      qc.setQueryData<NotificationRecord[]>(QK.list, (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? prev);
      qc.invalidateQueries({ queryKey: QK.unread });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.setQueryData<NotificationRecord[]>(QK.list, (prev) =>
        prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
      qc.setQueryData<{ count: number }>(QK.unread, { count: 0 });
    },
  });
}
