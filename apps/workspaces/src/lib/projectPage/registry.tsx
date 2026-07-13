'use client';

// Project-page instance of the Workspace Engine — the single dispatch point
// that replaces the hand-maintained switch statements in PageBlockView (read)
// and, from Phase 9, LivePageCanvas (edit).
//
// Each entry is a native plugin whose `renderer` is a thin adapter arrow that
// maps PageCtx → the existing view component's props (exactly as the old switch
// did). The view components are unchanged; only this file knows how to wire
// them. No import of PageBlockView here (it imports us) — so there is no cycle.

import type { ComponentType } from 'react';
import type {
  PageBlock, PageBlockKind,
  RichTextBlock, HeadingBlock, CalloutBlock, ListBlock, ChecklistBlock, QuoteBlock, CodeBlock,
  PeopleBlock, StatCardsBlock, KpiGridBlock,
  ChartBlock, ActivityTimelineBlock, ProgramLinkBlock, MiniProgramBlock, KanbanBlock,
  FleetTelematicsBlock, SpotQuoteBlock, ExceptionRadarBlock, OmniChatBlock, SmartInboxBlock,
  DraftsKanbanBlock, YardMapBlock, RailwayTerminalBlock, PodTrackerBlock, OmniDocsBlock,
  CrmClientsBlock, VatMatrixBlock, InvoicesBlock, LtlMatchesBlock,
  ClientCurrentSituationBlock, ClientTimelineBlock,
} from './blocks';
import { pageBlockDef } from './blocks';
import {
  WorkspaceBlockRegistry, type WorkspaceBlockPlugin, type BlockRenderProps, type BlockEditProps,
} from '@/lib/workspaceEngine';
import type { SlashMenuItem } from './slashMenu';
import { EditableRichText, type SlashSelectContext } from '@/components/projectPage/EditableRichText';
import { EditableHeading } from '@/components/projectPage/EditableHeading';
import { CalloutView, CalloutEditor } from '@/components/projectPage/CalloutBlock';
import { ChecklistView, ChecklistEditor } from '@/components/projectPage/ChecklistBlock';
import { QuoteView, QuoteEditor } from '@/components/projectPage/QuoteBlock';
import { CodeView, CodeEditor } from '@/components/projectPage/CodeBlock';
import {
  HeadingView, RichTextView, ListView, DividerView, MiniProgramEmbedView,
  PeopleView, StatCardsView, KpiGridView, ChartWidgetView, ActivityTimelineView,
  ProgramLinkView, CalendarView,
} from '@/components/projectPage/pageBlockViews';
import { EmailCampaignView } from '@/components/projectPage/EmailCampaignBlock';
import { KanbanBoardView } from '@/components/projectPage/KanbanBlock';
import { FleetTelematicsView } from '@/components/projectPage/FleetTelematicsBlock';
import { SpotQuoteView } from '@/components/projectPage/SpotQuoteBlock';
import { ExceptionRadarView } from '@/components/projectPage/ExceptionRadarBlock';
import { OmniChatView } from '@/components/projectPage/OmniChatBlock';
import { SmartInboxView } from '@/components/projectPage/SmartInboxBlock';
import { DraftsKanbanView } from '@/components/projectPage/DraftsKanbanBlock';
import { YardMapView } from '@/components/projectPage/YardMapBlock';
import { RailwayTerminalView } from '@/components/projectPage/RailwayTerminalBlock';
import { PodTrackerView } from '@/components/projectPage/PodTrackerBlock';
import { OmniDocsView } from '@/components/projectPage/OmniDocsBlock';
import { CrmClientsView } from '@/components/projectPage/CrmClientsBlock';
import { VatMatrixView } from '@/components/projectPage/VatMatrixBlock';
import { InvoicesView } from '@/components/projectPage/InvoicesBlock';
import { LtlMatchesView } from '@/components/projectPage/LtlMatchesBlock';
import { ClientCurrentSituationBlockView } from '@/components/projectPage/ClientCurrentSituationBlock';
import { ClientTimelineBlockView } from '@/components/projectPage/ClientTimelineBlock';

