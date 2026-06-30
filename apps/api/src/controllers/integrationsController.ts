import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  integrationRegistry,
  IntegrationStatus,
} from '../services/integrationService';
import { webhookService } from '../services/webhookService';
import { db } from '../config/db';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/integrations
// Public — returns the full catalogue of available integration adapters.
// ─────────────────────────────────────────────────────────────────────────────
export const listIntegrations = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const all = integrationRegistry.listAll();
  res.status(200).json({ integrations: all, total: all.length });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/integrations/connected
// Auth required — returns every integration the caller's company has connected.
// ─────────────────────────────────────────────────────────────────────────────
export const getConnectedIntegrations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      res.status(403).json({ error: 'No company associated with this account' });
      return;
    }

    try {
      const result = await db.query(
        `SELECT provider_id, status, connected_at, last_sync_at
         FROM   integration_credentials
         WHERE  company_id = $1
         ORDER  BY connected_at DESC`,
        [companyId],
      );
      res.status(200).json({ connected: result.rows });
    } catch {
      // The integration_credentials table may not exist yet — return empty set
      // rather than a 500 so the rest of the app keeps working.
      res.status(200).json({
        connected: [],
        note: 'Integration credentials table not yet migrated',
      });
    }
  } catch (error) {
    console.error('[integrationsController] getConnectedIntegrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/:providerId/connect
// Auth required — persists credentials for a given provider.
// ─────────────────────────────────────────────────────────────────────────────
export const connectIntegration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      res.status(403).json({ error: 'No company associated with this account' });
      return;
    }

    const { providerId } = req.params;
    // credentials can carry apiKey, clientId, clientSecret, etc.
    const { credentials } = req.body as { credentials?: Record<string, string> };

    const adapter = integrationRegistry.getAdapter(providerId);
    if (!adapter) {
      res
        .status(404)
        .json({ error: `Integration provider '${providerId}' not found` });
      return;
    }

    // TODO (production): encrypt credentials_json before storage.
    // For now, store them as plain JSON — this is an architecture stub.
    try {
      await db.query(
        `INSERT INTO integration_credentials
           (company_id, provider_id, credentials_json, status, connected_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (company_id, provider_id) DO UPDATE
           SET credentials_json = EXCLUDED.credentials_json,
               status           = EXCLUDED.status,
               updated_at       = NOW()`,
        [
          companyId,
          providerId,
          JSON.stringify(credentials ?? {}),
          IntegrationStatus.PENDING,
        ],
      );
    } catch {
      // Table may not exist yet — acknowledge anyway so the UI is not blocked.
    }

    res.status(200).json({
      message:  `Integration '${adapter.providerName}' connection initiated`,
      provider: providerId,
      status:   IntegrationStatus.PENDING,
      note:     'Full OAuth / API-key handshake coming soon. Architecture is ready.',
    });
  } catch (error) {
    console.error('[integrationsController] connectIntegration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/integrations/:providerId/disconnect
// Auth required — removes stored credentials for a given provider.
// ─────────────────────────────────────────────────────────────────────────────
export const disconnectIntegration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      res.status(403).json({ error: 'No company associated with this account' });
      return;
    }

    const { providerId } = req.params;

    // Verify the provider exists in the registry (gives a nicer error than a
    // silent no-op if the caller misspells the id).
    const adapter = integrationRegistry.getAdapter(providerId);
    if (!adapter) {
      res
        .status(404)
        .json({ error: `Integration provider '${providerId}' not found` });
      return;
    }

    try {
      await db.query(
        `DELETE FROM integration_credentials
         WHERE  company_id = $1
           AND  provider_id = $2`,
        [companyId, providerId],
      );
    } catch {
      // Table may not exist yet — treat as a no-op.
    }

    res.status(200).json({
      message:  `Integration '${adapter.providerName}' disconnected`,
      provider: providerId,
    });
  } catch (error) {
    console.error('[integrationsController] disconnectIntegration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/:providerId/test
// Auth required — calls the adapter's testConnection() method.
// ─────────────────────────────────────────────────────────────────────────────
export const testIntegration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { providerId } = req.params;

    const adapter = integrationRegistry.getAdapter(providerId);
    if (!adapter) {
      res
        .status(404)
        .json({ error: `Integration provider '${providerId}' not found` });
      return;
    }

    const success = await adapter.testConnection();

    res.status(200).json({
      provider:  providerId,
      name:      adapter.providerName,
      connected: success,
      message:   success
        ? 'Connection test passed'
        : 'Connection test returned false — full implementation pending for this provider',
    });
  } catch (error) {
    console.error('[integrationsController] testIntegration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/:provider
// Public (no auth) — inbound webhooks from third-party providers.
// Responds with 200 immediately, then processes the payload asynchronously
// so the provider's retry logic is not triggered by slow processing.
// ─────────────────────────────────────────────────────────────────────────────
export const receiveWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { provider } = req.params;
    // Providers typically set a custom header like X-Event-Type or X-Hook-Event.
    const eventType =
      (req.headers['x-event-type'] as string | undefined) ??
      (req.headers['x-hook-event'] as string | undefined) ??
      'unknown';
    const payload = req.body as unknown;

    // Acknowledge before any async work — prevents provider timeouts.
    res.status(200).json({ received: true, provider, eventType });

    // Fire-and-forget: route to the appropriate adapter + domain handler.
    webhookService
      .processWebhook(provider, eventType, payload)
      .catch((err: Error) =>
        console.error(
          `[integrationsController] Async webhook processing error for '${provider}':`,
          err.message,
        ),
      );
  } catch (error) {
    console.error('[integrationsController] receiveWebhook error:', error);
    // Only reached if res.json() above threw, which is extremely unlikely.
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
