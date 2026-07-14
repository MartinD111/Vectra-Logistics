// Phase 24 (BOARD-04): lazy, zero-data-loss migration of legacy `kanban`
// blocks (page-JSON columns/cards) into the real `collection-view` board
// engine. Never runs on page load — only orchestrated by
// KanbanMigrationGate.tsx on the first edit to an existing kanban block.
//
// buildMigrationPlan is a pure transform (no network calls) so it can be
// unit-tested in isolation; migrateOnFirstEdit is the async orchestration
// that actually talks to the records API.

import { uid, type KanbanBlock, type CollectionViewBlock } from './blocks';
import { recordsApi, type CollectionPropertyDef } from '../api/records.api';

export interface MigrationPlanRecord {
  props: Record<string, unknown>;
  /** Position within its own column (0-based) — NOT a global order. */
  sort_order: number;
}

export interface MigrationPlan {
  titlePropId: string;
  statusPropId: string;
  schema: CollectionPropertyDef[];
  records: MigrationPlanRecord[];
}

/**
 * Pure transform: KanbanBlock -> { schema, records } plan for the new
 * collection engine. Column identity is preserved by reusing each column's
 * own `id` as its Status select option's `id` (never a freshly generated id)
 * — this keeps column rename free/stable post-migration, since grouping
 * matches by option id, not label (see BoardBlock.tsx's rename convention).
 */
export function buildMigrationPlan(kanban: KanbanBlock): MigrationPlan {
  const titlePropId = uid();
  const statusPropId = uid();

  const statusOptions = kanban.columns.map((col) => ({ id: col.id, label: col.title }));

  const schema: CollectionPropertyDef[] = [
    { id: titlePropId, name: 'Title', type: 'text' },
    { id: statusPropId, name: 'Status', type: 'select', options: statusOptions },
  ];

  const records: MigrationPlanRecord[] = kanban.columns.flatMap((col) =>
    col.cards.map((card, cardIdx) => ({
      props: { [titlePropId]: card.text, [statusPropId]: col.id },
      sort_order: cardIdx,
    })),
  );

  return { titlePropId, statusPropId, schema, records };
}

/**
 * Orchestrates the actual migration: creates the collection + board view,
 * then persists every card as a record with its original within-column
 * sort_order. Returns the CollectionViewBlock the caller should swap the
 * legacy kanban block for.
 *
 * Sequential ordering: createCollection must resolve before createView
 * (createView needs the collection's id); createView must resolve before
 * any createRecord call (records aren't written until the view/groupBy
 * exists). Per-card create+update pairs may run concurrently with each
 * other via Promise.all — only the create->update pair within a single
 * card needs to be sequential (the update needs the created record's id).
 *
 * sort_order can ONLY be set via updateRecord — CreateRecordInput has no
 * sort_order field and the backend's CreateRecordSchema silently strips
 * one if sent on create, so every card's position must be persisted with a
 * follow-up updateRecord call, never spread into the createRecord body.
 */
export async function migrateOnFirstEdit(kanban: KanbanBlock): Promise<CollectionViewBlock> {
  const plan = buildMigrationPlan(kanban);

  const { collection } = await recordsApi.createCollection({
    name: kanban.title ?? 'Board',
    schema: plan.schema,
  });

  const view = await recordsApi.createView(collection.id, {
    name: 'Board',
    type: 'board',
    config: { groupBy: plan.statusPropId },
  });

  await Promise.all(plan.records.map(async (r) => {
    const created = await recordsApi.createRecord(collection.id, { props: r.props });
    await recordsApi.updateRecord(created.id, { sort_order: r.sort_order });
  }));

  return {
    id: kanban.id,
    kind: 'collection-view',
    span: kanban.span,
    title: kanban.title,
    collectionId: collection.id,
    viewId: view.id,
  };
}
