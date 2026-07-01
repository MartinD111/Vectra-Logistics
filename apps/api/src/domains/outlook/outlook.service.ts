import jwt from 'jsonwebtoken';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { outlookRepository } from './outlook.repository';
import { OutlookStatus, OutlookCredentials } from './outlook.types';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const SCOPES = 'openid profile email offline_access Mail.Read Mail.Send';

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

    if (!cfg.configured) {
      const creds: OutlookCredentials = { demo: true, email: userEmail ?? 'demo@outlook.local' };
      await outlookRepository.upsert(companyId, creds);
      await recordEvent({
        tenantId: companyId, actorId: userId, verb: 'integration.connected',
        objectType: 'integration', payload: { provider: 'outlook', demo: true },
      });
      return { mode: 'demo', status: await this.getStatus(companyId) };
    }

    const state = jwt.sign({ companyId, userId } as OAuthState, JWT_SECRET, { expiresIn: '10m' });
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
      parsed = jwt.verify(state, JWT_SECRET) as OAuthState;
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
}

export const outlookService = new OutlookService();
