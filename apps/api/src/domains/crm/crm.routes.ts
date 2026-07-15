import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  listClients, getClient, createClient, updateClient,
  listClientProjectLinks, upsertClientProjectLink, unlinkClientProjectLink,
  importClients, getClientEmails, getClientRisk,
  getClientPage, updateClientPage, getClientTimeline,
} from './crm.controller';

const router = Router();
router.use(authenticateToken);

router.get('/clients', listClients);
router.post('/clients', requireCapability('record.write'), createClient);
router.get('/clients/:id', requireCapability('record.read'), getClient);
router.patch('/clients/:id', requireCapability('record.write'), updateClient);

router.get('/clients/:id/projects', requireCapability('record.read'), listClientProjectLinks);
router.post('/clients/:id/projects', requireCapability('record.write'), upsertClientProjectLink);
router.delete('/clients/:id/projects/:projectId', requireCapability('record.write'), unlinkClientProjectLink);

router.post('/clients/import', requireCapability('record.write'), importClients);
router.get('/clients/:id/emails', requireCapability('record.read'), getClientEmails);
router.get('/clients/:id/risk', requireCapability('record.read'), getClientRisk);

// GET and POST both resolve to the same idempotent get-or-create handler
// (D-07/D-08) regardless of which HTTP verb the frontend uses to open a page.
router.get('/clients/:id/page', requireCapability('record.read'), getClientPage);
router.post('/clients/:id/page', requireCapability('record.read'), getClientPage);
router.patch('/client-pages/:pageId', requireCapability('page.edit'), updateClientPage);
router.get('/clients/:id/timeline', requireCapability('record.read'), getClientTimeline);

export default router;
