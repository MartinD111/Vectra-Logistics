import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId, requireRequestContext } from '../../core/auth/request-context';
import { projectsService } from './projects.service';

// ── Projects ────────────────────────────────────────────────────────────────

export const listProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ projects: await projectsService.listProjects(requireCompanyId(req)) });
});

export const getProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ project: await projectsService.getProject(req.params.id, requireCompanyId(req)) });
});

export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const project = await projectsService.createProject(requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ project: await projectsService.updateProject(req.params.id, requireCompanyId(req), req.body) });
});

export const archiveProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const project = await projectsService.archiveProject(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null);
  res.json({ project });
});

export const unarchiveProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const project = await projectsService.unarchiveProject(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null);
  res.json({ project });
});

export const getProjectStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ stats: await projectsService.getProjectStats(req.params.id, requireCompanyId(req)) });
});

// ── Programs ────────────────────────────────────────────────────────────────

export const listPrograms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  res.json({ programs: await projectsService.listPrograms(requireCompanyId(req), projectId) });
});

export const getProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ program: await projectsService.getProgram(req.params.id, requireCompanyId(req)) });
});

export const createProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const program = await projectsService.createProgram(requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.status(201).json({ program });
});

export const updateProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const program = await projectsService.updateProgram(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.json({ program });
});

export const archiveProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const program = await projectsService.archiveProgram(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null);
  res.json({ program });
});

export const unarchiveProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const program = await projectsService.unarchiveProgram(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null);
  res.json({ program });
});

// ── Project pages ─────────────────────────────────────────────────────────────

export const listPages = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ pages: await projectsService.listPages(req.params.id, requireCompanyId(req)) });
});

export const listAllPages = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ pages: await projectsService.listAllPages(requireCompanyId(req)) });
});

export const getPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ page: await projectsService.getPage(req.params.pageId, requireCompanyId(req)) });
});

export const createPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const page = await projectsService.createPage(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.status(201).json({ page });
});

export const updatePage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  const page = await projectsService.updatePage(req.params.pageId, requireCompanyId(ctx), ctx.user?.id ?? null, req.body);
  res.json({ page });
});

export const deletePage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  await projectsService.deletePage(req.params.pageId, requireCompanyId(ctx), ctx.user?.id ?? null);
  res.status(204).send();
});

// ── Project activity feed ──────────────────────────────────────────────────────

export const listActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  res.json({ activity: await projectsService.listActivity(req.params.id, requireCompanyId(req), { limit, before }) });
});

// ── Calendar ────────────────────────────────────────────────────────────────

export const listCalendarEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const start = typeof req.query.start === 'string' ? req.query.start : new Date(Date.now() - 7 * 86400000).toISOString();
  const end = typeof req.query.end === 'string' ? req.query.end : new Date(Date.now() + 30 * 86400000).toISOString();
  res.json({ events: await projectsService.listCalendarEvents(req.params.id, requireCompanyId(req), { start, end }) });
});
