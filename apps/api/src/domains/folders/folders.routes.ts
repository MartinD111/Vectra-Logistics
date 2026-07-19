import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  listFolders, getFullTree, getFolder, createFolder, updateFolder, moveFolder, archiveFolder, unarchiveFolder,
} from './folders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listFolders);
router.post('/', requireCapability('workspace.admin'), createFolder);
// /tree/full MUST be registered before the /:id catch-all — otherwise Express
// treats "tree" as a folder id and the catch-all swallows this route.
router.get('/tree/full', getFullTree);
router.get('/:id', getFolder);
router.patch('/:id', requireCapability('workspace.admin'), updateFolder);
router.patch('/:id/move', requireCapability('workspace.admin'), moveFolder);
router.post('/:id/archive', requireCapability('workspace.admin'), archiveFolder);
router.post('/:id/unarchive', requireCapability('workspace.admin'), unarchiveFolder);

export default router;
