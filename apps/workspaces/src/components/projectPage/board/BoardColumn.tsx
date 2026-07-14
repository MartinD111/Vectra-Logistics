'use client';

// A single board column — a droppable region (useDroppable, distinct from
// each card's own useSortable registration) wrapping a SortableContext for
// within-column reordering. The column-level droppable is required because
// an empty column has an empty SortableContext `items` array, which registers
// no sortable element for @dnd-kit to hit-test against (Task 2 / BOARD-02).

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2 } from 'lucide-react';
import type { CollectionRecord, DataCollection } from '@/lib/api/records.api';
import { useCreateRecord, useUpdateCollectionSchema } from '@/lib/hooks/useRecords';
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
  collection,
  groupByPropId,
}: {
  column: BoardColumnData;
  titlePropId: string;
  collectionId: string;
  collection: DataCollection;
  groupByPropId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const updateSchema = useUpdateCollectionSchema(collection.id);
  const createRecord = useCreateRecord(collectionId);

  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingNewCardId, setEditingNewCardId] = useState<string | null>(null);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = titleDraft.trim() || 'Untitled column';
    if (trimmed === column.title) return;
    const nextSchema = collection.schema.map((prop) =>
      prop.id === groupByPropId
        ? {
          ...prop,
          options: (prop.options ?? []).map((o) => (o.id === column.id ? { ...o, label: trimmed } : o)),
        }
        : prop);
    updateSchema.mutate(nextSchema);
  };

  const commitDelete = () => {
    const nextSchema = collection.schema.map((prop) =>
      prop.id === groupByPropId
        ? { ...prop, options: (prop.options ?? []).filter((o) => o.id !== column.id) }
        : prop);
    updateSchema.mutate(nextSchema);
    setConfirmingDelete(false);
  };

  const handleAddCard = () => {
    createRecord.mutate(
      { props: { [titlePropId]: '', [groupByPropId]: column.id } },
      { onSuccess: (created) => setEditingNewCardId(created.id) },
    );
  };

  const canDelete = column.cards.length === 0;

  return (
    <div className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2 group/column">
      <div className="flex items-center justify-between px-1 mb-2 gap-1">
        {renaming ? (
          <input
            autoFocus
            type="text"
            value={titleDraft}
            placeholder="Untitled column"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { setTitleDraft(column.title); setRenaming(false); }
            }}
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm"
          />
        ) : (
          <span
            onClick={() => { setTitleDraft(column.title); setRenaming(true); }}
            className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-text truncate"
          >
            {column.title}
          </span>
        )}
        <span className="text-[10px] text-gray-400 flex-shrink-0">{column.cards.length}</span>
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => canDelete && setConfirmingDelete(true)}
          title={canDelete ? 'Delete column' : 'Move all cards out of this column before deleting it.'}
          className={`flex-shrink-0 opacity-0 group-hover/column:opacity-100 transition-opacity ${canDelete ? 'text-gray-400 hover:text-red-500' : 'opacity-40 cursor-not-allowed text-gray-400'}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {confirmingDelete && (
        <div className="mb-2 px-1.5 py-1.5 rounded-md bg-red-50 dark:bg-red-900/20 text-[11px] text-red-700 dark:text-red-300">
          <p className="mb-1.5">Delete column? This removes it from the board. Cards must be moved out first.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="font-semibold hover:opacity-70">Cancel</button>
            <button type="button" onClick={commitDelete} className="font-semibold text-red-600 hover:opacity-70">Delete</button>
          </div>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={`space-y-1.5 min-h-[8px] rounded-md ${isOver ? 'ring-2 ring-primary-500' : ''}`}
      >
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <BoardCard
              key={card.id}
              record={card}
              titlePropId={titlePropId}
              collectionId={collectionId}
              autoFocusEdit={editingNewCardId === card.id}
              onExitEdit={() => setEditingNewCardId((cur) => (cur === card.id ? null : cur))}
            />
          ))}
        </SortableContext>
      </div>

      <button
        type="button"
        onClick={handleAddCard}
        className="w-full min-h-[32px] mt-1.5 flex items-center gap-1.5 px-1.5 text-xs font-bold text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> New
      </button>
    </div>
  );
}
