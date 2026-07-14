'use client';

// Board block (collection-view) — a real drag-and-drop board grouped by a
// select property, backed by a data_collection/collection_views row (Phase 24).
// Replaces the config-local `kanban` block. On first insert (block.collectionId
// === null) this auto-provisions a default collection + board view (D-04):
// a Title text property, a Status select property (To Do / In Progress / Done),
// and a board view grouped by Status — no "pick a collection" picker.

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { uid, type CollectionViewBlock } from '@/lib/projectPage/blocks';
import type { CollectionPropertyDef, CollectionRecord } from '@/lib/api/records.api';
import {
  useCollection, useView, useRecords, useCreateCollection, useCreateView,
} from '@/lib/hooks/useRecords';

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

export function BoardBlock({
  block,
  onChange,
}: {
  block: CollectionViewBlock;
  onChange?: (block: CollectionViewBlock) => void;
}) {
  // Hooks are constructed unconditionally (Rules of Hooks) — the useEffect
  // below only sequences their .mutateAsync(...) calls, never calls the
  // hooks themselves conditionally. useCreateView's collectionId fallback
  // ('') is only used for its own construction-time cache-invalidation key
  // while block.collectionId is still null — nothing subscribes to that key.
  const createCollection = useCreateCollection();
  const createView = useCreateView(block.collectionId ?? '');

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
      createView.mutateAsync({ name: 'Board', type: 'board', config: { groupBy: statusId } })
        .then((view) => onChange?.({ ...block, collectionId: collection.id, viewId: view.id })))
      .catch((err) => console.error('Failed to provision board:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.collectionId]);

  const collectionQuery = useCollection(block.collectionId ?? '');
  const viewQuery = useView(block.viewId ?? '');
  const recordsQuery = useRecords(block.collectionId ?? '');

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
  const titlePropId = collection.schema[0]?.id;
  const columns = groupRecordsByColumn(records, collection.schema, groupByPropId);

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {columns.map((col) => (
          <div key={col.id} className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{col.title}</span>
              <span className="text-[10px] text-gray-400">{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((record) => (
                <div
                  key={record.id}
                  onClick={() => window.open(`/collections/${block.collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
                  className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 text-sm shadow-sm cursor-pointer"
                >
                  {titlePropId ? String(record.props[titlePropId] ?? 'Untitled') || 'Untitled' : 'Untitled'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
