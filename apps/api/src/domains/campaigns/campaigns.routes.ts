import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { listCampaigns, getCampaign, createCampaign, trackOpen } from './campaigns.controller';

const router = Router();

// Tracking pixel is unauthenticated (loaded as an <img> by the recipient's mail
// client); registered before the auth guard, same pattern as outlook/callback.
router.get('/track/open/:token', trackOpen);

router.use(authenticateToken);
router.get('/', listCampaigns);
router.post('/', createCampaign);
router.get('/:id', getCampaign);

export default router;
