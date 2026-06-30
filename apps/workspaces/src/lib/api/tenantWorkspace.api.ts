import { apiFetch } from './client';

// Client for the tenant Workspace container + its generic type-presets.
// Mirrors the @vectra/api/src/domains/workspaces backend.

export interface WorkspacePreset {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  enabled_modules: string[];
  is_system_seed: boolean;
}

export interface Workspace {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  header_title: string | null;
  theme: Record<string, unknown>;
}

export interface WorkspaceWithPresets extends Workspace {
  presets: WorkspacePreset[];
  enabled_modules: string[];
}

export interface BrandingUpdate {
  name?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  header_title?: string | null;
  theme?: Record<string, unknown>;
}

const BASE = '/api/v1/workspaces';

export const tenantWorkspaceApi = {
  listPresets: () =>
    apiFetch<{ presets: WorkspacePreset[] }>(`${BASE}/presets`).then((r) => r.presets),

  getCurrent: () =>
    apiFetch<{ workspace: WorkspaceWithPresets }>(`${BASE}/current`).then((r) => r.workspace),

  get: (id: string) =>
    apiFetch<{ workspace: WorkspaceWithPresets }>(`${BASE}/${id}`).then((r) => r.workspace),

  updateBranding: (id: string, patch: BrandingUpdate) =>
    apiFetch<{ workspace: Workspace }>(`${BASE}/${id}/branding`, 'PATCH', patch).then(
      (r) => r.workspace,
    ),

  applyPresets: (id: string, presetIds: string[]) =>
    apiFetch<{ workspace: WorkspaceWithPresets }>(`${BASE}/${id}/presets`, 'POST', {
      preset_ids: presetIds,
    }).then((r) => r.workspace),

  removePreset: (id: string, presetId: string) =>
    apiFetch<{ workspace: WorkspaceWithPresets }>(
      `${BASE}/${id}/presets/${presetId}`,
      'DELETE',
    ).then((r) => r.workspace),
};
