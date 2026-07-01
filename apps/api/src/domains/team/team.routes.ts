import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listMembers, getMemberStats, addMember, updateRole, removeMember,
} from './team.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listMembers);
router.post('/', addMember);
router.get('/:id/stats', getMemberStats);
router.patch('/:id/role', updateRole);
router.delete('/:id', removeMember);

export default router;
