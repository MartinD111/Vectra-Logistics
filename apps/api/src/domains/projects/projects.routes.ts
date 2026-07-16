import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject, getProjectStats,
  listPrograms, getProgram, createProgram, updateProgram, archiveProgram, unarchiveProgram,
  listPages, getPage, createPage, updatePage, deletePage, listActivity, listCalendarEvents, listAllPages,
} from './projects.controller';

const router = Router();
router.use(authenticateToken);

// Programs (registered before /:id so "programs" isn't matched as a project id).
router.get('/programs', listPrograms);
router.post('/programs', requireCapability('program.build'), createProgram);
router.get('/programs/:id', getProgram);
router.patch('/programs/:id', requireCapability('program.build'), updateProgram);
router.post('/programs/:id/archive', requireCapability('program.build'), archiveProgram);
router.post('/programs/:id/unarchive', requireCapability('program.build'), unarchiveProgram);

// Pages by id (registered before /:id so "pages" isn't matched as a project id).
router.get('/pages/all', listAllPages);
router.get('/pages/:pageId', getPage);
router.patch('/pages/:pageId', requireCapability('page.edit'), updatePage);
router.delete('/pages/:pageId', requireCapability('page.edit'), deletePage);

// Projects
router.get('/', listProjects);
router.post('/', requireCapability('workspace.admin'), createProject);
router.get('/:id', getProject);
router.patch('/:id', requireCapability('workspace.admin'), updateProject);
router.post('/:id/archive', requireCapability('workspace.admin'), archiveProject);
router.post('/:id/unarchive', requireCapability('workspace.admin'), unarchiveProject);
router.get('/:id/stats', getProjectStats);
router.get('/:id/activity', listActivity);
router.get('/:id/calendar', listCalendarEvents);
router.get('/:id/pages', listPages);
router.post('/:id/pages', requireCapability('page.edit'), createPage);

export default router;
