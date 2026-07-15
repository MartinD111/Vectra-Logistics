import jwt from 'jsonwebtoken';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { outlookRepository } from './outlook.repository';
import { calendarRepository, type UpsertCalendarEventInput } from './calendar.repository';
import { emailRepository, type UpsertEmailMessageInput } from './email.repository';
import { matchClientsForRecipients } from './email.matcher';
import { projectsRepository } from '../projects/projects.repository';
import { crmRepository } from '../crm/crm.repository';
import { OutlookStatus, OutlookCredentials } from './outlook.types';
import { getJwtSecret } from '../../core/config/secrets';
import { buildServiceRequestContext } from '../../core/auth/request-context';
import { capabilityService } from '../../core/capabilities';

const SCOPES = 'openid profile email offline_access Mail.Read Mail.Send Calendars.Read';

// Microsoft credentials come from env. When any are missing we run in "demo
// mode": connecting simulates a successful link so the whole flow/UI works, and
// plugging in a real Entra app registration switches to the live OAuth flow with
// no code change. See docs/DEPLOYMENT.md.
function msConfig() {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const redirectUri = process.env.MS_REDIRECT_URI;
  const tenant = process.env.MS_TENANT || 'common';
  return {
    clientId, clientSecret, redirectUri, tenant,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

interface OAuthState { companyId: string; userId: string | null }

class OutlookService {
  async getStatus(companyId: string): Promise<OutlookStatus> {
    const conn = await outlookRepository.find(companyId);
    if (!conn || conn.status !== 'connected') {
      return { connected: false, email: null, connected_at: null, demo: !msConfig().configured };
    }
    return {
      connected: true,
      email: conn.creds.email,
      connected_at: conn.connected_at ? new Date(conn.connected_at).toISOString() : null,
      demo: conn.creds.demo === true,
    };
  }

  /**
   * Begin connecting. In demo mode this immediately marks the mailbox connected
   * and returns { mode:'demo' }. With real credentials it returns the Microsoft
   * authorize URL for the browser to redirect to.
   */
  async beginConnect(
    companyId: string, userId: string | null, userEmail: string | null,
  ): Promise<{ mode: 'demo'; status: OutlookStatus } | { mode: 'redirect'; authorizeUrl: string }> {
    const cfg = msConfig();
    const ctx = buildServiceRequestContext(companyId, 'outlook-connect');

    if (!cfg.configured) {
      const mode = capabilityService.resolveCapabilityMode(ctx, 'outlook.connect', {
        available: false,
        explicitFallbackLabel: 'Sample mailbox',
      });
      if (!mode.allowed) {
        throw new AppError(503, 'Outlook integration is unavailable in this deployment');
      }
      const creds: OutlookCredentials = { demo: true, email: userEmail ?? 'demo@outlook.local' };
      await outlookRepository.upsert(companyId, creds);
      await recordEvent({
        tenantId: companyId, actorId: userId, verb: 'integration.connected',
        objectType: 'integration', payload: { provider: 'outlook', demo: true },
      });
      return { mode: 'demo', status: await this.getStatus(companyId) };
    }

    const state = jwt.sign({ companyId, userId } as OAuthState, getJwtSecret(), { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: cfg.clientId!,
      response_type: 'code',
      redirect_uri: cfg.redirectUri!,
      response_mode: 'query',
      scope: SCOPES,
      state,
    });
    const authorizeUrl = `https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/authorize?${params}`;
    return { mode: 'redirect', authorizeUrl };
  }

  /** OAuth callback (real mode): exchange the code, store tokens. Returns companyId. */
  async handleCallback(code: string, state: string): Promise<string> {
    const cfg = msConfig();
    if (!cfg.configured) throw new AppError(400, 'Outlook is not configured');

    let parsed: OAuthState;
    try {
      parsed = jwt.verify(state, getJwtSecret()) as OAuthState;
    } catch {
      throw new AppError(400, 'Invalid or expired OAuth state');
    }

    const body = new URLSearchParams({
      client_id: cfg.clientId!,
      client_secret: cfg.clientSecret!,
      redirect_uri: cfg.redirectUri!,
      grant_type: 'authorization_code',
      code,
      scope: SCOPES,
    });
    const tokenRes = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) throw new AppError(502, 'Token exchange with Microsoft failed');
    const tok = (await tokenRes.json()) as {
      access_token: string; refresh_token?: string; expires_in?: number; scope?: string;
    };

    // Best-effort: fetch the mailbox address from Microsoft Graph.
    let email: string | null = null;
    try {
      const me = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (me.ok) {
        const j = (await me.json()) as { mail?: string; userPrincipalName?: string };
        email = j.mail ?? j.userPrincipalName ?? null;
      }
    } catch { /* non-fatal */ }

    const creds: OutlookCredentials = {
      demo: false,
      email,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
      scope: tok.scope,
    };
    await outlookRepository.upsert(parsed.companyId, creds);
    await recordEvent({
      tenantId: parsed.companyId, actorId: parsed.userId, verb: 'integration.connected',
      objectType: 'integration', payload: { provider: 'outlook', demo: false, email },
    });
    return parsed.companyId;
  }

  async disconnect(companyId: string, actorId: string | null): Promise<void> {
    await outlookRepository.disconnect(companyId);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'integration.disconnected',
      objectType: 'integration', payload: { provider: 'outlook' },
    });
  }

  /**
   * A valid (refreshed if needed) access token for the connected mailbox, for
   * callers that need to hit Graph directly (e.g. sending mail). Returns null
   * in demo mode, when disconnected, or when no token can be obtained — never
   * throws, so callers can degrade gracefully instead of failing a whole flow.
   */
  async getFreshAccessToken(companyId: string): Promise<{ accessToken: string; email: string | null } | null> {
    const conn = await outlookRepository.find(companyId);
    if (!conn || conn.status !== 'connected' || conn.creds.demo) return null;
    const creds = await this.ensureFreshToken(companyId, conn.creds);
    if (!creds.access_token) return null;
    return { accessToken: creds.access_token, email: creds.email };
  }

  /**
   * Pull the connected mailbox's calendar (next 14 days back, next 30 days
   * forward) and categorize events to projects by matching a Graph event's
   * `categories` against this company's project names (case-insensitive) —
   * the Outlook-side equivalent of tagging a meeting with a project label.
   * No-op (returns synced: 0) in demo mode or once the access token can't be
   * refreshed — never throws into a scheduled/best-effort caller's happy path.
   */
  async syncCalendar(companyId: string, actorId: string | null): Promise<{ synced: number; skipped?: string }> {
    const conn = await outlookRepository.find(companyId);
    if (!conn || conn.status !== 'connected') return { synced: 0, skipped: 'not connected' };
    if (conn.creds.demo) return { synced: 0, skipped: 'demo mode has no real calendar to sync' };

    const creds = await this.ensureFreshToken(companyId, conn.creds);
    if (!creds.access_token) return { synced: 0, skipped: 'no access token' };

    const start = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const params = new URLSearchParams({ startDateTime: start, endDateTime: end, $top: '250' });
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, {
      headers: { Authorization: `Bearer ${creds.access_token}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!res.ok) return { synced: 0, skipped: `Graph calendarview failed (${res.status})` };
    const body = (await res.json()) as {
      value: {
        id: string; subject?: string; isAllDay?: boolean; categories?: string[];
        start: { dateTime: string }; end: { dateTime: string };
        attendees?: { emailAddress?: { address?: string } }[];
      }[];
    };

    const projects = await projectsRepository.listProjects(companyId);
    const byName = new Map(projects.map((p) => [p.name.trim().toLowerCase(), p.id]));

    const events: UpsertCalendarEventInput[] = (body.value ?? []).map((e) => {
      const matchedProjectId = (e.categories ?? [])
        .map((c) => byName.get(c.trim().toLowerCase()))
        .find((id): id is string => !!id) ?? null;
      return {
        external_id: e.id,
        project_id: matchedProjectId,
        subject: e.subject ?? null,
        start_at: e.start.dateTime.endsWith('Z') ? e.start.dateTime : `${e.start.dateTime}Z`,
        end_at: e.end.dateTime.endsWith('Z') ? e.end.dateTime : `${e.end.dateTime}Z`,
        is_all_day: !!e.isAllDay,
        categories: e.categories ?? [],
        attendee_emails: (e.attendees ?? [])
          .map((a) => a.emailAddress?.address?.toLowerCase())
          .filter((a): a is string => !!a),
      };
    });

    await calendarRepository.upsertEvents(companyId, events);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'integration.calendar_synced',
      objectType: 'integration', payload: { provider: 'outlook', count: events.length },
    });
    return { synced: events.length };
  }

  /**
   * Pull the connected mailbox's sent mail, match recipients to clients by
   * domain (see email.matcher.ts), and upsert one email_messages row per
   * matched client. Incremental via a per-company watermark (last_sync_at):
   * first sync backfills 90 days, later syncs only fetch mail sent since the
   * previous successful run. No-op in demo mode or once the access token
   * can't be refreshed — never throws into a scheduled/best-effort caller's
   * happy path.
   */
  async syncEmails(companyId: string, actorId: string | null): Promise<{ synced: number; skipped?: string }> {
    const conn = await outlookRepository.find(companyId);
    if (!conn || conn.status !== 'connected') return { synced: 0, skipped: 'not connected' };
    if (conn.creds.demo) return { synced: 0, skipped: 'demo mode has no real mailbox to sync' };

    const creds = await this.ensureFreshToken(companyId, conn.creds);
    if (!creds.access_token) return { synced: 0, skipped: 'no access token' };

    const since = conn.last_sync_at ?? new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const params = new URLSearchParams({
      $filter: `sentDateTime ge ${since.toISOString()}`,
      $orderby: 'sentDateTime',
      $top: '50',
      $select: 'id,subject,sentDateTime,from,toRecipients,ccRecipients,bodyPreview,isDraft',
    });

    let url = `https://graph.microsoft.com/v1.0/me/mailfolders/sentitems/messages?${params}`;
    const messages: {
      id: string; subject?: string; sentDateTime: string; isDraft?: boolean;
      from?: { emailAddress?: { address?: string } };
      toRecipients?: { emailAddress?: { address?: string } }[];
      ccRecipients?: { emailAddress?: { address?: string } }[];
      bodyPreview?: string;
    }[] = [];

    while (url) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${creds.access_token}` },
      });
      if (!res.ok) return { synced: 0, skipped: `Graph sentitems failed (${res.status})` };
      const body = (await res.json()) as {
        value: typeof messages;
        '@odata.nextLink'?: string;
      };
      messages.push(...(body.value ?? []));
      url = body['@odata.nextLink'] ?? '';
    }

    const clients = await crmRepository.listClients(companyId);
    const clientRefs = clients.map((c) => ({ id: c.id, email: c.email }));

    const rows: UpsertEmailMessageInput[] = [];
    for (const m of messages) {
      const recipientEmails = [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])]
        .map((r) => r.emailAddress?.address?.toLowerCase())
        .filter((a): a is string => !!a);

      const matchedClientIds = matchClientsForRecipients(recipientEmails, clientRefs);
      const receivedAt = m.sentDateTime.endsWith('Z') ? m.sentDateTime : `${m.sentDateTime}Z`;

      for (const clientId of matchedClientIds) {
        rows.push({
          client_id: clientId,
          outlook_id: m.id,
          sender_email: m.from?.emailAddress?.address?.toLowerCase() ?? '',
          recipient_emails: recipientEmails,
          subject: m.subject ?? '(no subject)',
          body_preview: m.bodyPreview ?? null,
          received_at: receivedAt,
          is_draft: !!m.isDraft,
        });
      }
    }

    await emailRepository.upsertMessages(companyId, rows);
    await outlookRepository.updateLastSyncAt(companyId, new Date());
    await recordEvent({
      tenantId: companyId, actorId, verb: 'integration.emails_synced',
      objectType: 'integration', payload: { provider: 'outlook', count: rows.length },
    });
    return { synced: rows.length };
  }

  /** Refresh the access token via refresh_token if it's expired, persisting the new one. */
  private async ensureFreshToken(companyId: string, creds: OutlookCredentials): Promise<OutlookCredentials> {
    if (!creds.expires_at || creds.expires_at > Date.now() + 60_000) return creds;
    if (!creds.refresh_token) return creds;
    const cfg = msConfig();
    if (!cfg.configured) return creds;

    const body = new URLSearchParams({
      client_id: cfg.clientId!,
      client_secret: cfg.clientSecret!,
      redirect_uri: cfg.redirectUri!,
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
      scope: SCOPES,
    });
    const res = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return creds;
    const tok = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
    const refreshed: OutlookCredentials = {
      ...creds,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? creds.refresh_token,
      expires_at: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
      scope: tok.scope ?? creds.scope,
    };
    await outlookRepository.upsert(companyId, refreshed);
    return refreshed;
  }
}

export const outlookService = new OutlookService();
