import { Router } from 'express';
import { authenticateToken, requireRole } from '../../core/auth/middleware';
import {
  listSuggestions, listPartials, createPartial, scan, acceptSuggestion, dismissSuggestion,
} from './ltl.controller';

const router = Router();
router.use(authenticateToken, requireRole(['carrier', 'admin']));

router.get('/suggestions', listSuggestions);
router.get('/partials', listPartials);
router.post('/partials', createPartial);
router.post('/scan', scan);
router.post('/suggestions/:id/accept', acceptSuggestion);
router.post('/suggestions/:id/dismiss', dismissSuggestion);

export default router;
