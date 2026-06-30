// @vectra/types — shared type definitions across Vectra apps.
//
// Single source of truth for the cross-app domain types. App-local types stay
// in their app; anything that crosses the app boundary (auth session, tenant
// container, presets) lives here.

// ── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'carrier' | 'shipper' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  company_id: string | null;
  is_verified: boolean;
  avatar_url: string | null;
  subscription: 'active' | 'inactive' | 'none';
}

export interface SignupData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  company_name?: string;
  company_vat?: string;
  company_address?: string;
  company_city?: string;
  company_country?: string;
  company_postal_code?: string;
}

// ── Company / Workspace (tenant container) ────────────────────────────────────
// Branding lives on the Workspace, not the Company, so each tenant's header is
// a property of its workspace. Populated further in Phase 3.

export interface Company {
  id: string;
  name: string;
  vat_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

export interface WorkspaceBranding {
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  header_title: string | null;
}

export interface Workspace extends WorkspaceBranding {
  id: string;
  company_id: string;
  name: string;
  slug: string;
}

/**
 * A workspace "type" — a TENANT-OWNED preset, never a hardcoded platform enum.
 * It only declares which generic modules to enable and which blank starter
 * templates to offer. It carries no industry business rules, codes, or lookup
 * data (see CLAUDE.md §1, §5). The five shipped verticals are `is_system_seed`
 * example rows a tenant may clone, edit, or delete.
 */
export interface WorkspacePreset {
  id: string;
  company_id: string | null; // null for shared/system seed presets
  name: string;
  description: string | null;
  icon: string | null;
  enabled_modules: string[];
  is_system_seed: boolean;
}
