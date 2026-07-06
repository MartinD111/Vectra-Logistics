import { db } from '../../core/db';

export interface UpsertEmailMessageInput {
  client_id: string;
  outlook_id: string;
  sender_email: string;
  recipient_emails: string[];
  subject: string;
  body_preview: string | null;
  received_at: string; // ISO
  is_draft: boolean;
}

class EmailRepository {
  async upsertMessages(companyId: string, messages: UpsertEmailMessageInput[]): Promise<void> {
    for (const m of messages) {
      await db.query(
        `INSERT INTO email_messages
           (company_id, client_id, outlook_id, sender_email, recipient_emails, subject, body_preview, received_at, is_draft, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (company_id, outlook_id, client_id)
         DO UPDATE SET sender_email = EXCLUDED.sender_email, recipient_emails = EXCLUDED.recipient_emails,
                        subject = EXCLUDED.subject, body_preview = EXCLUDED.body_preview,
                        received_at = EXCLUDED.received_at, is_draft = EXCLUDED.is_draft,
                        synced_at = NOW()`,
        [
          companyId, m.client_id, m.outlook_id, m.sender_email, m.recipient_emails,
          m.subject, m.body_preview, m.received_at, m.is_draft,
        ],
      );
    }
  }
}

export const emailRepository = new EmailRepository();
