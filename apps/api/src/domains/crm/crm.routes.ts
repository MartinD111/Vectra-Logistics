import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listClients, getClient, createClient, updateClient,
  listClientProjectLinks, upsertClientProjectLink, unlinkClientProjectLink,
  importClients, getClientEmails, getClientRisk,
  getClientPage, updateClientPage, getClientTimeline,
} from './crm.controller';

const router = Router();
router.use(authenticateToken);

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/clients/:id', getClient);
router.patch('/clients/:id', updateClient);

router.get('/clients/:id/projects', listClientProjectLinks);
router.post('/clients/:id/projects', upsertClientProjectLink);
router.delete('/clients/:id/projects/:projectId', unlinkClientProjectLink);

router.post('/clients/import', importClients);
router.get('/clients/:id/emails', getClientEmails);
router.get('/clients/:id/risk', getClientRisk);

// GET and POST both resolve to the same idempotent get-or-create handler
// (D-07/D-08) regardless of which HTTP verb the frontend uses to open a page.
router.get('/clients/:id/page', getClientPage);
router.post('/clients/:id/page', getClientPage);
router.patch('/client-pages/:pageId', updateClientPage);
router.get('/clients/:id/timeline', getClientTimeline);

export default router;
