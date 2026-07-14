'use client';

// Table render path for the collection-view block (VIEWX-04, D-05). Renders
// the same collection_records shown by BoardBlock's board columns as a
// schema-driven, directly-editable table -- never re-materializes data, only
// a second lens over the same records/schema. Deliberately NOT named
// TableView/TableBlock (see TableBlock.tsx, a distinct unrelated block kind)
// and lives in its own collectionTable/ subfolder to avoid the naming
// collision called out in 25-RESEARCH.md's Pitfall 2.

import type { UseMutationResult } from '@tanstack/react-query';
import { PropertyField } from '@/components/records/PropertyField';
import type {
  DataCollection, CollectionRecord, UpdateRecordInput,
} from '@/lib/api/records.api';

// Tailwind conventions follow TableBlock.tsx's CONTAINER_CLASS/HEADER_ROW_CLASS/
// CELL_CLASS DOM structure, with the header typography adjusted to this
// phase's declared Label tier (12px semibold uppercase) per 25-UI-SPEC.md --
// not TableBlock's pre-existing text-[11px] font-bold.
const CONTAINER_CLASS =
  'border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden';
const HEADER_ROW_CLASS =
  'bg-gray-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wider text-gray-400';
const CELL_CLASS =
  'text-sm px-2.5 py-1.5 border-t border-gray-100 dark:border-slate-800 align-top';

function CollectionTableEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">No records match these filters</p>
      <p className="text-xs text-gray-400">Try removing a filter condition or adjusting a value to see more records.</p>
    </div>
  );
}

export function CollectionTableView({
  collection,
  records,
  updateRecord,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  updateRecord: UseMutationResult<CollectionRecord, unknown, { id: string; data: UpdateRecordInput }>;
}) {
  if (records.length === 0) {
    return (
      <div className={CONTAINER_CLASS}>
        <CollectionTableEmptyState />
      </div>
    );
  }

  return (
    <div className={CONTAINER_CLASS}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={HEADER_ROW_CLASS}>
            {collection.schema.map((property) => (
              <th key={property.id} className="text-left px-2.5 py-1.5">{property.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {collection.schema.map((property) => (
                <td key={property.id} className={CELL_CLASS}>
                  <PropertyField
                    property={property}
                    value={record.props[property.id]}
                    onCommit={(v) =>
                      updateRecord.mutate({
                        id: record.id,
                        data: { props: { ...record.props, [property.id]: v } },
                      })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
