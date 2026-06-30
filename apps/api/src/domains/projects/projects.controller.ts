import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { projectsService } from './projects.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// ── Projects ────────────────────────────────────────────────────────────────

export const listProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ projects: await projectsService.listProjects(companyOf(req)) });
});

export const getProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ project: await projectsService.getProject(req.params.id, companyOf(req)) });
});

export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await projectsService.createProject(companyOf(req), req.user?.id ?? null, req.body);
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ project: await projectsService.updateProject(req.params.id, companyOf(req), req.body) });
});

export const deleteProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  await projectsService.deleteProject(req.params.id, companyOf(req));
  res.status(204).send();
});

export const getProjectStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ stats: await projectsService.getProjectStats(req.params.id, companyOf(req)) });
});

// ── Programs ────────────────────────────────────────────────────────────────

export const listPrograms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  res.json({ programs: await projectsService.listPrograms(companyOf(req), projectId) });
});

export const getProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ program: await projectsService.getProgram(req.params.id, companyOf(req)) });
});

export const createProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await projectsService.createProgram(companyOf(req), req.user?.id ?? null, req.body);
  res.status(201).json({ program });
});

export const updateProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await projectsService.updateProgram(req.params.id, companyOf(req), req.user?.id ?? null, req.body);
  res.json({ program });
});

export const deleteProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  await projectsService.deleteProgram(req.params.id, companyOf(req));
  res.status(204).send();
});
