import { db } from '../../core/db';
import {
  Workspace,
  WorkspacePreset,
  WorkspaceWithPresets,
  WorkspaceBrandingUpdate,
} from './workspaces.types';

function unionModules(presets: WorkspacePreset[]): string[] {
  const set = new Set<string>();
  for (const p of presets) for (const m of p.enabled_modules) set.add(m);
  return [...set];
}

class WorkspacesRepository {
  // ── Presets ────────────────────────────────────────────────────────────────

  /** System seed presets + the company's own custom presets. */
  async findPresetsForCompany(companyId: string | null): Promise<WorkspacePreset[]> {
    const { rows } = await db.query<WorkspacePreset>(
      `SELECT * FROM workspace_presets
       WHERE is_system_seed = TRUE OR company_id = $1
       ORDER BY is_system_seed DESC, name ASC`,
      [companyId],
    );
    return rows;
  }

  async findPresetById(id: string): Promise<WorkspacePreset | null> {
    const { rows } = await db.query<WorkspacePreset>(
      `SELECT * FROM workspace_presets WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  // ── Workspaces ───────────────────────────────────────────────────────────────

  async findWorkspaceById(id: string): Promise<Workspace | null> {
    const { rows } = await db.query<Workspace>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findWorkspaceByCompany(companyId: string): Promise<Workspace | null> {
    const { rows } = await db.query<Workspace>(
      `SELECT * FROM workspaces WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [companyId],
    );
    return rows[0] ?? null;
  }

  async findAppliedPresets(workspaceId: string): Promise<WorkspacePreset[]> {
    const { rows } = await db.query<WorkspacePreset>(
      `SELECT p.* FROM workspace_presets p
       JOIN workspace_applied_presets ap ON ap.preset_id = p.id
       WHERE ap.workspace_id = $1
       ORDER BY ap.applied_at ASC`,
      [workspaceId],
    );
    return rows;
  }

  async getWorkspaceWithPresets(workspaceId: string): Promise<WorkspaceWithPresets | null> {
    const ws = await this.findWorkspaceById(workspaceId);
    if (!ws) return null;
    const presets = await this.findAppliedPresets(workspaceId);
    return { ...ws, presets, enabled_modules: unionModules(presets) };
  }

  async createWorkspace(
    companyId: string,
    name: string,
    slug: string,
    headerTitle: string,
  ): Promise<Workspace> {
    const { rows } = await db.query<Workspace>(
      `INSERT INTO workspaces (company_id, name, slug, header_title)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [companyId, name, slug, headerTitle],
    );
    return rows[0];
  }

  async updateBranding(id: string, patch: WorkspaceBrandingUpdate): Promise<Workspace | null> {
    const { rows } = await db.query<Workspace>(
      `UPDATE workspaces SET
         name          = COALESCE($2, name),
         logo_url      = COALESCE($3, logo_url),
         primary_color = COALESCE($4, primary_color),
         accent_color  = COALESCE($5, accent_color),
         header_title  = COALESCE($6, header_title),
         theme         = COALESCE($7, theme),
         updated_at    = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.name ?? null,
        patch.logo_url ?? null,
        patch.primary_color ?? null,
        patch.accent_color ?? null,
        patch.header_title ?? null,
        patch.theme ? JSON.stringify(patch.theme) : null,
      ],
    );
    return rows[0] ?? null;
  }

  async applyPreset(workspaceId: string, presetId: string): Promise<void> {
    await db.query(
      `INSERT INTO workspace_applied_presets (workspace_id, preset_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [workspaceId, presetId],
    );
  }

  async removePreset(workspaceId: string, presetId: string): Promise<void> {
    await db.query(
      `DELETE FROM workspace_applied_presets WHERE workspace_id = $1 AND preset_id = $2`,
      [workspaceId, presetId],
    );
  }
}

export const workspacesRepository = new WorkspacesRepository();
