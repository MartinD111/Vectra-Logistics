import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listRules, getRule, createRule, updateRule, deleteRule,
  runEvaluation, listResults, getSummary,
} from './kpi.controller';

const router = Router();
router.use(authenticateToken);

router.get('/rules', listRules);
router.post('/rules', createRule);
router.get('/rules/:id', getRule);
router.patch('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);

router.post('/evaluate', runEvaluation);
router.get('/results', listResults);
router.get('/summary', getSummary);

export default router;
