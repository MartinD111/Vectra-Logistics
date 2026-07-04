import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { listPodRequests, createPodRequest, simulateArrival } from './pod.controller';

const router = Router();
router.use(authenticateToken);

router.get('/requests', listPodRequests);
router.post('/requests', createPodRequest);
router.post('/simulate-arrival', simulateArrival);

export default router;
