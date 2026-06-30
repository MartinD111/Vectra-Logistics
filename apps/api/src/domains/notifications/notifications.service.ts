import { emitToUser } from '../../core/realtime/bus';
import { notificationsRepository, NotificationRecord } from './notifications.repository';

class NotificationsService {
  list(userId: string): Promise<NotificationRecord[]> {
    return notificationsRepository.list(userId);
  }

  unreadCount(userId: string): Promise<number> {
    return notificationsRepository.unreadCount(userId);
  }

  /**
   * Create + deliver. Other services call this to notify a user.
   */
  async create(input: { userId: string; type: string; title: string; body?: string; link?: string }): Promise<NotificationRecord> {
    const record = await notificationsRepository.insert(input);
    emitToUser(input.userId, 'notification:new', {
      id: record.id,
      type: record.type,
      title: record.title,
      body: record.body,
      link: record.link,
      created_at: record.created_at,
    });
    return record;
  }

  markRead(id: string, userId: string): Promise<boolean> {
    return notificationsRepository.markRead(id, userId);
  }

  markAllRead(userId: string): Promise<void> {
    return notificationsRepository.markAllRead(userId);
  }
}

export const notificationsService = new NotificationsService();
