import { Router } from 'express';
import fleetRouter from './fleet/fleet.routes';
import marketplaceRouter from './marketplace/marketplace.routes';
import workspaceRouter from './workspace/workspace.routes';
import workspacesRouter from './workspaces/workspaces.routes';
import projectsRouter from './projects/projects.routes';
import foldersRouter from './folders/folders.routes';
import teamRouter from './team/team.routes';
import kpiRouter from './kpi/kpi.routes';
import outlookRouter from './outlook/outlook.routes';
import campaignsRouter from './campaigns/campaigns.routes';
import integrationsRouter from './integrations/integrations.routes';
import aiRouter from './ai/ai.routes';
import documentsRouter from './documents/documents.routes';
import notificationsRouter from './notifications/notifications.routes';
import chatRouter from './chat/chat.routes';
import inboxRouter from './inbox/inbox.routes';
import yardRouter from './yard/yard.routes';
import podRouter from './pod/pod.routes';
import billingRouter from './billing/billing.routes';
import crmRouter from './crm/crm.routes';
import ltlRouter from './ltl/ltl.routes';

const router = Router();

router.use('/fleet', fleetRouter);
router.use('/marketplace', marketplaceRouter);
router.use('/workspace', workspaceRouter);
router.use('/workspaces', workspacesRouter);
router.use('/projects', projectsRouter);
router.use('/folders', foldersRouter);
router.use('/team', teamRouter);
router.use('/kpi', kpiRouter);
router.use('/outlook', outlookRouter);
router.use('/campaigns', campaignsRouter);
router.use('/integrations', integrationsRouter);
router.use('/ai', aiRouter);
router.use('/documents', documentsRouter);
router.use('/notifications', notificationsRouter);
router.use('/chat', chatRouter);
router.use('/inbox', inboxRouter);
router.use('/yard', yardRouter);
router.use('/pod', podRouter);
router.use('/billing', billingRouter);
router.use('/crm', crmRouter);
router.use('/ltl', ltlRouter);

// Future domains mount here:
// router.use('/routes', routesDomainRouter);

export default router;
