'use client';

// "+ Add column" control (D-05): appends a new select option to the groupBy
// property's schema. The schema PATCH must fully resolve before the control
// clears/resets — same two-sequential-request convention as AddPropertyModal
// (schema write before any dependent record write, though this control has
// no dependent record write of its own).

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '@/lib/projectPage/blocks';
import type { DataCollection } from '@/lib/api/records.api';
import { useUpdateCollectionSchema } from '@/lib/hooks/useRecords';

export function AddColumnControl({
  collection,
  groupByPropId,
}: {
  collection: DataCollection;
  groupByPropId: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const updateSchema = useUpdateCollectionSchema(collection.id);

  const commit = async () => {
    const trimmed = label.trim();
    if (!trimmed) { setOpen(false); return; }
    setSubmitting(true);
    const nextSchema = collection.schema.map((prop) =>
      prop.id === groupByPropId
        ? { ...prop, options: [...(prop.options ?? []), { id: uid(), label: trimmed }] }
        : prop);
    try {
      await updateSchema.mutateAsync(nextSchema);
    } finally {
      setSubmitting(false);
      setLabel('');
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-56 flex-shrink-0 min-h-[32px] flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700 text-xs font-bold text-primary-600 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add column
      </button>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 min-h-[32px] rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700 p-2">
      <input
        autoFocus
        type="text"
        value={label}
        disabled={submitting}
        placeholder="Column name…"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setLabel(''); setOpen(false); }
        }}
        className="w-full bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm text-gray-800 dark:text-gray-200"
      />
    </div>
  );
}
