import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getDemoEmails, listDrafts, parseEmail, updateDraft, confirmDraft, rejectDraft,
} from './inbox.controller';

const router = Router();
router.use(authenticateToken);

router.get('/demo-emails', getDemoEmails);
router.get('/drafts', listDrafts);
router.post('/parse', parseEmail);
router.patch('/drafts/:id', updateDraft);
router.post('/drafts/:id/confirm', confirmDraft);
router.post('/drafts/:id/reject', rejectDraft);

export default router;
