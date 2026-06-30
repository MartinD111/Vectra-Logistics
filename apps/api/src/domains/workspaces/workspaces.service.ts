import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { workspacesRepository } from './workspaces.repository';
import { Workspace, WorkspacePreset, WorkspaceWithPresets } from './workspaces.types';
import { UpdateBrandingSchema } from './dto/update-branding.dto';
import { ApplyPresetsSchema } from './dto/apply-presets.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
}

class WorkspacesService {
  // ── Presets (workspace "types") ──────────────────────────────────────────────

  /** Seed presets + the caller company's own custom presets. */
  async listPresets(companyId: string | null): Promise<WorkspacePreset[]> {
    return workspacesRepository.findPresetsForCompany(companyId);
  }

  // ── Workspace lifecycle ──────────────────────────────────────────────────────

  /**
   * Create the default workspace for a company (called on signup). Idempotent:
   * if the company already has a workspace, returns it. Emits workspace.created.
   */
  async createDefaultWorkspace(
    companyId: string,
    companyName: string,
    actorId: string | null,
  ): Promise<Workspace> {
    const existing = await workspacesRepository.findWorkspaceByCompany(companyId);
    if (existing) return existing;

    const name = companyName?.trim() || 'My Workspace';
    // Slug uniqueness: suffix with a short company-id fragment to avoid clashes.
    const slug = `${slugify(name)}-${companyId.slice(0, 8)}`;
    const ws = await workspacesRepository.createWorkspace(companyId, name, slug, name);

    await recordEvent({
      tenantId: companyId,
      actorId,
      verb: 'workspace.created',
      objectType: 'workspace',
      objectId: ws.id,
      payload: { name: ws.name, slug: ws.slug },
    });
    return ws;
  }

  async getWorkspaceForCompany(companyId: string): Promise<WorkspaceWithPresets | null> {
    const ws = await workspacesRepository.findWorkspaceByCompany(companyId);
    if (!ws) return null;
    return workspacesRepository.getWorkspaceWithPresets(ws.id);
  }

  async getWorkspace(
    workspaceId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
  ): Promise<WorkspaceWithPresets> {
    const ws = await workspacesRepository.getWorkspaceWithPresets(workspaceId);
    if (!ws) throw new AppError(404, 'Workspace not found');
    if (ws.company_id !== requestingCompanyId && requestingRole !== 'admin') {
      throw new AppError(403, 'Forbidden');
    }
    return ws;
  }

  // ── Branding (admin) ──────────────────────────────────────────────────────────

  async updateBranding(
    workspaceId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
    actorId: string | null,
    body: unknown,
  ): Promise<Workspace> {
    await this.assertAdminOwner(workspaceId, requestingCompanyId, requestingRole);

    const parsed = UpdateBrandingSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const updated = await workspacesRepository.updateBranding(workspaceId, parsed.data);
    if (!updated) throw new AppError(404, 'Workspace not found');

    await recordEvent({
      tenantId: updated.company_id,
      actorId,
      verb: 'workspace.branding.updated',
      objectType: 'workspace',
      objectId: workspaceId,
      payload: { fields: Object.keys(parsed.data) },
    });
    return updated;
  }

  // ── Presets applied to a workspace (the selectable "types") ──────────────────

  async applyPresets(
    workspaceId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
    actorId: string | null,
    body: unknown,
  ): Promise<WorkspaceWithPresets> {
    const ws = await this.assertAdminOwner(workspaceId, requestingCompanyId, requestingRole);

    const parsed = ApplyPresetsSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    for (const presetId of parsed.data.preset_ids) {
      const preset = await workspacesRepository.findPresetById(presetId);
      if (!preset) throw new AppError(404, `Preset ${presetId} not found`);
      // A tenant may apply system seeds or its own presets, not another tenant's.
      if (preset.company_id && preset.company_id !== ws.company_id) {
        throw new AppError(403, 'Cannot apply another tenant\'s preset');
      }
      await workspacesRepository.applyPreset(workspaceId, presetId);
      await recordEvent({
        tenantId: ws.company_id,
        actorId,
        verb: 'workspace.preset.applied',
        objectType: 'preset',
        objectId: presetId,
        payload: { workspace_id: workspaceId, preset_name: preset.name },
      });
    }

    return (await workspacesRepository.getWorkspaceWithPresets(workspaceId))!;
  }

  async removePreset(
    workspaceId: string,
    presetId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
    actorId: string | null,
  ): Promise<WorkspaceWithPresets> {
    const ws = await this.assertAdminOwner(workspaceId, requestingCompanyId, requestingRole);
    await workspacesRepository.removePreset(workspaceId, presetId);
    await recordEvent({
      tenantId: ws.company_id,
      actorId,
      verb: 'workspace.preset.removed',
      objectType: 'preset',
      objectId: presetId,
      payload: { workspace_id: workspaceId },
    });
    return (await workspacesRepository.getWorkspaceWithPresets(workspaceId))!;
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  // Mutations to a workspace (branding, types) are company-config actions and
  // require an admin of the OWNING company.
  private async assertAdminOwner(
    workspaceId: string,
    requestingCompanyId: string | null,
    requestingRole: string,
  ): Promise<Workspace> {
    const ws = await workspacesRepository.findWorkspaceById(workspaceId);
    if (!ws) throw new AppError(404, 'Workspace not found');
    if (ws.company_id !== requestingCompanyId) throw new AppError(403, 'Forbidden');
    if (requestingRole !== 'admin') {
      throw new AppError(403, 'Only an admin can change workspace settings');
    }
    return ws;
  }
}

export const workspacesService = new WorkspacesService();
