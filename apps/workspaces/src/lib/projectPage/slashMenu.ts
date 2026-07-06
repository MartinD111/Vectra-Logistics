// Items for the "/" slash-command menu (and the + insert menu). Derived from
// PAGE_BLOCK_REGISTRY — the registry is one-entry-per-kind, so variants like
// Heading 1/2/3 and Bulleted/Numbered list are expanded here with their own
// create() closures. Keywords power fuzzy-ish filtering (case-insensitive
// substring over title + keywords).

import {
  uid,
  type PageBlock, type PageBlockGroup, type PageBlockKind,
} from './blocks';
import { pageBlockRegistry } from './registry';

export interface SlashMenuItem {
  id: string;
  kind: PageBlockKind;
  title: string;
  description: string;
  keywords: string[];
  /** lucide icon name (resolved via PageBlockIcon). */
  icon: string;
  group: PageBlockGroup;
  create: () => PageBlock;
}

const EXTRA_KEYWORDS: Partial<Record<PageBlockKind, string[]>> = {
  'rich-text': ['text', 'paragraph', 'note', 'write'],
  'kanban': ['board', 'columns', 'cards', 'tasks'],
  'mini-program': ['program', 'embed', 'app', 'tool'],
  'kpi-grid': ['kpi', 'live', 'metrics', 'targets'],
  'stat-cards': ['stats', 'counters', 'numbers'],
  'chart': ['graph', 'bar', 'line'],
  'activity-timeline': ['feed', 'history', 'log'],
  'people': ['team', 'members'],
  'calendar': ['meetings', 'events', 'outlook'],
  'email-campaign': ['mail', 'outreach'],
  'program-link': ['link', 'shortcut'],
  'divider': ['rule', 'separator', 'line', 'hr'],
  'fleet-telematics': ['fleet', 'trucks', 'telematics', 'gps', 'tachograph', 'aetr', 'eta', 'geotab', 'samsara'],
  'spot-quote': ['quote', 'rate', 'price', 'calculator', 'toll', 'fuel', 'break-even', 'cost'],
  'exception-radar': ['exception', 'radar', 'alerts', 'crisis', 'delays', 'incidents', 'border', 'congestion'],
  'omni-chat': ['chat', 'messages', 'whatsapp', 'email', 'omnichannel', 'communication', 'translate'],
  'smart-inbox': ['inbox', 'email', 'parse', 'ai', 'extract', 'broker', 'draft', 'load'],
  'drafts-kanban': ['drafts', 'board', 'kanban', 'shipments', 'review', 'pipeline', 'loads'],
  'yard-map': ['yard', 'map', 'floor', 'slots', 'zones', 'parking', 'container', 'gate', 'anpr', 'spatial'],
  'railway-terminal': ['railway', 'rail', 'wagons', 'terminal', 'train', 'intermodal', 'loading'],
  'pod-tracker': ['pod', 'proof', 'delivery', 'driver', 'photo', 'scan', 'field', 'signature'],
  'omni-docs': ['documents', 'docs', 'cim', 'cuv', 'cit', 'consignment', 'rail', 'pdf', 'generate', 'port'],
  'crm-clients': ['crm', 'clients', 'customers', 'credit', 'limit', 'balance', 'companies'],
  'vat-matrix': ['vat', 'tax', 'reverse', 'charge', 'export', 'matrix', 'rate'],
  'invoices': ['invoices', 'billing', 'receivables', 'approve', 'paid', 'quote-to-cash', 'money'],
  'ltl-matches': ['ltl', 'matches', 'partial', 'consolidation', 'empty', 'space', 'detour', 'backhaul', 'optimize'],
};

export function buildSlashMenuItems(): SlashMenuItem[] {
  const items: SlashMenuItem[] = [];

  // Heading variants replace the single registry "heading" entry.
  ([1, 2, 3] as const).forEach((level) => {
    items.push({
      id: `heading-${level}`, kind: 'heading',
      title: `Heading ${level}`,
      description: level === 1 ? 'A large section title.' : level === 2 ? 'A medium section title.' : 'A small section title.',
      keywords: ['heading', 'title', `h${level}`],
      icon: `Heading${level}`, group: 'content',
      create: () => ({ id: uid(), kind: 'heading', span: 'full', text: '', level }),
    });
  });

  // List variants replace the single registry "list" entry.
  items.push({
    id: 'list-bulleted', kind: 'list', title: 'Bulleted list',
    description: 'A simple bulleted list.',
    keywords: ['list', 'bullet', 'ul'],
    icon: 'List', group: 'content',
    create: () => ({ id: uid(), kind: 'list', span: 'full', style: 'bulleted', html: '<ul><li></li></ul>' }),
  });
  items.push({
    id: 'list-numbered', kind: 'list', title: 'Numbered list',
    description: 'A list with numbering.',
    keywords: ['list', 'numbered', 'ordered', 'ol'],
    icon: 'ListOrdered', group: 'content',
    create: () => ({ id: uid(), kind: 'list', span: 'full', style: 'numbered', html: '<ol><li></li></ol>' }),
  });

  // Derived from the page block registry (one entry per kind). Heading and list
  // are hand-expanded into variants above, so skip their single registry entries.
  for (const plugin of pageBlockRegistry.list()) {
    const kind = plugin.key as PageBlockKind;
    if (plugin.available === false || kind === 'heading' || kind === 'list') continue;
    items.push({
      id: kind, kind, title: plugin.title, description: plugin.description,
      keywords: [plugin.title.toLowerCase(), ...(EXTRA_KEYWORDS[kind] ?? [])],
      icon: plugin.icon, group: plugin.group as PageBlockGroup,
      create: plugin.create,
    });
  }
  return items;
}

export function filterSlashMenuItems(items: SlashMenuItem[], query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) =>
    it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.includes(q)));
}

/** Content kinds may transform the current (empty) text block in place; widgets always insert below. */
export function isContentItem(item: SlashMenuItem): boolean {
  return item.group === 'content';
}
