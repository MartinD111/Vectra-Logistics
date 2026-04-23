import { Router } from 'express';
import fleetRouter from './fleet/fleet.routes';
import marketplaceRouter from './marketplace/marketplace.routes';
import workspaceRouter from './workspace/workspace.routes';
import integrationsRouter from './integrations/integrations.routes';
import driverRouter from './driver/driver.routes';

const router = Router();

router.use('/fleet', fleetRouter);
router.use('/marketplace', marketplaceRouter);
router.use('/workspace', workspaceRouter);
router.use('/integrations', integrationsRouter);
router.use('/driver', driverRouter);

export default router;
