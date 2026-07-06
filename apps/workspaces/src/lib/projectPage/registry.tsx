'use client';

// Project-page instance of the Workspace Engine. This is the single dispatch
// point that will replace the hand-maintained switch statements in
// PageBlockView (read) and LivePageCanvas (edit).
//
// Phase 7 (this file's first form): the registry is populated and exhaustive
// over every PageBlockKind, but each entry's renderer still delegates to the
// existing PageBlockView switch — so behaviour is byte-identical and nothing
// under components/projectPage/ changes yet. Phase 8 repoints each renderer at
// its specific view; Phase 9 adds the `editor` entries.

import type { PageBlock, PageBlockKind } from './blocks';
import { pageBlockDef } from './blocks';
import { WorkspaceBlockRegistry, type WorkspaceBlockPlugin } from '@/lib/workspaceEngine';
import { PageBlockView } from '@/components/projectPage/PageBlockView';
import type { SlashMenuItem } from './slashMenu';
import type { SlashSelectContext } from '@/components/projectPage/EditableRichText';

/** Render/edit context threaded to page block plugins. */
export interface PageCtx {
  projectId?: string;
  /** Set only on the client detail page (/records/[clientId]) canvas. */
  clientId?: string;
  /** Present on the live canvas — lets interactive widgets write back to config. */
  onChange?: (block: PageBlock) => void;
  /** Edit-mode only (used by the rich-text/list editors). */
  slashItems?: SlashMenuItem[];
  onSlashSelect?: (item: SlashMenuItem, ctx: SlashSelectContext) => void;
}

// Phase 7 renderer: delegate to the existing switch component. Non-invasive and
// non-circular (PageBlockView does not import this registry yet).
function DelegatingRenderer({ block, ctx }: { block: PageBlock; ctx: PageCtx }) {
  return <PageBlockView block={block} projectId={ctx.projectId} clientId={ctx.clientId} onChange={ctx.onChange} />;
}

/** Build a native page plugin from the existing PAGE_BLOCK_REGISTRY metadata + factory. */
function native(kind: PageBlockKind): WorkspaceBlockPlugin<PageBlock, PageCtx> {
  const def = pageBlockDef(kind)!;
  return {
    key: kind,
    source: 'native',
    group: def.group,
    title: def.title,
    description: def.description,
    icon: def.icon,
    available: def.available,
    create: def.create,
    renderer: DelegatingRenderer,
  };
}

// Explicit Record over the union — the compile-time exhaustiveness proof.
// A missing kind fails `tsc`; a stray key fails `tsc`. This is ENG-03.
const entries: Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>> = {
  'rich-text': native('rich-text'),
  'heading': native('heading'),
  'divider': native('divider'),
  'list': native('list'),
  'people': native('people'),
  'stat-cards': native('stat-cards'),
  'kpi-grid': native('kpi-grid'),
  'chart': native('chart'),
  'activity-timeline': native('activity-timeline'),
  'program-link': native('program-link'),
  'mini-program': native('mini-program'),
  'kanban': native('kanban'),
  'fleet-telematics': native('fleet-telematics'),
  'spot-quote': native('spot-quote'),
  'exception-radar': native('exception-radar'),
  'omni-chat': native('omni-chat'),
  'smart-inbox': native('smart-inbox'),
  'drafts-kanban': native('drafts-kanban'),
  'yard-map': native('yard-map'),
  'railway-terminal': native('railway-terminal'),
  'pod-tracker': native('pod-tracker'),
  'omni-docs': native('omni-docs'),
  'crm-clients': native('crm-clients'),
  'vat-matrix': native('vat-matrix'),
  'invoices': native('invoices'),
  'ltl-matches': native('ltl-matches'),
  'calendar': native('calendar'),
  'email-campaign': native('email-campaign'),
  'client-current-situation': native('client-current-situation'),
  'client-timeline': native('client-timeline'),
};

export const pageBlockRegistry = new WorkspaceBlockRegistry<PageBlock, PageCtx>(
  entries,
  (block) => block.kind,
);
