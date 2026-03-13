import { Router } from 'express';
import {
  listIntegrations,
  getConnectedIntegrations,
  connectIntegration,
  disconnectIntegration,
  testIntegration,
} from '../controllers/integrationsController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public — full catalogue of available integration adapters
router.get('/', listIntegrations);

// Auth required — company-scoped endpoints
router.get('/connected',               authenticateToken, getConnectedIntegrations);
router.post('/:providerId/connect',    authenticateToken, connectIntegration);
router.delete('/:providerId/disconnect', authenticateToken, disconnectIntegration);
router.post('/:providerId/test',       authenticateToken, testIntegration);

export default router;
