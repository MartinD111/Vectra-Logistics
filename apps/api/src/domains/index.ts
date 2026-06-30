import { Router } from 'express';
import fleetRouter from './fleet/fleet.routes';
import marketplaceRouter from './marketplace/marketplace.routes';
import workspaceRouter from './workspace/workspace.routes';
import workspacesRouter from './workspaces/workspaces.routes';
import integrationsRouter from './integrations/integrations.routes';
import documentsRouter from './documents/documents.routes';
import notificationsRouter from './notifications/notifications.routes';
import chatRouter from './chat/chat.routes';

const router = Router();

router.use('/fleet', fleetRouter);
router.use('/marketplace', marketplaceRouter);
router.use('/workspace', workspaceRouter);
router.use('/workspaces', workspacesRouter);
router.use('/integrations', integrationsRouter);
router.use('/documents', documentsRouter);
router.use('/notifications', notificationsRouter);
router.use('/chat', chatRouter);

// Future domains mount here:
// router.use('/routes', routesDomainRouter);

export default router;
