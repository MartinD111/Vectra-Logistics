import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import { listPodRequests, createPodRequest, simulateArrival } from './pod.controller';

const router = Router();
router.use(authenticateToken);

router.get('/requests', listPodRequests);
router.post('/requests', requireCapability('record.write'), createPodRequest);
router.post('/simulate-arrival', requireCapability('record.write'), simulateArrival);

export default router;
