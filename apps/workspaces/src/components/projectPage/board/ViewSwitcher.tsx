'use client';

// View type dropdown (VIEWX-04, D-10). Switches which saved collection_views
// row (and its type) the collection-view block points at -- creates a
// sibling view row once, then remembers it on later switches.
// No record-mutation hook is imported here by design: switching view type
// only ever creates a collection_views row, it never re-materializes
// collection_records (no record-create call of any kind in this file).

import { useState } from 'react';
import { LayoutGrid, Table2, List, Calendar, Image, GanttChartSquare, ChevronDown } from 'lucide-react';
import { useViews, useCreateView } from '@/lib/hooks/useRecords';
import type { CollectionView } from '@/lib/api/records.api';

type ViewTypeValue = 'board' | 'table' | 'list' | 'calendar' | 'gallery' | 'timeline';

const VIEW_TYPES: { type: ViewTypeValue; label: string; icon: typeof LayoutGrid }[] = [
  { type: 'board', label: 'Board', icon: LayoutGrid },
  { type: 'table', label: 'Table', icon: Table2 },
  { type: 'list', label: 'List', icon: List },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'gallery', label: 'Gallery', icon: Image },
  { type: 'timeline', label: 'Timeline', icon: GanttChartSquare },
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
  const [pendingType, setPendingType] = useState<ViewTypeValue | null>(null);
  const [editing, setEditing] = useState(false);

  const switchTo = (type: ViewTypeValue) => {
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
        name: VIEW_TYPES.find((v) => v.type === type)?.label ?? type,
        type,
        config: {},
      })
      .then((created) => onSwitch(created.id))
      .catch((err) => console.error('Failed to create sibling view:', err))
      .finally(() => setPendingType(null));
  };

  const current = VIEW_TYPES.find((v) => v.type === currentView.type);
  const CurrentIcon = current?.icon ?? LayoutGrid;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setEditing((o) => !o)}
        disabled={createView.isPending}
        className="flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CurrentIcon className="w-3.5 h-3.5" />
        {current?.label ?? currentView.type}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {editing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">
            {VIEW_TYPES.map(({ type, label, icon: Icon }) => {
              const isSelected = currentView.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    switchTo(type);
                    setEditing(false);
                  }}
                  className={`w-full flex items-center gap-1.5 min-h-[32px] px-2 py-1.5 rounded-md text-left text-xs font-semibold ${
                    isSelected
                      ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
