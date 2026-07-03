import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listFolders, getFolder, createFolder, updateFolder, moveFolder, deleteFolder,
} from './folders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listFolders);
router.post('/', createFolder);
router.get('/:id', getFolder);
router.patch('/:id', updateFolder);
router.patch('/:id/move', moveFolder);
router.delete('/:id', deleteFolder);

export default router;
