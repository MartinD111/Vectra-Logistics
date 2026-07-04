import { db } from '../../core/db';
import { EmailCampaign, EmailCampaignRecipient, EmailCampaignWithStats, EmailCampaignDetail } from './campaigns.types';

class CampaignsRepository {
  async findProjectCompany(projectId: string): Promise<string | null> {
    const { rows } = await db.query<{ company_id: string }>(
      `SELECT company_id FROM projects WHERE id = $1`, [projectId],
    );
    return rows[0]?.company_id ?? null;
  }

  async createCampaign(
    companyId: string, projectId: string | null, createdBy: string | null, subject: string, bodyHtml: string,
  ): Promise<EmailCampaign> {
    const { rows } = await db.query<EmailCampaign>(
      `INSERT INTO email_campaigns (company_id, project_id, subject, body_html, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, projectId, subject, bodyHtml, createdBy],
    );
    return rows[0];
  }

  async addRecipients(campaignId: string, recipients: { email: string; token: string }[]): Promise<EmailCampaignRecipient[]> {
    const out: EmailCampaignRecipient[] = [];
    for (const r of recipients) {
      const { rows } = await db.query<EmailCampaignRecipient>(
        `INSERT INTO email_campaign_recipients (campaign_id, email, token) VALUES ($1, $2, $3) RETURNING *`,
        [campaignId, r.email, r.token],
      );
      out.push(rows[0]);
    }
    return out;
  }

  async markSent(recipientId: string): Promise<void> {
    await db.query(`UPDATE email_campaign_recipients SET sent_at = NOW(), send_error = NULL WHERE id = $1`, [recipientId]);
  }

  async markSendError(recipientId: string, error: string): Promise<void> {
    await db.query(`UPDATE email_campaign_recipients SET send_error = $2 WHERE id = $1`, [recipientId, error]);
  }

  async listCampaigns(companyId: string, projectId?: string): Promise<EmailCampaignWithStats[]> {
    const params: unknown[] = [companyId];
    let where = 'c.company_id = $1';
    if (projectId) { params.push(projectId); where += ` AND c.project_id = $${params.length}`; }
    const { rows } = await db.query<EmailCampaignWithStats>(
      `SELECT c.*,
              COUNT(r.id)::int AS recipient_count,
              COUNT(r.id) FILTER (WHERE r.sent_at IS NOT NULL)::int AS sent_count,
              COUNT(r.id) FILTER (WHERE r.open_count > 0)::int AS opened_count
       FROM email_campaigns c
       LEFT JOIN email_campaign_recipients r ON r.campaign_id = c.id
       WHERE ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      params,
    );
    return rows;
  }

  async findCampaign(id: string): Promise<EmailCampaign | null> {
    const { rows } = await db.query<EmailCampaign>(`SELECT * FROM email_campaigns WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async getCampaignDetail(id: string): Promise<EmailCampaignDetail | null> {
    const campaign = await this.findCampaign(id);
    if (!campaign) return null;
    const { rows } = await db.query<EmailCampaignRecipient>(
      `SELECT * FROM email_campaign_recipients WHERE campaign_id = $1 ORDER BY email ASC`,
      [id],
    );
    return { ...campaign, recipients: rows };
  }

  /** Recipient + enough campaign context to log an activity event, by tracking-pixel token. */
  async findRecipientByToken(token: string): Promise<{
    recipient_id: string; campaign_id: string; company_id: string; project_id: string | null; email: string;
  } | null> {
    const { rows } = await db.query<{
      recipient_id: string; campaign_id: string; company_id: string; project_id: string | null; email: string;
    }>(
      `SELECT r.id AS recipient_id, c.id AS campaign_id, c.company_id, c.project_id, r.email
       FROM email_campaign_recipients r
       JOIN email_campaigns c ON c.id = r.campaign_id
       WHERE r.token = $1`,
      [token],
    );
    return rows[0] ?? null;
  }

  async recordOpen(recipientId: string): Promise<void> {
    await db.query(
      `UPDATE email_campaign_recipients
       SET open_count = open_count + 1,
           first_opened_at = COALESCE(first_opened_at, NOW()),
           last_opened_at = NOW()
       WHERE id = $1`,
      [recipientId],
    );
  }
}

export const campaignsRepository = new CampaignsRepository();
