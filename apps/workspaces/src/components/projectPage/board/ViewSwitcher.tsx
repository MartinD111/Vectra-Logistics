'use client';

// Board/Table segmented control (VIEWX-04, D-05). Switches which saved
// collection_views row (and its type) the collection-view block points at --
// creates a sibling view row once, then remembers it on later toggles.
// No record-mutation hook is imported here by design: switching view type
// only ever creates a collection_views row, it never re-materializes
// collection_records (no record-create call of any kind in this file).

import { useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { useViews, useCreateView } from '@/lib/hooks/useRecords';
import type { CollectionView } from '@/lib/api/records.api';

const VIEW_TYPES: { type: 'board' | 'table'; label: string; icon: typeof LayoutGrid }[] = [
  { type: 'board', label: 'Board', icon: LayoutGrid },
  { type: 'table', label: 'Table', icon: Table2 },
];

export function ViewSwitcher({
  collectionId,
  currentView,
  onSwitch,
}: {
  collectionId: string;
  currentView: CollectionView;
  onSwitch: (viewId: string) => void;
}) {
  const viewsQuery = useViews(collectionId);
  const createView = useCreateView(collectionId);
  // WR-03: viewsQuery.data can still be undefined/stale immediately after
  // mount or immediately after a first switch (useCreateView's onSuccess only
  // invalidates the query, an async refetch — it doesn't synchronously write
  // the new view into the cache). Track the in-flight target type locally so
  // a second click for the same type before the mutation resolves is a no-op
  // instead of firing a second createView.mutateAsync (which would create a
  // duplicate collection_views row).
  const [pendingType, setPendingType] = useState<'board' | 'table' | null>(null);

  const switchTo = (type: 'board' | 'table') => {
    if (type === currentView.type) return;
    if (createView.isPending || pendingType === type) return;

    const existing = viewsQuery.data?.find((v) => v.type === type);
    if (existing) {
      onSwitch(existing.id);
      return;
    }

    setPendingType(type);
    createView
      .mutateAsync({
        name: type === 'board' ? 'Board' : 'Table',
        type,
        config: {},
      })
      .then((created) => onSwitch(created.id))
      .catch((err) => console.error('Failed to create sibling view:', err))
      .finally(() => setPendingType(null));
  };

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      {VIEW_TYPES.map(({ type, label, icon: Icon }) => {
        const isSelected = currentView.type === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => switchTo(type)}
            disabled={createView.isPending}
            className={`flex items-center gap-1.5 min-h-[32px] px-2.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
