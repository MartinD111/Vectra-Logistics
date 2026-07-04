import { db } from '../../core/db';
import { CalendarEvent } from './outlook.types';

export interface UpsertCalendarEventInput {
  external_id: string;
  project_id: string | null;
  subject: string | null;
  start_at: string; // ISO
  end_at: string;   // ISO
  is_all_day: boolean;
  categories: string[];
  attendee_emails: string[];
}

class CalendarRepository {
  async upsertEvents(companyId: string, events: UpsertCalendarEventInput[]): Promise<void> {
    for (const e of events) {
      await db.query(
        `INSERT INTO calendar_events
           (company_id, project_id, external_id, subject, start_at, end_at, is_all_day, categories, attendee_emails, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (company_id, external_id)
         DO UPDATE SET project_id = EXCLUDED.project_id, subject = EXCLUDED.subject,
                        start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
                        is_all_day = EXCLUDED.is_all_day, categories = EXCLUDED.categories,
                        attendee_emails = EXCLUDED.attendee_emails, synced_at = NOW()`,
        [
          companyId, e.project_id, e.external_id, e.subject, e.start_at, e.end_at,
          e.is_all_day, e.categories, e.attendee_emails,
        ],
      );
    }
  }

  async listForProject(
    companyId: string, projectId: string, periodStart: string, periodEnd: string,
  ): Promise<CalendarEvent[]> {
    const { rows } = await db.query<CalendarEvent>(
      `SELECT * FROM calendar_events
       WHERE company_id = $1 AND project_id = $2 AND start_at < $4 AND end_at > $3
       ORDER BY start_at ASC`,
      [companyId, projectId, periodStart, periodEnd],
    );
    return rows;
  }

  /** Total scheduled hours for a project in a period, restricted to events the given email attended. */
  async sumProjectHoursForAttendee(
    companyId: string, projectId: string, attendeeEmail: string, periodStart: string, periodEnd: string,
  ): Promise<number> {
    const { rows } = await db.query<{ hours: string | null }>(
      `SELECT SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 3600.0) AS hours
       FROM calendar_events
       WHERE company_id = $1 AND project_id = $2 AND start_at < $4 AND end_at > $3
         AND NOT is_all_day AND $5 = ANY(attendee_emails)`,
      [companyId, projectId, periodStart, periodEnd, attendeeEmail.toLowerCase()],
    );
    return rows[0]?.hours ? parseFloat(rows[0].hours) : 0;
  }
}

export const calendarRepository = new CalendarRepository();
