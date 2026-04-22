import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../../core/auth/middleware';
import {
  getIntegrations,
  saveIntegration,
  getInternalApiKeys,
  generateInternalApiKey,
} from './integrations.controller';
import { handleSamsaraWebhook, handleGeotabWebhook } from './webhook.controller';

const router = Router();

// ── Standard integration routes (JWT protected, admin only) ───────────────
router.get('/settings', authenticateToken, requireRole(['admin']), getIntegrations);
router.post('/settings', authenticateToken, requireRole(['admin']), saveIntegration);
router.get('/settings/keys', authenticateToken, requireRole(['admin']), getInternalApiKeys);
router.post('/settings/keys', authenticateToken, requireRole(['admin']), generateInternalApiKey);

// ── Webhook routes (NO JWT — provider-specific auth in controller) ─────────
//
// Samsara requires signature verification against the raw request body.
// We capture the raw body via a per-route express.raw() middleware so that
// the global express.json() parser does not consume it before we can verify.
const captureRawBody = (req: Request, _res: Response, next: NextFunction): void => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    (req as Request & { rawBody: Buffer }).rawBody = raw;
    // Re-parse JSON manually so req.body is still available downstream
    try {
      (req as Request & { body: unknown }).body = JSON.parse(raw.toString('utf8'));
    } catch {
      (req as Request & { body: unknown }).body = {};
    }
    next();
  });
};

router.post('/webhooks/samsara', captureRawBody, handleSamsaraWebhook);
router.post('/webhooks/geotab',  handleGeotabWebhook);

export default router;
