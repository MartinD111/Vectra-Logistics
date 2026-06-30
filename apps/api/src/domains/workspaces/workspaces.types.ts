// Tenant Workspace container + generic type-preset types.
// A preset is tenant-owned DATA (which generic modules to enable), never
// hardcoded platform logic — see CLAUDE.md §1, §5.

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
  created_at: Date;
  updated_at: Date;
}

export interface WorkspacePreset {
  id: string;
  company_id: string | null; // null => shared/system seed preset
  name: string;
  description: string | null;
  icon: string | null;
  enabled_modules: string[];
  is_system_seed: boolean;
  created_at: Date;
}

/** A workspace plus the presets (types) applied to it and the union of enabled modules. */
export interface WorkspaceWithPresets extends Workspace {
  presets: WorkspacePreset[];
  enabled_modules: string[];
}

export interface WorkspaceBrandingUpdate {
  name?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  header_title?: string | null;
  theme?: Record<string, unknown>;
}
