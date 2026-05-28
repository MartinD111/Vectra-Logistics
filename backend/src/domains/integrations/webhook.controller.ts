import { Request, Response } from 'express';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { webhookService, verifySamsaraSignature, verifyGeotabSignature } from './webhook.service';

// NOTE: Webhook routes do NOT use JWT authenticateToken.
// Authentication is performed here via provider-specific HMAC signature or token verification
// before the payload is handed off to the service layer.

export const handleSamsaraWebhook = asyncHandler(async (req: Request, res: Response) => {
  // req.body is the parsed JSON; for signature verification we need the raw buffer.
  // express.raw() middleware must be applied before this route (see integrations.routes.ts).
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  verifySamsaraSignature(rawBody, req.headers['x-samsara-signature'] as string | undefined);

  await webhookService.processSamsaraWebhook(req.body);

  // Always respond 200 quickly — Samsara retries on non-2xx
  res.status(200).send('OK');
});

export const handleGeotabWebhook = asyncHandler(async (req: Request, res: Response) => {
  verifyGeotabSignature(req.headers['authorization'] as string | undefined);

  await webhookService.processGeotabWebhook(req.body);

  res.status(200).send('OK');
});
