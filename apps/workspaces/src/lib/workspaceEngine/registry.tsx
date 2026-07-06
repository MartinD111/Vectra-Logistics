'use client';

// The generic block registry + render dispatcher shared by every domain.
// `render(block)` replaces the hand-maintained per-kind switch statements:
//   - native plugins  → invoke the carried React component
//   - manifest plugins (or an unresolved key when a renderManifest hook exists)
//     → delegate to the domain's declarative interpreter (e.g. DynamicBlockView)
//   - nothing found   → null (parity with the old `default:` arm)
//
// Reconciling two data models is the job of `keyOf`: pages key by `block.kind`;
// mini programs key native blocks by `kind` and manifest blocks by `pluginId`.

import type { ReactNode } from 'react';
import type { WorkspaceBlockPlugin } from './types';

export class WorkspaceBlockRegistry<B, Ctx> {
  constructor(
    private readonly entries: Record<string, WorkspaceBlockPlugin<B, Ctx>>,
    private readonly keyOf: (block: B) => string,
    /** Domain interpreter for manifest (declarative) blocks. */
    private readonly renderManifest?: (block: B, ctx: Ctx) => ReactNode,
  ) {}

  get(block: B): WorkspaceBlockPlugin<B, Ctx> | undefined {
    return this.entries[this.keyOf(block)];
  }

  list(): WorkspaceBlockPlugin<B, Ctx>[] {
    return Object.values(this.entries);
  }

  keys(): string[] {
    return Object.keys(this.entries);
  }

  render(block: B, ctx: Ctx): ReactNode {
    const plugin = this.get(block);
    // Manifest blocks — or an unresolved key when the domain supplies an
    // interpreter (e.g. a runtime-installed plugin) — go through renderManifest.
    if ((plugin?.source === 'manifest' || !plugin) && this.renderManifest) {
      return this.renderManifest(block, ctx);
    }
    const Renderer = plugin?.renderer;
    return Renderer ? <Renderer block={block} ctx={ctx} /> : null;
  }

  renderEditor(block: B, ctx: Ctx, onUpdate: (block: B) => void): ReactNode {
    const Editor = this.get(block)?.editor;
    return Editor ? <Editor block={block} ctx={ctx} onUpdate={onUpdate} /> : this.render(block, ctx);
  }
}
