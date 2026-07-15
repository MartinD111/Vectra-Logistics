import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  createWorkflow,
  getWorkflow,
  getWorkflowRun,
  listWorkflows,
  publishWorkflow,
  runWorkflowManually,
  updateWorkflow,
} from './workflows.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listWorkflows);
router.post('/', requireCapability('workflow.build'), createWorkflow);
router.get('/:id', getWorkflow);
router.put('/:id', requireCapability('workflow.build'), updateWorkflow);
router.post('/:id/publish', requireCapability('workflow.build'), publishWorkflow);
router.post('/:id/manual-runs', requireCapability('workflow.run'), runWorkflowManually);
router.get('/:id/runs/:runId', getWorkflowRun);

export default router;
