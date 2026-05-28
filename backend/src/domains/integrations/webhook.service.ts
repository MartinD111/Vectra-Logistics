import crypto from 'crypto';
import { AppError } from '../../core/errors/AppError';
import { SamsaraWebhookSchema, SamsaraWebhookDto } from './dto/samsara-webhook.dto';
import { GeotabWebhookSchema, GeotabWebhookDto } from './dto/geotab-webhook.dto';

// ── Signature verification ────────────────────────────────────────────────

/**
 * Verifies Samsara's HMAC-SHA256 webhook signature.
 * Samsara sends the signature in the `X-Samsara-Signature` header as:
 *   sha256=<hex_digest>
 * Docs: https://developers.samsara.com/docs/webhook-authentication
 */
export function verifySamsaraSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
): void {
  if (!rawBody) throw new AppError(400, 'Raw request body is missing — captureRawBody middleware must precede this route');

  const secret = process.env.SAMSARA_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret is configured, skip verification in development only
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(500, 'SAMSARA_WEBHOOK_SECRET is not configured');
    }
    console.warn('[WebhookService] SAMSARA_WEBHOOK_SECRET not set — skipping signature verification');
    return;
  }

  if (!signatureHeader) throw new AppError(401, 'Missing X-Samsara-Signature header');

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer      = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new AppError(401, 'Invalid Samsara webhook signature');
  }
}

/**
 * Verifies Geotab's webhook by checking a shared secret token.
 * Geotab sends the token as a query parameter or in the `Authorization` header
 * depending on the integration setup.
 */
export function verifyGeotabSignature(
  tokenHeader: string | undefined,
): void {
  const secret = process.env.GEOTAB_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(500, 'GEOTAB_WEBHOOK_SECRET is not configured');
    }
    console.warn('[WebhookService] GEOTAB_WEBHOOK_SECRET not set — skipping signature verification');
    return;
  }

  if (!tokenHeader) throw new AppError(401, 'Missing Authorization header');

  const provided = tokenHeader.startsWith('Bearer ') ? tokenHeader.slice(7) : tokenHeader;
  const providedBuf = Buffer.from(provided);
  const secretBuf   = Buffer.from(secret);

  if (
    providedBuf.length !== secretBuf.length ||
    !crypto.timingSafeEqual(providedBuf, secretBuf)
  ) {
    throw new AppError(401, 'Invalid Geotab webhook token');
  }
}

// ── Payload processing ────────────────────────────────────────────────────

class WebhookService {
  async processSamsaraWebhook(rawPayload: unknown): Promise<void> {
    const parsed = SamsaraWebhookSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn('[WebhookService] Unrecognised Samsara payload shape:', parsed.error.issues);
      // Accept unknown events gracefully — Samsara may send event types we don't handle yet
      return;
    }

    const event: SamsaraWebhookDto = parsed.data;
    console.log(`[WebhookService] Samsara event received: ${event.eventType}`);

    const vehicleId = event.data?.object?.id;
    const gps       = event.data?.object?.gps;

    if (!vehicleId || !gps) {
      console.log('[WebhookService] Samsara event has no vehicle/GPS data — skipping');
      return;
    }

    // TODO: Cross-domain interaction — update Fleet vehicle location
    // Call fleetRepository.updateVehicleLocation(samsaraVehicleId, gps.latitude, gps.longitude)
    // Requires: mapping Samsara vehicle ID → our internal vehicle ID via api_credentials or a
    // separate samsara_vehicle_map table.
    console.log(`[WebhookService] Samsara GPS update for vehicle ${vehicleId}: lat=${gps.latitude}, lng=${gps.longitude}`);
  }

  async processGeotabWebhook(rawPayload: unknown): Promise<void> {
    const parsed = GeotabWebhookSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn('[WebhookService] Unrecognised Geotab payload shape:', parsed.error.issues);
      return;
    }

    const results = parsed.data.results ?? [];
    console.log(`[WebhookService] Geotab webhook received with ${results.length} record(s)`);

    for (const record of results) {
      if (record.latitude == null || record.longitude == null) continue;

      // TODO: Cross-domain interaction — map Geotab device ID to internal vehicle ID
      // SELECT vehicle_id FROM geotab_device_map WHERE geotab_device_id = $1
      // Then: fleetRepository.updateVehicleLocation(vehicleId, record.latitude, record.longitude)
      console.log(
        `[WebhookService] Geotab GPS update for device ${record.device.id}: ` +
        `lat=${record.latitude}, lng=${record.longitude}`,
      );
    }
  }
}

export const webhookService = new WebhookService();