/** Render/edit context threaded to page block plugins. */
export interface PageCtx {
  projectId?: string;
  /** Set only on the client detail page (/records/[clientId]) canvas. */
  clientId?: string;
  /** Present on the live canvas — lets interactive widgets write back to config. */
  onChange?: (block: PageBlock) => void;
  /** Edit-mode only (used by the rich-text/list editors in Phase 9). */
  slashItems?: SlashMenuItem[];
  onSlashSelect?: (item: SlashMenuItem, ctx: SlashSelectContext) => void;
}

type Renderer = ComponentType<BlockRenderProps<PageBlock, PageCtx>>;
type Editor = ComponentType<BlockEditProps<PageBlock, PageCtx>>;

/** Build a native page plugin from existing PAGE_BLOCK_REGISTRY metadata + factory. */
function entry(kind: PageBlockKind, renderer: Renderer, editor?: Editor): WorkspaceBlockPlugin<PageBlock, PageCtx> {
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
    renderer,
    editor,
  };
}

// Explicit Record over the union — the compile-time exhaustiveness proof (ENG-03).
// Adapter arrows mirror the old PageBlockView switch exactly (including the
// projectId/clientId non-null assertions the switch made via `as string`).
// Entry order mirrors PAGE_BLOCK_REGISTRY so pageBlockRegistry.list() (which
// feeds the slash/insert palette) preserves the original palette order.
const entries: Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>> = {
  'heading': entry('heading',
    ({ block }) => <HeadingView block={block as HeadingBlock} />,
    ({ block, onUpdate }) => (
      <EditableHeading
        level={(block as HeadingBlock).level}
        text={(block as HeadingBlock).text}
        onChange={(text) => onUpdate({ ...(block as HeadingBlock), text })}
      />
    ),
  ),
  'rich-text': entry('rich-text',
    ({ block }) => <RichTextView block={block as RichTextBlock} />,
    ({ block, ctx, onUpdate }) => (
      <EditableRichText
        html={(block as RichTextBlock).html}
        onChange={(html) => onUpdate({ ...(block as RichTextBlock), html })}
        placeholder="Type '/' for commands…"
        slashItems={ctx.slashItems!}
        onSlashSelect={ctx.onSlashSelect!}
      />
    ),
  ),
  'list': entry('list',
    ({ block }) => <ListView block={block as ListBlock} />,
    ({ block, ctx, onUpdate }) => (
      <EditableRichText
        html={(block as ListBlock).html}
        onChange={(html) => onUpdate({ ...(block as ListBlock), html })}
        slashItems={ctx.slashItems!}
        onSlashSelect={ctx.onSlashSelect!}
      />
    ),
  ),
  'divider': entry('divider', () => <DividerView />),
  'callout': entry('callout',
    ({ block }) => <CalloutView block={block as CalloutBlock} />,
    ({ block, onUpdate }) => <CalloutEditor block={block as CalloutBlock} onUpdate={(b) => onUpdate(b)} />,
  ),
  'checklist': entry('checklist',
    ({ block, ctx }) => <ChecklistView block={block as ChecklistBlock} onChange={ctx.onChange} />,
    ({ block, onUpdate }) => <ChecklistEditor block={block as ChecklistBlock} onUpdate={onUpdate} />,
  ),
  'quote': entry('quote',
    ({ block }) => <QuoteView block={block as QuoteBlock} />,
    ({ block, onUpdate }) => <QuoteEditor block={block as QuoteBlock} onUpdate={(b) => onUpdate(b)} />,
  ),
  'code': entry('code',
    ({ block }) => <CodeView block={block as CodeBlock} />,
    ({ block, onUpdate }) => <CodeEditor block={block as CodeBlock} onUpdate={(b) => onUpdate(b)} />,
  ),
  'people': entry('people', ({ block, ctx }) => <PeopleView block={block as PeopleBlock} projectId={ctx.projectId as string} />),
  'stat-cards': entry('stat-cards', ({ block, ctx }) => <StatCardsView block={block as StatCardsBlock} projectId={ctx.projectId as string} />),
  'kpi-grid': entry('kpi-grid', ({ block, ctx }) => <KpiGridView block={block as KpiGridBlock} projectId={ctx.projectId as string} />),
  'chart': entry('chart', ({ block, ctx }) => <ChartWidgetView block={block as ChartBlock} projectId={ctx.projectId as string} />),
  'activity-timeline': entry('activity-timeline', ({ block, ctx }) => <ActivityTimelineView block={block as ActivityTimelineBlock} projectId={ctx.projectId as string} />),
  'program-link': entry('program-link', ({ block, ctx }) => <ProgramLinkView block={block as ProgramLinkBlock} projectId={ctx.projectId as string} />),
  'mini-program': entry('mini-program', ({ block }) => <MiniProgramEmbedView block={block as MiniProgramBlock} />),
  'kanban': entry('kanban',
    ({ block, ctx }) => <KanbanBoardView block={block as KanbanBlock} onChange={ctx.onChange} />,
    ({ block, onUpdate }) => <KanbanBoardView block={block as KanbanBlock} onChange={onUpdate} />,
  ),
  'fleet-telematics': entry('fleet-telematics', ({ block }) => <FleetTelematicsView block={block as FleetTelematicsBlock} />),
  'spot-quote': entry('spot-quote', ({ block }) => <SpotQuoteView block={block as SpotQuoteBlock} />),
  'exception-radar': entry('exception-radar', ({ block }) => <ExceptionRadarView block={block as ExceptionRadarBlock} />),
  'smart-inbox': entry('smart-inbox', ({ block, ctx }) => <SmartInboxView block={block as SmartInboxBlock} projectId={ctx.projectId as string} />),
  'drafts-kanban': entry('drafts-kanban', ({ block, ctx }) => <DraftsKanbanView block={block as DraftsKanbanBlock} projectId={ctx.projectId as string} />),
  'yard-map': entry('yard-map', ({ block, ctx }) => <YardMapView block={block as YardMapBlock} projectId={ctx.projectId as string} />),
  'railway-terminal': entry('railway-terminal', ({ block }) => <RailwayTerminalView block={block as RailwayTerminalBlock} />),
  'pod-tracker': entry('pod-tracker', ({ block }) => <PodTrackerView block={block as PodTrackerBlock} />),
  'omni-docs': entry('omni-docs', ({ block }) => <OmniDocsView block={block as OmniDocsBlock} />),
  'crm-clients': entry('crm-clients', ({ block }) => <CrmClientsView block={block as CrmClientsBlock} />),
  'vat-matrix': entry('vat-matrix', ({ block }) => <VatMatrixView block={block as VatMatrixBlock} />),
  'invoices': entry('invoices', ({ block }) => <InvoicesView block={block as InvoicesBlock} />),
  'ltl-matches': entry('ltl-matches', ({ block }) => <LtlMatchesView block={block as LtlMatchesBlock} />),
  'omni-chat': entry('omni-chat', ({ block, ctx }) => <OmniChatView block={block as OmniChatBlock} projectId={ctx.projectId as string} />),
  'calendar': entry('calendar', ({ ctx }) => <CalendarView projectId={ctx.projectId as string} />),
  'email-campaign': entry('email-campaign', ({ ctx }) => <EmailCampaignView projectId={ctx.projectId as string} />),
  'client-current-situation': entry('client-current-situation', ({ block, ctx }) => <ClientCurrentSituationBlockView block={block as ClientCurrentSituationBlock} clientId={ctx.clientId as string} />),
  'client-timeline': entry('client-timeline', ({ block, ctx }) => <ClientTimelineBlockView block={block as ClientTimelineBlock} clientId={ctx.clientId as string} />),
};

export const pageBlockRegistry = new WorkspaceBlockRegistry<PageBlock, PageCtx>(
  entries,
  (block) => block.kind,
);
