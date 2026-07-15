'use client';

// Board block (collection-view) — a real drag-and-drop board grouped by a
// select property, backed by a data_collection/collection_views row (Phase 24).
// Replaces the config-local `kanban` block. On first insert (block.collectionId
// === null) this auto-provisions a default collection + board view (D-04):
// a Title text property, a Status select property (To Do / In Progress / Done),
// and a board view grouped by Status — no "pick a collection" picker.

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { uid, type CollectionViewBlock } from '@/lib/projectPage/blocks';
import { recordsApi, type CollectionPropertyDef, type CollectionRecord } from '@/lib/api/records.api';
import {
  useCollection, useView, useRecords, useCreateCollection, useUpdateAnyRecord,
} from '@/lib/hooks/useRecords';
import {
  applyFilters, applySorts, type FilterCondition, type SortCondition, type AggregationConfig,
} from '@/lib/projectPage/viewFilters';
import { BoardColumn } from './board/BoardColumn';
import { AddColumnControl } from './board/AddColumnControl';
import { FilterSortToolbar } from './board/FilterSortToolbar';
import { ViewSettingsMenu } from './board/ViewSettingsMenu';
import { ViewSwitcher } from './board/ViewSwitcher';
import { CollectionTableView } from './collectionTable/CollectionTableView';
import { CollectionListView } from './collectionList/CollectionListView';
import { CollectionCalendarView } from './collectionCalendar/CollectionCalendarView';
import { CollectionGalleryView } from './collectionGallery/CollectionGalleryView';
import { CollectionTimelineView } from './collectionTimeline/CollectionTimelineView';

/** Groups records into board columns from the live option values of the
 *  groupBy select property — never hand-authored (BOARD-01). */
