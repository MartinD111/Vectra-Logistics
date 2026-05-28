import { Router } from 'express';
import { receiveWebhook } from '../controllers/integrationsController';

const router = Router();

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
