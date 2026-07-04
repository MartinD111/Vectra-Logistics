import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { getStatus, connect, disconnect, callback, syncCalendar } from './outlook.controller';

const router = Router();

// OAuth callback is unauthenticated (Microsoft redirects the browser here);
// it is validated by the signed `state` param. Registered before the auth guard.
router.get('/callback', callback);

router.get('/status', authenticateToken, getStatus);
router.post('/connect', authenticateToken, connect);
router.post('/disconnect', authenticateToken, disconnect);
router.post('/sync-calendar', authenticateToken, syncCalendar);

export default router;
