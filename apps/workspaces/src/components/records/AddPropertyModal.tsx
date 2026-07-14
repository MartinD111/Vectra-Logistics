'use client';

// Add-property flow (CARD-03, T-23-04): a schema PATCH must fully resolve
// before the record's own prop write is attempted, or a record can end up
// referencing a property id the collection's schema never actually persisted
// (RESEARCH.md Pitfall 1 / PATTERNS.md). Modal shell cloned from
// UnlinkConfirmDialog (records/[clientId]/page.tsx lines 357-389).

import { useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { uid } from '@/lib/projectPage/blocks';
import type { CollectionPropertyDef, DataCollection, CollectionRecord } from '@/lib/api/records.api';

type UpdateRecordMutation = UseMutationResult<
  CollectionRecord, unknown, { props?: Record<string, unknown>; body?: Record<string, unknown> }
>;
type UpdateSchemaMutation = UseMutationResult<DataCollection, unknown, CollectionPropertyDef[]>;

const PROPERTY_TYPES: CollectionPropertyDef['type'][] = [
  'text', 'number', 'date', 'select', 'multi-select', 'checkbox',
  'person', 'url', 'email', 'phone', 'files', 'relation',
];

// Type-correct default matching records.service.ts's validatePropValue.
function initialValueFor(type: CollectionPropertyDef['type']): unknown {
  switch (type) {
    case 'number':
      return 0;
    case 'checkbox':
      return false;
    case 'multi-select':
    case 'files':
    case 'relation':
      return [];
    case 'text':
    case 'url':
    case 'email':
    case 'phone':
    case 'select':
    case 'person':
    case 'date':
    default:
      return '';
  }
}

export function AddPropertyModal({
  collection, record, onUpdateSchema, onUpdateRecord, onClose,
}: {
  collection: DataCollection;
  record: CollectionRecord;
  onUpdateSchema: UpdateSchemaMutation;
  onUpdateRecord: UpdateRecordMutation;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CollectionPropertyDef['type']>('text');
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [optionDraft, setOptionDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const needsOptions = type === 'select' || type === 'multi-select';
  const canSubmit = name.trim().length > 0 && (!needsOptions || options.length > 0) && !submitting;

  const addOption = () => {
    const trimmed = optionDraft.trim();
    if (!trimmed) return;
    setOptions((prev) => [...prev, { id: uid(), label: trimmed }]);
    setOptionDraft('');
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(false);
    const newProperty: CollectionPropertyDef = {
      id: uid(),
      name: name.trim(),
      type,
      ...(needsOptions ? { options } : {}),
    };
    try {
      const nextSchema = [...collection.schema, newProperty];
      await onUpdateSchema.mutateAsync(nextSchema);
      await onUpdateRecord.mutateAsync({
        props: { ...record.props, [newProperty.id]: initialValueFor(type) },
      });
      onClose();
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Add property</h2>

        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Name</p>
          <input
            autoFocus
            className="saas-input !py-2 text-sm w-full"
            placeholder="Property name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Type</p>
          <select
            className="saas-input !py-2 text-sm w-full"
            value={type}
            onChange={(e) => setType(e.target.value as CollectionPropertyDef['type'])}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {needsOptions && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Options</p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {options.map((o) => (
                <span
                  key={o.id}
                  className="rounded-full text-xs font-semibold px-3 py-1 bg-primary-600 text-white flex items-center gap-1"
                >
                  {o.label}
                  <button type="button" onClick={() => removeOption(o.id)} className="hover:opacity-70" aria-label={`Remove ${o.label}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="saas-input !py-2 text-sm w-full"
                placeholder="Add option…"
                value={optionDraft}
                onChange={(e) => setOptionDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
              />
              <button
                type="button"
                onClick={addOption}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 min-h-[48px] px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex-shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <p className="text-[11px] text-red-500 mb-2">Couldn&apos;t save — try again</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add property
          </button>
        </div>
      </div>
    </div>
  );
}
