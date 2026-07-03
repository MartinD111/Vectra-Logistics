import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { teamService } from './team.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ members: await teamService.listMembers(companyOf(req)) });
});

export const getMemberStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ stats: await teamService.getMemberStats(req.params.id, companyOf(req)) });
});

export const addMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const member = await teamService.addMember(
    companyOf(req), req.user?.role ?? '', req.user?.id ?? null, req.body,
  );
  res.status(201).json({ member });
});

export const updateRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const member = await teamService.updateRole(
    req.params.id, companyOf(req), req.user?.role ?? '', req.user?.id ?? null, req.body,
  );
  res.json({ member });
});

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.removeMember(req.params.id, companyOf(req), req.user?.role ?? '', req.user?.id ?? null);
  res.status(204).send();
});

export const updateCustomRoleTitle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const member = await teamService.updateCustomRoleTitle(
    req.params.id, companyOf(req), req.user?.role ?? '', req.user?.id ?? null, req.body,
  );
  res.json({ member });
});

// ── Project assignments ────────────────────────────────────────────────────

export const listAssignments = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ assignments: await teamService.listAssignments(req.params.id, companyOf(req)) });
});

export const assignProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const assignment = await teamService.assignProject(
    req.params.id, companyOf(req), req.user?.role ?? '', req.user?.id ?? null, req.body,
  );
  res.status(201).json({ assignment });
});

export const updateAssignment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const assignment = await teamService.updateAssignment(
    req.params.id, req.params.assignmentId, companyOf(req), req.user?.role ?? '', req.user?.id ?? null, req.body,
  );
  res.json({ assignment });
});

export const removeAssignment = asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.removeAssignment(req.params.id, req.params.assignmentId, companyOf(req), req.user?.role ?? '');
  res.status(204).send();
});
