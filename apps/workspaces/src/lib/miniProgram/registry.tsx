'use client';

// Mini-program instance of the Workspace Engine — the single dispatch point that
// replaces the switch in components/miniProgram/BlockView.tsx.
//
// keyOf: native blocks key by `kind`; a `plugin` block keys by its `pluginId`,
// which is not a static entry, so it falls through to renderManifest →
// DynamicBlockView (which resolves the manifest via getPlugin). This is how the
// same generic engine serves both code blocks and declarative/sandboxed plugins.

import type { ComponentType } from 'react';
import type { Block, BlockKind, PluginBlockInstance } from './blocks';
import { blockDef } from './blocks';
import {
  WorkspaceBlockRegistry, type WorkspaceBlockPlugin, type BlockRenderProps,
} from '@/lib/workspaceEngine';
import { DynamicBlockView } from '@/components/miniProgram/DynamicBlockView';
import {
  TextView, FileInputView, PasteInputView, TableView, ExportView, CopyView,
  DocumentView, FormView, RecordsView, TsvOutputView, DropdownView,
} from '@/components/miniProgram/miniProgramBlockViews';

/** Mini-program renderers read the shared runtime via useRuntime(), so no ctx. */
export type MiniProgramCtx = Record<string, never>;

type Renderer = ComponentType<BlockRenderProps<Block, MiniProgramCtx>>;

/** Build a native mini-program plugin from existing BLOCK_REGISTRY metadata + factory. */
function entry(kind: Exclude<BlockKind, 'plugin'>, renderer: Renderer): WorkspaceBlockPlugin<Block, MiniProgramCtx> {
  const def = blockDef(kind)!;
  return {
    key: kind,
    source: 'native',
    group: def.group,
    title: def.title,
    description: def.description,
    icon: def.icon,
    create: def.create,
    renderer,
  };
}

/** Processing blocks are invisible at runtime (they rewrite the dataset silently). */
const Invisible: Renderer = () => null;

// Explicit Record over the non-plugin kinds — compile-time exhaustiveness.
// `plugin` blocks are resolved by pluginId via renderManifest, not here.
const entries: Record<Exclude<BlockKind, 'plugin'>, WorkspaceBlockPlugin<Block, MiniProgramCtx>> = {
  'file-input': entry('file-input', ({ block }) => <FileInputView block={block as Extract<Block, { kind: 'file-input' }>} />),
  'paste-input': entry('paste-input', ({ block }) => <PasteInputView block={block as Extract<Block, { kind: 'paste-input' }>} />),
  'form': entry('form', ({ block }) => <FormView block={block as Extract<Block, { kind: 'form' }>} />),
  'dropdown': entry('dropdown', ({ block }) => <DropdownView block={block as Extract<Block, { kind: 'dropdown' }>} />),
  'columns': entry('columns', Invisible),
  'transform': entry('transform', Invisible),
  'code': entry('code', Invisible),
  'table': entry('table', ({ block }) => <TableView block={block as Extract<Block, { kind: 'table' }>} />),
  'export': entry('export', ({ block }) => <ExportView block={block as Extract<Block, { kind: 'export' }>} />),
  'copy': entry('copy', ({ block }) => <CopyView block={block as Extract<Block, { kind: 'copy' }>} />),
  'document': entry('document', ({ block }) => <DocumentView block={block as Extract<Block, { kind: 'document' }>} />),
  'records': entry('records', ({ block }) => <RecordsView block={block as Extract<Block, { kind: 'records' }>} />),
  'text': entry('text', ({ block }) => <TextView block={block as Extract<Block, { kind: 'text' }>} />),
  'tsv-output': entry('tsv-output', ({ block }) => <TsvOutputView block={block as Extract<Block, { kind: 'tsv-output' }>} />),
};

export const miniProgramBlockRegistry = new WorkspaceBlockRegistry<Block, MiniProgramCtx>(
  entries,
  (block) => (block.kind === 'plugin' ? (block as PluginBlockInstance).pluginId : block.kind),
  (block) => <DynamicBlockView block={block as PluginBlockInstance} />,
);
