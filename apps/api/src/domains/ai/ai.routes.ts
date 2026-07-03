import { Router } from 'express';
import { authenticateToken, requireRole } from '../../core/auth/middleware';
import { getAiConfig, saveAiConfig, completeAi } from './ai.controller';

const router = Router();

// Config is admin-only (a shared, company-wide provider + secret key).
router.get('/config', authenticateToken, requireRole(['admin']), getAiConfig);
router.post('/config', authenticateToken, requireRole(['admin']), saveAiConfig);

// Completions are available to any authenticated user of the company (the
// generator feature) — the key stays server-side; users never see it.
router.post('/complete', authenticateToken, completeAi);

export default router;
