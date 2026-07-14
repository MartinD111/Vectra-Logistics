'use client';

// Record detail sidebar (D-01): inline-editable title (the collection's first
// schema property, per D-01's "first property is title" convention) plus a
// schema-driven property list rendered via PropertyField, and a
// "+ Add property" trigger opening AddPropertyModal. Structural clone of
// ClientSidebar's shell (records/[clientId]/page.tsx).

import { useEffect, useRef, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { PropertyField } from './PropertyField';
import { AddPropertyModal } from './AddPropertyModal';
import type { CollectionPropertyDef, DataCollection, CollectionRecord } from '@/lib/api/records.api';

type UpdateRecordMutation = UseMutationResult<
  CollectionRecord, unknown, { props?: Record<string, unknown>; body?: Record<string, unknown> }
>;
type UpdateSchemaMutation = UseMutationResult<DataCollection, unknown, CollectionPropertyDef[]>;

export function PropertyPanel({
  collection, record, onUpdateRecord, onUpdateSchema,
}: {
  collection: DataCollection;
  record: CollectionRecord;
  onUpdateRecord: UpdateRecordMutation;
  onUpdateSchema: UpdateSchemaMutation;
}) {
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const titleProperty = collection.schema[0];
  const otherProperties = collection.schema.slice(1);

  return (
    <div className="w-80 flex-shrink-0 saas-card !p-4 dark:bg-slate-800">
      {titleProperty ? (
        <EditableTitle
          title={typeof record.props[titleProperty.id] === 'string' ? (record.props[titleProperty.id] as string) : ''}
          onCommit={(next) => onUpdateRecord.mutate({ props: { ...record.props, [titleProperty.id]: next } })}
        />
      ) : (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No properties yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add a property to start tracking data on this record.</p>
        </div>
      )}

      {otherProperties.map((property) => (
        <div key={property.id} className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{property.name}</p>
          <PropertyField
            property={property}
            value={record.props[property.id]}
            onCommit={(v) => onUpdateRecord.mutate({ props: { ...record.props, [property.id]: v } })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setAddPropertyOpen(true)}
        className="text-sm font-semibold text-primary-600 hover:text-primary-700 min-h-[48px] px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        + Add property
      </button>

      {addPropertyOpen && (
        <AddPropertyModal
          collection={collection}
          record={record}
          onUpdateSchema={onUpdateSchema}
          onUpdateRecord={onUpdateRecord}
          onClose={() => setAddPropertyOpen(false)}
        />
      )}
    </div>
  );
}

// ── Inline-editable title, D-01: cloned from PageHeader's EditableTitle ─────
// (uncontrolled contentEditable, syncs only while unfocused, commits on blur,
// non-empty only — empty reverts to previous title), with UI-SPEC's explicit
// typography divergence: font-bold (not font-semibold).

function EditableTitle({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== title) el.textContent = title;
  }, [title]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <h1
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Untitled"
      className={`text-xl font-bold mb-4 truncate focus:outline-none rounded-lg -mx-1 px-1 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 ${
        title ? 'text-gray-900 dark:text-white' : 'text-gray-400 italic'
      }`}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
      onBlur={() => {
        const next = (ref.current?.textContent ?? '').trim();
        if (next && next !== title) onCommit(next);
        else if (!next && ref.current) ref.current.textContent = title || 'Untitled';
      }}
    >
      {title || 'Untitled'}
    </h1>
  );
}
