'use client';

// Player-side rendering of a single mini-program block. This is now a thin
// wrapper over the mini-program block registry — all per-kind dispatch lives in
// lib/miniProgram/registry.tsx and the per-kind view components live in
// ./miniProgramBlockViews.tsx. Plugin blocks resolve (by pluginId) to the
// declarative DynamicBlockView via the registry's renderManifest hook.

import type { Block } from '@/lib/miniProgram/blocks';
import { miniProgramBlockRegistry } from '@/lib/miniProgram/registry';

export function BlockView({ block }: { block: Block }) {
  return <>{miniProgramBlockRegistry.render(block, {})}</>;
}
