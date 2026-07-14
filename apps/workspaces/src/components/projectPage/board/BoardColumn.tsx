'use client';

// A single board column — a droppable region (useDroppable, distinct from
// each card's own useSortable registration) wrapping a SortableContext for
// within-column reordering. The column-level droppable is required because
// an empty column has an empty SortableContext `items` array, which registers
// no sortable element for @dnd-kit to hit-test against (Task 2 / BOARD-02).

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CollectionRecord } from '@/lib/api/records.api';
import { BoardCard } from './BoardCard';

export interface BoardColumnData {
  id: string;
  title: string;
  cards: CollectionRecord[];
}

export function BoardColumn({
  column,
  titlePropId,
  collectionId,
}: {
  column: BoardColumnData;
  titlePropId: string;
  collectionId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{column.title}</span>
        <span className="text-[10px] text-gray-400">{column.cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-1.5 min-h-[8px] rounded-md ${isOver ? 'ring-2 ring-primary-500' : ''}`}
      >
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <BoardCard key={card.id} record={card} titlePropId={titlePropId} collectionId={collectionId} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
