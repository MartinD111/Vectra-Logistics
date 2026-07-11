// Shared, domain-agnostic palette-item builder.
//
// Both the project-page slash/insert menu and the mini-program "Add block"
// menu need the same thing from a WorkspaceBlockRegistry: a flat list of
// available entries (filtering out `available: false`) reduced to the bare
// fields a picker UI needs (key/group/title/description/icon/create) — no
// renderer/editor/manifest baggage. buildPaletteItems() is that single
// derivation, so a new registry entry appears in its palette automatically
// (PAL-02) without either menu component being touched.

import type { WorkspaceBlockRegistry } from './registry';
import type { WorkspaceBlockPlugin } from './types';

export interface PaletteItem<B> {
  key: string;
  group: string;
  title: string;
  description: string;
  icon: string;
  create: () => B;
}

export function buildPaletteItems<B, Ctx>(
  registry: WorkspaceBlockRegistry<B, Ctx>,
): PaletteItem<B>[] {
  return registry
    .list()
    .filter((plugin: WorkspaceBlockPlugin<B, Ctx>) => !(plugin.available === false))
    .map((plugin: WorkspaceBlockPlugin<B, Ctx>) => ({
      key: plugin.key,
      group: plugin.group,
      title: plugin.title,
      description: plugin.description,
      icon: plugin.icon,
      create: plugin.create,
    }));
}
