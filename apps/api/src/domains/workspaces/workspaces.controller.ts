import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { workspacesService } from './workspaces.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// ── Presets (workspace "types") ──────────────────────────────────────────────

// GET /workspace-presets — system seeds + the caller's own custom presets.
export const listPresets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const presets = await workspacesService.listPresets(req.user?.company_id ?? null);
  res.status(200).json({ presets });
});

// ── Workspace ─────────────────────────────────────────────────────────────────

// GET /workspaces/current — the caller company's workspace (with applied presets).
export const getCurrentWorkspace = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const ws = await workspacesService.getWorkspaceForCompany(companyId);
  if (!ws) {
    res.status(404).json({ error: 'No workspace yet' });
    return;
  }
  res.status(200).json({ workspace: ws });
});

// GET /workspaces/:id
export const getWorkspace = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ws = await workspacesService.getWorkspace(
    req.params.id,
    req.user?.company_id ?? null,
    req.user?.role ?? '',
  );
  res.status(200).json({ workspace: ws });
});

// PATCH /workspaces/:id/branding (admin of the owning company)
export const updateBranding = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ws = await workspacesService.updateBranding(
    req.params.id,
    req.user?.company_id ?? null,
    req.user?.id ?? null,
    req.body,
  );
  res.status(200).json({ workspace: ws });
});

// POST /workspaces/:id/presets — apply one or more types (multi-select)
export const applyPresets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ws = await workspacesService.applyPresets(
    req.params.id,
    req.user?.company_id ?? null,
    req.user?.id ?? null,
    req.body,
  );
  res.status(200).json({ workspace: ws });
});

// DELETE /workspaces/:id/presets/:presetId — remove a type
export const removePreset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ws = await workspacesService.removePreset(
    req.params.id,
    req.params.presetId,
    req.user?.company_id ?? null,
    req.user?.id ?? null,
  );
  res.status(200).json({ workspace: ws });
});
