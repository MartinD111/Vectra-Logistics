// Items for the "@" inline-mention popover (person/page/date), mirroring
// slashMenu.ts's structure. Unlike the slash menu (pure client-side filter
// over a static registry), mention items require a network fetch per
// keystroke — person/page sources are small company-scoped lists, so no
// debounce/caching is applied.

import { teamApi } from '@/lib/api/team.api';
import { projectsApi } from '@/lib/api/projects.api';

export interface MentionMenuItem {
  id: string;
  type: 'person' | 'page' | 'date';
  label: string;
  subLabel?: string;
  /** lucide icon name (resolved via PageBlockIcon). */
  icon: string;
  /** Value written into the rendered span's data-mention-id. ISO date (YYYY-MM-DD) for `date` items. */
  mentionId: string;
}

const MAX_RESULTS_PER_GROUP = 8;

function parseDateQuery(query: string): MentionMenuItem | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  let date: Date | null = null;
  if (q === 'today') date = new Date();
  else if (q === 'tomorrow') { date = new Date(); date.setDate(date.getDate() + 1); }
  else if (q === 'yesterday') { date = new Date(); date.setDate(date.getDate() - 1); }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const parsed = new Date(`${q}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else {
    const parsed = new Date(query);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return null;

  const isoDate = date.toISOString().slice(0, 10);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { id: `date-${isoDate}`, type: 'date', label, icon: 'Calendar', mentionId: isoDate };
}

/**
 * Resolve mention candidates for the current "@query" text. Person and page
 * sources are fetched fresh and filtered client-side; date parsing is pure
 * client-side (no fetch). Concatenated in People, Pages, Dates order per
 * UI-SPEC's grouping contract.
 */
export async function buildMentionItems(query: string, ctx: { projectId?: string }): Promise<MentionMenuItem[]> {
  const q = query.trim().toLowerCase();

  const personItemsPromise = teamApi.list()
    .then((members) => members
      .filter((m) => `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((m): MentionMenuItem => ({
        id: `person-${m.id}`,
        type: 'person',
        label: `${m.first_name} ${m.last_name}`,
        subLabel: m.email,
        icon: 'User',
        mentionId: m.id,
      })))
    .catch(() => [] as MentionMenuItem[]);

  const pageItemsPromise = ctx.projectId
    ? projectsApi.listPages(ctx.projectId)
      .then((pages) => pages
        .filter((p) => p.title.toLowerCase().includes(q))
        .slice(0, MAX_RESULTS_PER_GROUP)
        .map((p): MentionMenuItem => ({
          id: `page-${p.id}`,
          type: 'page',
          label: p.title,
          subLabel: 'Page',
          icon: 'FileText',
          mentionId: p.id,
        })))
      .catch(() => [] as MentionMenuItem[])
    : Promise.resolve([] as MentionMenuItem[]);

  const [personItems, pageItems] = await Promise.all([personItemsPromise, pageItemsPromise]);
  const dateItem = parseDateQuery(query);

  return [...personItems, ...pageItems, ...(dateItem ? [dateItem] : [])];
}

/**
 * Pass-through identity, kept for interface symmetry with
 * `filterSlashMenuItems`. `buildMentionItems` already performs query-based
 * filtering per source (server for person/page, pure logic for date), so no
 * further client-side re-filtering is needed here — this exists to allow a
 * future caller to re-filter an already-fetched item list without an extra
 * network round-trip.
 */
export function filterMentionItems(items: MentionMenuItem[], _query: string): MentionMenuItem[] {
  return items;
}
