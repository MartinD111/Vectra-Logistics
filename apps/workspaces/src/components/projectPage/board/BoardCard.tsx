'use client';

// A single board card — whole-card drag surface via @dnd-kit/sortable's
// useSortable (not useDraggable: within-column reordering needs the sortable
// primitive, not just cross-container drop). Also supports inline-editable
// title on creation (Task 3, D-07) via the autoFocusEdit prop.

import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CollectionRecord } from '@/lib/api/records.api';
import { useUpdateAnyRecord } from '@/lib/hooks/useRecords';

export function BoardCard({
  record,
  titlePropId,
  collectionId,
  autoFocusEdit = false,
  onExitEdit,
}: {
  record: CollectionRecord;
  titlePropId: string;
  collectionId: string;
  autoFocusEdit?: boolean;
  onExitEdit?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: record.id });
  const updateRecord = useUpdateAnyRecord(collectionId);

  const title = String(record.props[titlePropId] ?? '');
  const [editing, setEditing] = useState(autoFocusEdit);
  const [draft, setDraft] = useState(title);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(title);

  useEffect(() => {
    setEditing(autoFocusEdit);
    setDraft(title);
    lastCommittedRef.current = title;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusEdit, record.id]);

  const flush = (next: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (next !== lastCommittedRef.current) {
      lastCommittedRef.current = next;
      updateRecord.mutate({ id: record.id, data: { props: { ...record.props, [titlePropId]: next } } });
    }
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flush(next), 800);
  };

  const commitAndExit = () => {
    flush(draft);
    setEditing(false);
    onExitEdit?.();
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 text-sm shadow-sm"
      >
        <input
          autoFocus
          type="text"
          value={draft}
          placeholder="Untitled"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={commitAndExit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitAndExit(); }
            // Escape exits edit mode WITHOUT deleting the record (already
            // persisted) — leaves it "Untitled" until edited again (D-07).
            if (e.key === 'Escape') { setDraft(lastCommittedRef.current); setEditing(false); onExitEdit?.(); }
          }}
          className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm text-sm text-gray-800 dark:text-gray-200"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 text-sm shadow-sm cursor-grab active:cursor-grabbing touch-none"
    >
      <span className={title ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 italic'}>
        {title || 'Untitled'}
      </span>
    </div>
  );
}
