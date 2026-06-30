import { db } from '../../core/db';

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

class NotificationsRepository {
  /**
   * Schema:
   *
   *   CREATE TABLE IF NOT EXISTS notifications (
   *     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   *     user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   *     type        TEXT NOT NULL,
   *     title       TEXT NOT NULL,
   *     body        TEXT,
   *     link        TEXT,
   *     is_read     BOOLEAN NOT NULL DEFAULT FALSE,
   *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   *   );
   *   CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read, created_at DESC);
   */

  async list(userId: string): Promise<NotificationRecord[]> {
    const { rows } = await db.query<NotificationRecord>(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId],
    );
    return rows;
  }

  async unreadCount(userId: string): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async insert(input: { userId: string; type: string; title: string; body?: string; link?: string }): Promise<NotificationRecord> {
    const { rows } = await db.query<NotificationRecord>(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.userId, input.type, input.title, input.body ?? null, input.link ?? null],
    );
    return rows[0];
  }

  async markRead(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
  }
}

export const notificationsRepository = new NotificationsRepository();
