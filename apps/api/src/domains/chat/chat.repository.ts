import { db } from '../../core/db';

export interface ChatThread {
  id: string;
  shipment_id: string | null;
  booking_id: string | null;
  created_at: Date;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  shipment_id: string | null;
  booking_id: string | null;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: Date;
}

class ChatRepository {
  /**
   * Schema:
   *
   *   CREATE TABLE IF NOT EXISTS chat_threads (
   *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   *     shipment_id  UUID UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
   *     booking_id   UUID,
   *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   *   );
   *
   *   CREATE TABLE IF NOT EXISTS chat_messages (
   *     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   *     thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
   *     sender_id   UUID NOT NULL REFERENCES users(id),
   *     body        TEXT NOT NULL,
   *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   *   );
   *   CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages (thread_id, created_at);
   *
   *   CREATE TABLE IF NOT EXISTS chat_thread_participants (
   *     thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
   *     user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   *     PRIMARY KEY (thread_id, user_id)
   *   );
   */

  async findThreadByShipment(shipmentId: string): Promise<ChatThread | null> {
    const { rows } = await db.query<ChatThread>(
      `SELECT * FROM chat_threads WHERE shipment_id = $1 LIMIT 1`,
      [shipmentId],
    );
    return rows[0] ?? null;
  }

  async createThreadForShipment(shipmentId: string): Promise<ChatThread> {
    const { rows } = await db.query<ChatThread>(
      `INSERT INTO chat_threads (shipment_id) VALUES ($1)
       ON CONFLICT (shipment_id) DO UPDATE SET shipment_id = EXCLUDED.shipment_id
       RETURNING *`,
      [shipmentId],
    );
    return rows[0];
  }

  async addParticipant(threadId: string, userId: string): Promise<void> {
    await db.query(
      `INSERT INTO chat_thread_participants (thread_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [threadId, userId],
    );
  }

  async isParticipant(threadId: string, userId: string): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT 1 FROM chat_thread_participants WHERE thread_id = $1 AND user_id = $2 LIMIT 1`,
      [threadId, userId],
    );
    return rows.length > 0;
  }

  async getParticipants(threadId: string): Promise<string[]> {
    const { rows } = await db.query<{ user_id: string }>(
      `SELECT user_id FROM chat_thread_participants WHERE thread_id = $1`,
      [threadId],
    );
    return rows.map((r) => r.user_id);
  }

  async listMessages(threadId: string): Promise<ChatMessage[]> {
    const { rows } = await db.query<ChatMessage>(
      `SELECT m.id, m.thread_id, t.shipment_id, t.booking_id,
              m.sender_id, (u.first_name || ' ' || u.last_name) AS sender_name,
              m.body, m.created_at
       FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = $1 ORDER BY m.created_at ASC LIMIT 500`,
      [threadId],
    );
    return rows;
  }

  async insertMessage(threadId: string, senderId: string, body: string): Promise<ChatMessage> {
    const { rows } = await db.query<ChatMessage>(
      `WITH inserted AS (
         INSERT INTO chat_messages (thread_id, sender_id, body)
         VALUES ($1, $2, $3) RETURNING *
       )
       SELECT i.id, i.thread_id, t.shipment_id, t.booking_id,
              i.sender_id, (u.first_name || ' ' || u.last_name) AS sender_name,
              i.body, i.created_at
       FROM inserted i
       JOIN chat_threads t ON t.id = i.thread_id
       LEFT JOIN users u ON u.id = i.sender_id`,
      [threadId, senderId, body],
    );
    return rows[0];
  }
}

export const chatRepository = new ChatRepository();
