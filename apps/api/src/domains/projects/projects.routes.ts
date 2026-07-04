import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listProjects, getProject, createProject, updateProject, deleteProject, getProjectStats,
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
  listPages, getPage, createPage, updatePage, deletePage, listActivity, listCalendarEvents, listAllPages,
} from './projects.controller';

const router = Router();
router.use(authenticateToken);

// Programs (registered before /:id so "programs" isn't matched as a project id).
router.get('/programs', listPrograms);
router.post('/programs', createProgram);
router.get('/programs/:id', getProgram);
router.patch('/programs/:id', updateProgram);
router.delete('/programs/:id', deleteProgram);

// Pages by id (registered before /:id so "pages" isn't matched as a project id).
router.get('/pages/all', listAllPages);
router.get('/pages/:pageId', getPage);
router.patch('/pages/:pageId', updatePage);
router.delete('/pages/:pageId', deletePage);

// Projects
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.get('/:id/stats', getProjectStats);
router.get('/:id/activity', listActivity);
router.get('/:id/calendar', listCalendarEvents);
router.get('/:id/pages', listPages);
router.post('/:id/pages', createPage);

export default router;
