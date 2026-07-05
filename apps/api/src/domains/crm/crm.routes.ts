import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listClients, getClient, createClient, updateClient,
  listClientProjectLinks, upsertClientProjectLink,
  importClients, getClientEmails, getClientRisk,
} from './crm.controller';

const router = Router();
router.use(authenticateToken);

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/clients/:id', getClient);
router.patch('/clients/:id', updateClient);

router.get('/clients/:id/projects', listClientProjectLinks);
router.post('/clients/:id/projects', upsertClientProjectLink);

router.post('/clients/import', importClients);
router.get('/clients/:id/emails', getClientEmails);
router.get('/clients/:id/risk', getClientRisk);

export default router;
