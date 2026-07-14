'use client';

// View settings (D-03, D-04): a "..." icon-only popover mounted at the end of
// the board toolbar row, cloned from PersonField's popover shell (right-aligned
// via right-0 instead of left-0/right-0, since this trigger sits at the end of
// the row). Two sections: a card-face property checklist (D-03) and a
// count/sum/avg aggregation picker (D-04) -- both autosave-on-change via
// useUpdateView, no separate "Save" button, matching FilterSortToolbar's
// established instant-persist convention (Plan 25-02).

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { DataCollection, CollectionView } from '@/lib/api/records.api';
import { useUpdateView } from '@/lib/hooks/useRecords';
import type { AggregationConfig } from '@/lib/projectPage/viewFilters';

export function ViewSettingsMenu({
  collection, view,
}: {
  collection: DataCollection;
  view: CollectionView;
}) {
  const [editing, setEditing] = useState(false);
  const updateView = useUpdateView(view.id);

  const cardProperties = (view.config.cardProperties as string[]) ?? [];
  const aggregation = view.config.columnAggregation as AggregationConfig | undefined;
  const aggType = aggregation?.type ?? 'count';
  const numberProperties = collection.schema.filter((p) => p.type === 'number');

  const toggleCardProperty = (propId: string) => {
    const next = cardProperties.includes(propId)
      ? cardProperties.filter((id) => id !== propId)
      : [...cardProperties, propId];
    updateView.mutate({ config: { ...view.config, cardProperties: next } });
  };

  const setAggregationType = (nextType: AggregationConfig['type']) => {
    updateView.mutate({
      config: { ...view.config, columnAggregation: { type: nextType, propId: aggregation?.propId } },
    });
  };

  const setAggregationProp = (nextPropId: string) => {
    updateView.mutate({
      config: { ...view.config, columnAggregation: { type: aggType, propId: nextPropId } },
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="View settings"
        onClick={() => setEditing((o) => !o)}
        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {editing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 w-72 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Card properties</p>
              <div className="space-y-1">
                {collection.schema.map((property) => (
                  <label key={property.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardProperties.includes(property.id)}
                      onChange={() => toggleCardProperty(property.id)}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Column aggregation</p>
              <select
                className="saas-input !py-1.5 text-xs w-full mb-1.5"
                value={aggType}
                onChange={(e) => setAggregationType(e.target.value as AggregationConfig['type'])}
              >
                <option value="count">Count</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
              </select>
              {(aggType === 'sum' || aggType === 'avg') && (
                <select
                  className="saas-input !py-1.5 text-xs w-full"
                  value={aggregation?.propId ?? ''}
                  onChange={(e) => setAggregationProp(e.target.value)}
                >
                  <option value="">Select a number property…</option>
                  {numberProperties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
