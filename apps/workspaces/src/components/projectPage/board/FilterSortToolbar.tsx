'use client';

// Filter/Sort toolbar (D-01, D-02): two popover-driven condition-row builders
// above the board, cloned from PersonField's popover shell (PropertyField.tsx
// lines 111-146) and AddColumnControl's local-draft/.mutate()-on-commit
// pattern. AND-only (no OR toggle), autosave-on-change via useUpdateView —
// no separate "Apply"/"Save" button.

import { useState } from 'react';
import { Filter, ArrowUpDown } from 'lucide-react';
import { PropertyField } from '@/components/records/PropertyField';
import type { DataCollection, CollectionView, CollectionPropertyDef } from '@/lib/api/records.api';
import { useUpdateView } from '@/lib/hooks/useRecords';
import { FILTER_OPERATORS, type FilterCondition, type SortCondition } from '@/lib/projectPage/viewFilters';

function firstPropType(collection: DataCollection): CollectionPropertyDef['type'] {
  return collection.schema[0]?.type ?? 'text';
}

export function FilterSortToolbar({
  collection, view,
}: {
  collection: DataCollection;
  view: CollectionView;
}) {
  const updateView = useUpdateView(view.id);
  const filters = ((view.config.filters as FilterCondition[]) ?? []);
  const sorts = ((view.config.sorts as SortCondition[]) ?? []);

  const saveFilters = (next: FilterCondition[]) => {
    updateView.mutate({ config: { ...view.config, filters: next } });
  };
  const saveSorts = (next: SortCondition[]) => {
    updateView.mutate({ config: { ...view.config, sorts: next } });
  };

  return (
    <div className="flex items-center gap-2">
      <FilterPopover collection={collection} filters={filters} onChange={saveFilters} />
      <SortPopover collection={collection} sorts={sorts} onChange={saveSorts} />
    </div>
  );
}

function FilterPopover({
  collection, filters, onChange,
}: {
  collection: DataCollection;
  filters: FilterCondition[];
  onChange: (next: FilterCondition[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const active = filters.length > 0;

  const addCondition = () => {
    const prop = collection.schema[0];
    const type = firstPropType(collection);
    const operator = FILTER_OPERATORS[type][0]?.value ?? 'equals';
    onChange([...filters, { propId: prop?.id ?? '', operator, value: '' }]);
  };

  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    onChange(filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeCondition = (idx: number) => {
    onChange(filters.filter((_, i) => i !== idx));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setEditing((o) => !o)}
        className={`min-h-[32px] flex items-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${
          active ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'
        } hover:bg-gray-50 dark:hover:bg-slate-800/60`}
      >
        <Filter className="w-3.5 h-3.5" />
        Filter records
      </button>
      {editing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-96 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 space-y-2">
            {filters.map((condition, idx) => {
              const property = collection.schema.find((p) => p.id === condition.propId) ?? collection.schema[0];
              const operators = property ? FILTER_OPERATORS[property.type] : [];
              return (
                <div key={idx} className="flex items-start gap-1.5">
                  <select
                    className="saas-input !py-1.5 text-xs flex-shrink-0 w-28"
                    value={condition.propId}
                    onChange={(e) => {
                      const nextProp = collection.schema.find((p) => p.id === e.target.value);
                      const nextOperator = nextProp ? FILTER_OPERATORS[nextProp.type][0]?.value ?? 'equals' : condition.operator;
                      updateCondition(idx, { propId: e.target.value, operator: nextOperator, value: '' });
                    }}
                  >
                    {collection.schema.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    className="saas-input !py-1.5 text-xs flex-shrink-0 w-24"
                    value={condition.operator}
                    onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <div className="flex-1 min-w-0">
                    {property && (
                      <PropertyField
                        property={property}
                        value={condition.value}
                        onCommit={(v) => updateCondition(idx, { value: v })}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCondition(idx)}
                    className="text-gray-400 hover:text-red-600 px-1"
                    aria-label="Remove condition"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addCondition}
              disabled={collection.schema.length === 0}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-primary-600 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              + Add condition
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SortPopover({
  collection, sorts, onChange,
}: {
  collection: DataCollection;
  sorts: SortCondition[];
  onChange: (next: SortCondition[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const active = sorts.length > 0;

  const addSort = () => {
    onChange([...sorts, { propId: collection.schema[0]?.id ?? '', direction: 'asc' }]);
  };

  const updateSort = (idx: number, patch: Partial<SortCondition>) => {
    onChange(sorts.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSort = (idx: number) => {
    onChange(sorts.filter((_, i) => i !== idx));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setEditing((o) => !o)}
        className={`min-h-[32px] flex items-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${
          active ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'
        } hover:bg-gray-50 dark:hover:bg-slate-800/60`}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        Sort records
      </button>
      {editing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-80 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 space-y-2">
            {sorts.map((sort, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <select
                  className="saas-input !py-1.5 text-xs flex-1"
                  value={sort.propId}
                  onChange={(e) => updateSort(idx, { propId: e.target.value })}
                >
                  {collection.schema.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  className="saas-input !py-1.5 text-xs flex-shrink-0 w-28"
                  value={sort.direction}
                  onChange={(e) => updateSort(idx, { direction: e.target.value as 'asc' | 'desc' })}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSort(idx)}
                  className="text-gray-400 hover:text-red-600 px-1"
                  aria-label="Remove sort"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSort}
              disabled={collection.schema.length === 0}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-primary-600 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              + Add sort
            </button>
          </div>
        </>
      )}
    </div>
  );
}
