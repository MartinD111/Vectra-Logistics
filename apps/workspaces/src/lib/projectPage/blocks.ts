// Project Page v1 config — a generic, composable "page" attached to a project:
// part Notion-style doc, part dashboard. Unlike mini-program blocks (which
// thread one linear Row[] dataset through a pure evaluate()), page blocks are
// independent widgets that each fetch their own data (stats, KPIs, people,
// activity) keyed on the project id. Stored as-is in project_pages.config
// (JSONB). Contains no domain logic — only generic building blocks.
//
// EXTENSIBILITY CONTRACT: adding a new block kind = (1) add a member to the
// `PageBlock` union here, (2) add a renderer (+ settings panel, if it has
// config) in components/projectPage/blocks, (3) register both in
// PAGE_BLOCK_REGISTRY. Nothing else needs to change.

export type PageBlockKind =
  // Content
  | 'rich-text'
  | 'heading'
  | 'divider'
  | 'list'
  // Data widgets
  | 'people'
  | 'stat-cards'
  | 'kpi-grid'
  | 'chart'
  | 'activity-timeline'
  | 'program-link'
  | 'mini-program'
  | 'kanban'
  // Dispatcher widgets (Phase 2)
  | 'fleet-telematics'
  | 'spot-quote'
  | 'exception-radar'
  | 'omni-chat'
  // Smart Inbox (Phase 3)
  | 'smart-inbox'
  | 'drafts-kanban'
  // Intermodal / yard (Phase 4)
  | 'yard-map'
  | 'railway-terminal'
  // Field execution & documents (Phase 5)
  | 'pod-tracker'
  | 'omni-docs'
  // CRM, VAT & billing (Phase 6)
  | 'crm-clients'
  | 'vat-matrix'
  | 'invoices'
  // Silent LTL matching (Phase 7)
  | 'ltl-matches'
  // Reserved for later phases — registered now so pages built today keep
  // working once these ship (Phase 2 = calendar, Phase 3 = email-campaign).
  | 'calendar'
  | 'email-campaign'
  // Client detail page (Phase 2) — client-scoped widgets, rendered only on
  // /records/[clientId] pages (keyed by clientId, not projectId).
  | 'client-current-situation'
  | 'client-timeline';

/** Column span on the page's CSS grid (grid-cols-6: full=6, half=3, third=2). */
export type BlockSpan = 'full' | 'half' | 'third';

interface PageBlockBase {
  id: string;
  kind: PageBlockKind;
  span: BlockSpan;
}

export interface RichTextBlock extends PageBlockBase {
  kind: 'rich-text';
  /** Sanitised HTML (DOMPurify) authored via a contentEditable surface. */
  html: string;
}

export interface HeadingBlock extends PageBlockBase {
  kind: 'heading';
  text: string;
  level: 1 | 2 | 3;
}

export interface DividerBlock extends PageBlockBase {
  kind: 'divider';
}

export interface ListBlock extends PageBlockBase {
  kind: 'list';
  style: 'bulleted' | 'numbered';
  /** Sanitised HTML (<ul>/<ol> with <li> items), same surface as rich-text. */
  html: string;
}

export interface PeopleBlock extends PageBlockBase {
  kind: 'people';
  title?: string;
}

export interface StatCardsBlock extends PageBlockBase {
  kind: 'stat-cards';
}

export interface KpiGridBlock extends PageBlockBase {
  kind: 'kpi-grid';
  title?: string;
}

export type ChartSource = 'activity-by-day' | 'activity-by-verb' | 'kpi-results';
export type ChartType = 'bar' | 'line';

export interface ChartBlock extends PageBlockBase {
  kind: 'chart';
  title?: string;
  source: ChartSource;
  chartType: ChartType;
}

export interface ActivityTimelineBlock extends PageBlockBase {
  kind: 'activity-timeline';
  title?: string;
  pageSize: number;
}

export interface ProgramLinkBlock extends PageBlockBase {
  kind: 'program-link';
  /** Empty = show all programs in the project. */
  programId?: string | null;
}

