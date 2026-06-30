import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listProjects, getProject, createProject, updateProject, deleteProject, getProjectStats,
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
} from './projects.controller';

const router = Router();
router.use(authenticateToken);

// Programs (registered before /:id so "programs" isn't matched as a project id).
router.get('/programs', listPrograms);
router.post('/programs', createProgram);
router.get('/programs/:id', getProgram);
router.patch('/programs/:id', updateProgram);
router.delete('/programs/:id', deleteProgram);

// Projects
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.get('/:id/stats', getProjectStats);

export default router;
