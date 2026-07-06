// Workspace Engine — the unified, plugin-driven block contract.
//
// One generic engine, instantiated per domain (project pages, mini programs).
// A block "plugin" comes in two flavours:
//   - native   — carries real React components (renderer/editor/settings). This
//                is how today's code-based widgets (recharts, React Query hooks,
//                domain UI) participate without being rewritten as declarative
//                JSON.
//   - manifest — a declarative, sandboxed plugin (the existing Mini Program
//                PluginBlockManifest), rendered by a domain-supplied interpreter.
//
// The engine never hardcodes block kinds: rendering is `registry.render(block)`,
// dispatched via a per-domain keyOf(block) resolver. See ./registry.

import type { ComponentType } from 'react';
import type { PluginBlockManifest } from '@/lib/miniProgram/plugins/manifest';

export type PluginSource = 'native' | 'manifest';

export interface BlockRenderProps<B, Ctx> {
  block: B;
  ctx: Ctx;
}

export interface BlockEditProps<B, Ctx> {
  block: B;
  ctx: Ctx;
  onUpdate: (block: B) => void;
}

export interface BlockSettingsProps<B, Ctx> {
  block: B;
  ctx: Ctx;
  onChange: (block: B) => void;
}

export interface WorkspaceBlockPlugin<B, Ctx> {
  /** Registry key (resolved from a block via the domain's keyOf). */
  key: string;
  source: PluginSource;
  group: string;
  title: string;
  description: string;
  /** lucide icon name (resolved by the domain's icon component). */
  icon: string;
  /** false → palette shows a "coming soon" placeholder. Defaults to true. */
  available?: boolean;
  /** Factory for a default instance — reuse the domain's existing closure verbatim. */
  create: () => B;

  // ── native (code) plugins ──────────────────────────────────────────────────
  renderer?: ComponentType<BlockRenderProps<B, Ctx>>;
  /** Optional inline editor; when absent, renderEditor falls back to renderer. */
  editor?: ComponentType<BlockEditProps<B, Ctx>>;
  settings?: ComponentType<BlockSettingsProps<B, Ctx>>;

  // ── manifest (declarative, sandboxed) plugins ──────────────────────────────
  manifest?: PluginBlockManifest;
}
