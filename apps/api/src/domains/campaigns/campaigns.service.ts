import crypto from 'crypto';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { campaignsRepository } from './campaigns.repository';
import { outlookService } from '../outlook/outlook.service';
import { EmailCampaignWithStats, EmailCampaignDetail } from './campaigns.types';
import { CreateCampaignSchema } from './dto/campaign.dto';

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:8080';

class CampaignsService {
  async listCampaigns(companyId: string, projectId?: string): Promise<EmailCampaignWithStats[]> {
    return campaignsRepository.listCampaigns(companyId, projectId);
  }

  async getCampaign(id: string, companyId: string): Promise<EmailCampaignDetail> {
    const detail = await campaignsRepository.getCampaignDetail(id);
    if (!detail || detail.company_id !== companyId) throw new AppError(404, 'Campaign not found');
    return detail;
  }

  /**
   * Create a campaign, record one tracking token per recipient, then send via
   * the connected mailbox's Graph sendMail. If Outlook isn't connected (or is
   * in demo mode), recipients are still created — with send_error set — so the
   * tracking-pixel flow can be exercised without a real mailbox connected.
   */
  async createAndSend(
    companyId: string, projectId: string | null, actorId: string | null, body: unknown,
  ): Promise<EmailCampaignWithStats> {
    const parsed = CreateCampaignSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.project_id) {
      const projectCompanyId = await campaignsRepository.findProjectCompany(parsed.data.project_id);
      if (!projectCompanyId) throw new AppError(404, 'Project not found');
      if (projectCompanyId !== companyId) throw new AppError(403, 'Forbidden');
    }

    const campaign = await campaignsRepository.createCampaign(
      companyId, parsed.data.project_id ?? projectId ?? null, actorId, parsed.data.subject, parsed.data.body_html,
    );
    const recipients = await campaignsRepository.addRecipients(
      campaign.id,
      parsed.data.recipients.map((email) => ({ email, token: crypto.randomBytes(16).toString('hex') })),
    );

    const token = await outlookService.getFreshAccessToken(companyId);

    for (const r of recipients) {
      const pixel = `<img src="${API_PUBLIC_URL}/api/v1/campaigns/track/open/${r.token}" width="1" height="1" alt="" style="display:none" />`;
      const html = `${parsed.data.body_html}${pixel}`;

      if (!token) {
        await campaignsRepository.markSendError(r.id, 'Outlook not connected');
        continue;
      }
      try {
        const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              subject: parsed.data.subject,
              body: { contentType: 'HTML', content: html },
              toRecipients: [{ emailAddress: { address: r.email } }],
            },
          }),
        });
        if (res.ok) {
          await campaignsRepository.markSent(r.id);
        } else {
          await campaignsRepository.markSendError(r.id, `Graph sendMail failed (${res.status})`);
        }
      } catch (err) {
        await campaignsRepository.markSendError(r.id, (err as Error).message);
      }
    }

    await recordEvent({
      tenantId: companyId, actorId, verb: 'email_campaign.sent',
      objectType: 'email_campaign', objectId: campaign.id, projectId: campaign.project_id,
      payload: { subject: campaign.subject, recipient_count: recipients.length },
    });

    const [withStats] = await campaignsRepository.listCampaigns(companyId).then(
      (all) => all.filter((c) => c.id === campaign.id),
    );
    return withStats;
  }

  /**
   * Tracking-pixel hit. Best-effort — never throws, since the caller always
   * needs to return a 1x1 gif regardless of whether the token was valid.
   */
  async recordOpen(token: string): Promise<void> {
    try {
      const recipient = await campaignsRepository.findRecipientByToken(token);
      if (!recipient) return;
      await campaignsRepository.recordOpen(recipient.recipient_id);
      await recordEvent({
        tenantId: recipient.company_id, verb: 'email.opened',
        objectType: 'email_campaign', objectId: recipient.campaign_id, projectId: recipient.project_id,
        payload: { email: recipient.email },
      });
    } catch (err) {
      console.error('[campaigns] failed to record open', (err as Error).message);
    }
  }
}

export const campaignsService = new CampaignsService();