export interface MiniProgramBlock extends PageBlockBase {
  kind: 'mini-program';
  /** null = unconfigured placeholder — pick a program in settings. */
  programId: string | null;
}

export interface KanbanCard {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

// Phase 1: a config-local board (cards live in the page config). Later phases
// rewire columns/cards to live shipment/draft data.
export interface KanbanBlock extends PageBlockBase {
  kind: 'kanban';
  title?: string;
  columns: KanbanColumn[];
}

// ── Dispatcher widgets (Phase 2) ─────────────────────────────────────────────

export interface FleetTelematicsBlock extends PageBlockBase {
  kind: 'fleet-telematics';
  title?: string;
  /** Cap the number of trucks shown (0 = all). */
  maxVehicles: number;
}

export interface SpotQuoteBlock extends PageBlockBase {
  kind: 'spot-quote';
  title?: string;
  /** Default margin suggestion applied on top of break-even. */
  defaultMarginPct: number;
}

export interface ExceptionRadarBlock extends PageBlockBase {
  kind: 'exception-radar';
  title?: string;
}

export interface OmniChatBlock extends PageBlockBase {
  kind: 'omni-chat';
  title?: string;
  /** Auto-translate incoming messages to this language ('' = off). */
  translateTo: string;
}

// ── Smart Inbox (Phase 3) ─────────────────────────────────────────────────────

export interface SmartInboxBlock extends PageBlockBase {
  kind: 'smart-inbox';
  title?: string;
}

// Drafts board — columns are derived from live draft-shipment status, not
// stored in config (unlike the generic `kanban` block).
export interface DraftsKanbanBlock extends PageBlockBase {
  kind: 'drafts-kanban';
  title?: string;
}

// ── Intermodal / yard (Phase 4) ───────────────────────────────────────────────

export interface YardMapBlock extends PageBlockBase {
  kind: 'yard-map';
  title?: string;
}

export interface RailwayTerminalBlock extends PageBlockBase {
  kind: 'railway-terminal';
  title?: string;
}

// ── Field execution & documents (Phase 5) ─────────────────────────────────────

export interface PodTrackerBlock extends PageBlockBase {
  kind: 'pod-tracker';
  title?: string;
}

export interface OmniDocsBlock extends PageBlockBase {
  kind: 'omni-docs';
  title?: string;
}

// ── CRM, VAT & billing (Phase 6) ──────────────────────────────────────────────

export interface CrmClientsBlock extends PageBlockBase {
  kind: 'crm-clients';
  title?: string;
}

export interface VatMatrixBlock extends PageBlockBase {
  kind: 'vat-matrix';
  title?: string;
}

export interface InvoicesBlock extends PageBlockBase {
  kind: 'invoices';
  title?: string;
}

// ── Silent LTL matching (Phase 7) ─────────────────────────────────────────────

export interface LtlMatchesBlock extends PageBlockBase {
  kind: 'ltl-matches';
  title?: string;
}

export interface CalendarBlock extends PageBlockBase {
  kind: 'calendar';
}

export interface EmailCampaignBlock extends PageBlockBase {
  kind: 'email-campaign';
}

// ── Client detail page (Phase 2) ──────────────────────────────────────────────

export interface ClientCurrentSituationBlock extends PageBlockBase {
  kind: 'client-current-situation';
  title?: string;
}

export interface ClientTimelineBlock extends PageBlockBase {
  kind: 'client-timeline';
  title?: string;
}

export type PageBlock =
  | RichTextBlock
  | HeadingBlock
  | DividerBlock
  | ListBlock
  | PeopleBlock
  | StatCardsBlock
  | KpiGridBlock
  | ChartBlock
  | ActivityTimelineBlock
  | ProgramLinkBlock
  | MiniProgramBlock
  | KanbanBlock
  | FleetTelematicsBlock
  | SpotQuoteBlock
  | ExceptionRadarBlock
  | OmniChatBlock
  | SmartInboxBlock
  | DraftsKanbanBlock
  | YardMapBlock
  | RailwayTerminalBlock
  | PodTrackerBlock
  | OmniDocsBlock
  | CrmClientsBlock
  | VatMatrixBlock
  | InvoicesBlock
  | LtlMatchesBlock
  | CalendarBlock
  | EmailCampaignBlock
  | ClientCurrentSituationBlock
  | ClientTimelineBlock;

export interface PageConfig {
  version: 1;
  blocks: PageBlock[];
}

export function isPageConfig(cfg: unknown): cfg is PageConfig {
  return !!cfg && typeof cfg === 'object' && (cfg as { version?: unknown }).version === 1
    && Array.isArray((cfg as { blocks?: unknown }).blocks);
}

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function emptyPageConfig(): PageConfig {
  return { version: 1, blocks: [] };
}

// ── Block registry ────────────────────────────────────────────────────────────
// Central metadata + factory for every block kind. The palette is generated
// from this list. Renderers/settings live in components/projectPage/blocks,
// keyed by `kind`.

export type PageBlockGroup = 'content' | 'widget' | 'soon';

export interface PageBlockDef {
  kind: PageBlockKind;
  group: PageBlockGroup;
  title: string;
  description: string;
  /** lucide icon name (resolved in the UI). */
  icon: string;
  /** Whether this kind ships a working renderer yet (false = "coming soon" placeholder). */
  available: boolean;
  create: () => PageBlock;
}

export const PAGE_BLOCK_REGISTRY: PageBlockDef[] = [
  {
    kind: 'heading', group: 'content', title: 'Heading', icon: 'Heading',
    description: 'A section title.', available: true,
    create: () => ({ id: uid(), kind: 'heading', span: 'full', text: 'Section', level: 2 }),
  },
  {
    kind: 'rich-text', group: 'content', title: 'Text', icon: 'Type',
    description: 'Rich text — notes, briefs, instructions.', available: true,
    // Empty on purpose: the canvas shows a "Type '/' for commands" placeholder,
    // and the slash trigger only fires at block start / after whitespace.
    create: () => ({ id: uid(), kind: 'rich-text', span: 'full', html: '' }),
  },
  {
    kind: 'list', group: 'content', title: 'Bulleted list', icon: 'List',
    description: 'A simple bulleted or numbered list.', available: true,
    create: () => ({ id: uid(), kind: 'list', span: 'full', style: 'bulleted', html: '<ul><li></li></ul>' }),
  },
  {
    kind: 'divider', group: 'content', title: 'Divider', icon: 'Minus',
    description: 'A horizontal rule to separate sections.', available: true,
    create: () => ({ id: uid(), kind: 'divider', span: 'full' }),
  },
  {
    kind: 'people', group: 'widget', title: 'People', icon: 'Users',
    description: 'Team members assigned to this project.', available: true,
    create: () => ({ id: uid(), kind: 'people', span: 'half', title: 'People' }),
  },
  {
    kind: 'stat-cards', group: 'widget', title: 'Stat cards', icon: 'Gauge',
    description: 'Programs, events and last-7-days counters.', available: true,
    create: () => ({ id: uid(), kind: 'stat-cards', span: 'full' }),
  },
  {
    kind: 'kpi-grid', group: 'widget', title: 'KPI grid', icon: 'Target',
    description: 'KPI results computed for this project.', available: true,
    create: () => ({ id: uid(), kind: 'kpi-grid', span: 'half', title: 'KPIs' }),
  },
  {
    kind: 'chart', group: 'widget', title: 'Chart', icon: 'BarChart3',
    description: 'A bar or line chart over activity or KPI results.', available: true,
    create: () => ({ id: uid(), kind: 'chart', span: 'half', title: 'Activity', source: 'activity-by-day', chartType: 'bar' }),
  },
  {
    kind: 'activity-timeline', group: 'widget', title: 'Activity timeline', icon: 'History',
    description: 'A live feed of what happened on this project.', available: true,
    create: () => ({ id: uid(), kind: 'activity-timeline', span: 'full', title: 'Activity', pageSize: 20 }),
  },
  {
    kind: 'program-link', group: 'widget', title: 'Program link', icon: 'FileCode2',
    description: 'A card linking to a mini program in this project.', available: true,
    create: () => ({ id: uid(), kind: 'program-link', span: 'third', programId: null }),
  },
  {
    kind: 'mini-program', group: 'widget', title: 'Mini program', icon: 'Play',
    description: 'Embed a runnable mini program directly on the page.', available: true,
    create: () => ({ id: uid(), kind: 'mini-program', span: 'full', programId: null }),
  },
  {
    kind: 'kanban', group: 'widget', title: 'Kanban board', icon: 'Kanban',
    description: 'A simple board with columns and cards, stored on this page.', available: true,
    create: () => ({
      id: uid(), kind: 'kanban', span: 'full', title: 'Board',
      columns: [
        { id: uid(), title: 'To do', cards: [] },
        { id: uid(), title: 'In progress', cards: [] },
        { id: uid(), title: 'Done', cards: [] },
      ],
    }),
  },
  {
    kind: 'fleet-telematics', group: 'widget', title: 'My fleet', icon: 'Truck',
    description: 'Live trucks: ETA progress and AETR tachograph hours with violation warnings.', available: true,
    create: () => ({ id: uid(), kind: 'fleet-telematics', span: 'full', title: 'My fleet', maxVehicles: 0 }),
  },
  {
    kind: 'spot-quote', group: 'widget', title: 'Spot quote', icon: 'Calculator',
    description: 'Break-even rate calculator: fuel, tolls and driver cost with a margin suggestion.', available: true,
    create: () => ({ id: uid(), kind: 'spot-quote', span: 'half', title: 'Spot quote', defaultMarginPct: 12 }),
  },
  {
    kind: 'exception-radar', group: 'widget', title: 'Exception radar', icon: 'Radar',
    description: 'Live crises feed: border delays, port congestion, wagon damage, engine faults.', available: true,
    create: () => ({ id: uid(), kind: 'exception-radar', span: 'half', title: 'Exception radar' }),
  },
  {
    kind: 'smart-inbox', group: 'widget', title: 'Smart inbox', icon: 'ScanText',
    description: 'Paste a broker email or railway update — AI extracts a draft load and validates it.', available: true,
    create: () => ({ id: uid(), kind: 'smart-inbox', span: 'half', title: 'Smart inbox' }),
  },
  {
    kind: 'drafts-kanban', group: 'widget', title: 'Drafts board', icon: 'ClipboardCheck',
    description: 'Kanban of AI-parsed draft shipments: needs review → validated → confirmed.', available: true,
    create: () => ({ id: uid(), kind: 'drafts-kanban', span: 'full', title: 'Draft shipments' }),
  },
  {
    kind: 'yard-map', group: 'widget', title: 'Yard map', icon: 'Warehouse',
    description: '2D yard floor plan: zones and slots, with live gate check-ins you can drag onto slots.', available: true,
    create: () => ({ id: uid(), kind: 'yard-map', span: 'full', title: 'Yard map' }),
  },
  {
    kind: 'railway-terminal', group: 'widget', title: 'Railway terminal', icon: 'TrainTrack',
    description: 'Rail wagon board: In port → Loading sequence → In transit → Discharging.', available: true,
    create: () => ({ id: uid(), kind: 'railway-terminal', span: 'full', title: 'Railway terminal' }),
  },
  {
    kind: 'pod-tracker', group: 'widget', title: 'Proof of delivery', icon: 'PackageCheck',
    description: 'Send drivers a single-use photo-upload link; PODs land here live when captured.', available: true,
    create: () => ({ id: uid(), kind: 'pod-tracker', span: 'half', title: 'Proof of delivery' }),
  },
  {
    kind: 'omni-docs', group: 'widget', title: 'Rail documents', icon: 'FileText',
    description: 'Generate intermodal PDFs: CIM, CUV, CIT7, CIT20 and port loading lists.', available: true,
    create: () => ({ id: uid(), kind: 'omni-docs', span: 'half', title: 'Rail documents' }),
  },
  {
    kind: 'crm-clients', group: 'widget', title: 'Clients (CRM)', icon: 'Building2',
    description: 'Customers with credit limits — over-limit clients are blocked from new loads.', available: true,
    create: () => ({ id: uid(), kind: 'crm-clients', span: 'half', title: 'Clients' }),
  },
  {
    kind: 'vat-matrix', group: 'widget', title: 'Smart VAT', icon: 'Percent',
    description: 'Standard VAT, 0% export, or EU reverse charge — decided from countries + VAT ID.', available: true,
    create: () => ({ id: uid(), kind: 'vat-matrix', span: 'half', title: 'Smart VAT' }),
  },
  {
    kind: 'invoices', group: 'widget', title: 'Invoices', icon: 'Receipt',
    description: 'Auto-drafted on delivery with VAT applied and the POD attached; approve here.', available: true,
    create: () => ({ id: uid(), kind: 'invoices', span: 'half', title: 'Invoices' }),
  },
  {
    kind: 'ltl-matches', group: 'widget', title: 'LTL matches', icon: 'Sparkles',
    description: 'Silent engine: fits unassigned partial loads onto active FTL routes, ranked by margin.', available: true,
    create: () => ({ id: uid(), kind: 'ltl-matches', span: 'half', title: 'LTL matches' }),
  },
  {
    kind: 'omni-chat', group: 'widget', title: 'Omnichannel chat', icon: 'MessagesSquare',
    description: 'Unified project thread: WhatsApp, email and internal messages with auto-translate.', available: true,
    create: () => ({ id: uid(), kind: 'omni-chat', span: 'half', title: 'Chat', translateTo: '' }),
  },
  {
    kind: 'calendar', group: 'widget', title: 'Calendar', icon: 'Calendar',
    description: 'Meetings synced from Outlook and categorized to this project.', available: true,
    create: () => ({ id: uid(), kind: 'calendar', span: 'full' }),
  },
  {
    kind: 'email-campaign', group: 'widget', title: 'Email campaign', icon: 'Mail',
    description: 'Send a tracked email campaign via Outlook, with per-recipient open tracking.', available: true,
    create: () => ({ id: uid(), kind: 'email-campaign', span: 'full' }),
  },
  {
    kind: 'client-current-situation', group: 'widget', title: 'Current situation', icon: 'Mail',
    description: 'Last 10 emails sent to this client.', available: true,
    create: () => ({ id: uid(), kind: 'client-current-situation', span: 'full', title: 'Current situation' }),
  },
  {
    kind: 'client-timeline', group: 'widget', title: 'Timeline', icon: 'Clock',
    description: 'Unified feed of emails, invoices, and KPI activity for this client.', available: true,
    create: () => ({ id: uid(), kind: 'client-timeline', span: 'full', title: 'Timeline' }),
  },
];

export function pageBlockDef(kind: PageBlockKind): PageBlockDef | undefined {
  return PAGE_BLOCK_REGISTRY.find((b) => b.kind === kind);
}

export const SPAN_COLS: Record<BlockSpan, number> = { full: 6, half: 3, third: 2 };

// ── Page header settings ──────────────────────────────────────────────────────
// Stored in project_pages.header_settings (JSONB). Frontend-owned; the API
// validates the envelope only (full_width boolean, cover_position 0–100).

export interface PageHeaderSettings {
  full_width: boolean;
  /** Vertical background-position offset of the cover image, 0–100 (%). */
  cover_position: number;
}

export function parseHeaderSettings(raw: unknown): PageHeaderSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pos = typeof obj.cover_position === 'number' ? obj.cover_position : 50;
  return {
    full_width: obj.full_width === true,
    cover_position: Math.min(100, Math.max(0, pos)),
  };
}
