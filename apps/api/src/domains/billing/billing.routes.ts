import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listClients, createClient, updateClient, evaluateVat,
  listInvoices, approveInvoice, markInvoicePaid,
} from './billing.controller';

const router = Router();
router.use(authenticateToken);

router.get('/clients', listClients);
router.post('/clients', createClient);
router.patch('/clients/:id', updateClient);

router.post('/vat/evaluate', evaluateVat);

router.get('/invoices', listInvoices);
router.post('/invoices/:id/approve', approveInvoice);
router.post('/invoices/:id/pay', markInvoicePaid);

export default router;