function groupRecordsByColumn(
  records: CollectionRecord[],
  schema: CollectionPropertyDef[],
  groupByPropId: string,
) {
  const groupByProp = schema.find((p) => p.id === groupByPropId);
  const options = (groupByProp?.options ?? []) as { id: string; label: string }[];

  return options.map((opt) => ({
    id: opt.id,
    title: opt.label,
    cards: records
      .filter((r) => r.props[groupByPropId] === opt.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function BoardShellLoading() {
  return (
    <div className="saas-card !p-4 flex items-center gap-2 text-sm text-gray-400">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Creating board…</span>
    </div>
  );
}

function BoardShellError() {
  return (
    <div className="saas-card !p-4">
      <p className="text-sm text-gray-700 dark:text-gray-300">Couldn&apos;t load this board.</p>
      <p className="text-xs text-gray-400">Check your connection and try again.</p>
    </div>
  );
}

function BoardEmptyFilterState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">No records match these filters</p>
      <p className="text-xs text-gray-400">Try removing a filter condition or adjusting a value to see more records.</p>
    </div>
  );
}

export function BoardBlock({
  block,
  onChange,
}: {
  block: CollectionViewBlock;
  onChange?: (block: CollectionViewBlock) => void;
}) {
  // Hooks are constructed unconditionally (Rules of Hooks) — the useEffect
  // below only sequences createCollection's .mutateAsync(...) call. The
  // board view is created via a direct recordsApi.createView(collection.id, ...)
  // call inside the effect's .then chain (not a hook) so it always receives
  // the real, just-resolved collection id at call time — never a stale
  // hook-construction-time closure over block.collectionId (which is null
  // on first insert).
  const createCollection = useCreateCollection();

  const creatingRef = useRef(false);
  useEffect(() => {
    if (block.collectionId !== null) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    const statusId = uid();
    createCollection.mutateAsync({
      name: block.title ?? 'Board',
      schema: [
        { id: uid(), name: 'Title', type: 'text' },
        {
          id: statusId, name: 'Status', type: 'select',
          options: [
            { id: uid(), label: 'To Do' },
            { id: uid(), label: 'In Progress' },
            { id: uid(), label: 'Done' },
          ],
        },
      ],
    }).then(({ collection }) =>
      recordsApi.createView(collection.id, { name: 'Board', type: 'board', config: { groupBy: statusId } })
        .then((view) => onChange?.({ ...block, collectionId: collection.id, viewId: view.id })))
      .catch((err) => console.error('Failed to provision board:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.collectionId]);

  const collectionQuery = useCollection(block.collectionId ?? '');
  const viewQuery = useView(block.viewId ?? '');
  const recordsQuery = useRecords(block.collectionId ?? '');
  const updateRecord = useUpdateAnyRecord(block.collectionId ?? '');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (block.collectionId === null || block.viewId === null) {
    return <BoardShellLoading />;
  }

  if (collectionQuery.isLoading || viewQuery.isLoading || recordsQuery.isLoading) {
    return <BoardShellLoading />;
  }
  if (collectionQuery.isError || viewQuery.isError || recordsQuery.isError
    || !collectionQuery.data || !viewQuery.data || !recordsQuery.data) {
    return <BoardShellError />;
  }

  const collection = collectionQuery.data;
  const view = viewQuery.data;
  const records = recordsQuery.data;
  const groupByPropId = String(view.config.groupBy ?? '');
  const titlePropId = collection.schema[0]?.id ?? '';
  const activeFilters = (view.config.filters as FilterCondition[]) ?? [];
  const filtered = applyFilters(records, activeFilters, collection.schema);
  const sorted = applySorts(filtered, (view.config.sorts as SortCondition[]) ?? [], collection.schema);
  const columns = groupRecordsByColumn(sorted, collection.schema, groupByPropId);
  const isFilteredEmpty = filtered.length === 0 && activeFilters.length > 0;
  const cardProperties = collection.schema.filter((p) =>
    ((view.config.cardProperties as string[]) ?? []).includes(p.id));
  const aggregation = view.config.columnAggregation as AggregationConfig | undefined;
  const calendarDateProperty = String(view.config.calendarDateProperty ?? '');
  const galleryCoverProperty = String(view.config.galleryCoverProperty ?? '');
  const timelineStartProperty = String(view.config.timelineStartProperty ?? '');
  const timelineEndProperty = String(view.config.timelineEndProperty ?? '');

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeRecord = records.find((r) => r.id === activeId);
    if (!activeRecord) return;

    // Column-level drop (over.id matches a column.id directly) — the ONLY
    // path when the target column has zero cards, since an empty
    // SortableContext registers no sortable card to hit-test against.
    const overIsColumn = columns.some((c) => c.id === overId);
    let targetColumnId: string;
    let targetIndex: number;
    if (overIsColumn) {
      targetColumnId = overId;
      targetIndex = 0;
    } else {
      const targetColumn = columns.find((c) => c.cards.some((card) => card.id === overId));
      if (!targetColumn) return;
      targetColumnId = targetColumn.id;
      targetIndex = targetColumn.cards.findIndex((card) => card.id === overId);
    }

    updateRecord.mutate({
      id: activeId,
      data: { props: { ...activeRecord.props, [groupByPropId]: targetColumnId }, sort_order: targetIndex },
    });
  }

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{block.title}</h3>}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ViewSwitcher
            collectionId={block.collectionId as string}
            currentView={view}
            onSwitch={(viewId) => onChange?.({ ...block, viewId })}
          />
          <FilterSortToolbar collection={collection} view={view} />
        </div>
        <ViewSettingsMenu collection={collection} view={view} />
      </div>
      {view.type === 'table' ? (
        <CollectionTableView collection={collection} records={sorted} updateRecord={updateRecord} />
      ) : view.type === 'list' ? (
        <CollectionListView
          collection={collection}
          records={sorted}
          collectionId={block.collectionId as string}
          titlePropId={titlePropId}
          cardProperties={cardProperties}
        />
      ) : view.type === 'calendar' ? (
        <CollectionCalendarView
          collection={collection}
          records={sorted}
          collectionId={block.collectionId as string}
          titlePropId={titlePropId}
          calendarDateProperty={calendarDateProperty}
          cardProperties={cardProperties}
        />
      ) : view.type === 'gallery' ? (
        <CollectionGalleryView
          collection={collection}
          records={sorted}
          collectionId={block.collectionId as string}
          titlePropId={titlePropId}
          cardProperties={cardProperties}
          galleryCoverProperty={galleryCoverProperty}
        />
      ) : view.type === 'timeline' ? (
        <CollectionTimelineView
          collection={collection}
          records={sorted}
          collectionId={block.collectionId as string}
          timelineStartProperty={timelineStartProperty}
          timelineEndProperty={timelineEndProperty}
          cardProperties={cardProperties}
        />
      ) : isFilteredEmpty ? (
        <BoardEmptyFilterState />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                titlePropId={titlePropId}
                collectionId={block.collectionId as string}
                collection={collection}
                groupByPropId={groupByPropId}
                cardProperties={cardProperties}
                aggregation={aggregation}
              />
            ))}
            <AddColumnControl collection={collection} groupByPropId={groupByPropId} />
          </div>
        </DndContext>
      )}
    </div>
  );
}
