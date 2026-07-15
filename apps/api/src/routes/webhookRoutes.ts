import { Router } from 'express';
import { receiveWebhook } from '../controllers/integrationsController';
import { anprWebhook, ocrWebhook } from '../domains/yard/gate.controller';

const router = Router();

/**
 * Edge-AI gate cameras (Phase 4). Registered BEFORE the `/:provider` catch-all
 * so they aren't swallowed as a generic provider. ANPR = number plate, OCR =
 * container number. Each read auto-checks-in the asset and assigns a yard slot.
 * Tenant identity comes from the signed `X-Gate-Token`, never from the body.
 */
router.post('/anpr', anprWebhook);
router.post('/ocr', ocrWebhook);

/**
 * POST /api/webhooks/:provider
 *
 * Public endpoint — no authentication required.
 * Third-party providers (Samsara, Geotab, Transporeon, etc.) POST their
 * event payloads here.  The controller acknowledges immediately with 200
 * and delegates processing to the WebhookService asynchronously, so
 * slow internal processing never triggers a provider retry.
 */
router.post('/:provider', receiveWebhook);

export default router;
