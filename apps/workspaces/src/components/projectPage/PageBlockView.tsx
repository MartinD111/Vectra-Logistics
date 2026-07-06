'use client';

// Read-mode rendering of a single project-page block. This is now a thin
// wrapper over the page block registry — all per-kind dispatch lives in
// lib/projectPage/registry.tsx, and the per-kind view components live in
// ./pageBlockViews.tsx. Adding a new block kind = one registry entry; nothing
// here changes.

import type { PageBlock } from '@/lib/projectPage/blocks';
import { pageBlockRegistry } from '@/lib/projectPage/registry';

export function PageBlockView({
  block, projectId, clientId, onChange,
}: {
  block: PageBlock;
  projectId?: string;
  /** Set only on the client detail page (/records/[clientId]) canvas. */
  clientId?: string;
  /** Present on the live canvas — lets interactive widgets (kanban) write back to the config. */
  onChange?: (block: PageBlock) => void;
}) {
  return <>{pageBlockRegistry.render(block, { projectId, clientId, onChange })}</>;
}
