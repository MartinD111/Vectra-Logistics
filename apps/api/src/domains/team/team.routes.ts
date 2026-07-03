import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  listMembers, getMemberStats, addMember, updateRole, removeMember, updateCustomRoleTitle,
  listAssignments, assignProject, updateAssignment, removeAssignment,
} from './team.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listMembers);
router.post('/', addMember);
router.get('/:id/stats', getMemberStats);
router.patch('/:id/role', updateRole);
router.patch('/:id/custom-role', updateCustomRoleTitle);
router.get('/:id/assignments', listAssignments);
router.post('/:id/assignments', assignProject);
router.patch('/:id/assignments/:assignmentId', updateAssignment);
router.delete('/:id/assignments/:assignmentId', removeAssignment);
router.delete('/:id', removeMember);

export default router;
