'use client';

// Flat single-column list view for the collection-view block (VIEW-02, D-09).
// Structurally distinct from CollectionTableView's grid markup -- one row
// per record, title left, card-face properties as inline chips right.
// Reuses formatCardPropertyValue (exported from BoardCard.tsx, Plan 26-01)
// instead of re-deriving person/select/multi-select label resolution.

import { formatCardPropertyValue } from '../board/BoardCard';
import { useTeam } from '@/lib/hooks/useTeam';
import type { CollectionPropertyDef, CollectionRecord, DataCollection } from '@/lib/api/records.api';

// Same container/empty-state shell as CollectionTableView.tsx.
const CONTAINER_CLASS =
  'border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden';

function CollectionListEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">No records match these filters</p>
      <p className="text-xs text-gray-400">Try removing a filter condition or adjusting a value to see more records.</p>
    </div>
  );
}

export function CollectionListView({
  collection,
  records,
  collectionId,
  titlePropId,
  cardProperties,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  titlePropId: string;
  cardProperties: CollectionPropertyDef[];
}) {
  const { data: team = [] } = useTeam();
  const personNames = new Map(team.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]));

  if (records.length === 0) {
    return (
      <div className={CONTAINER_CLASS}>
        <CollectionListEmptyState />
      </div>
    );
  }

  return (
    <div className={CONTAINER_CLASS}>
      {records.map((record, index) => {
        const title = String(record.props[titlePropId] ?? '');
        return (
          <div
            key={record.id}
            onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
            className={`flex items-center justify-between gap-3 px-2.5 py-2 cursor-pointer ${index === 0 ? '' : 'border-t border-gray-100 dark:border-slate-800'}`}
          >
            <span className={title ? 'text-sm font-semibold text-gray-800 dark:text-gray-200' : 'text-sm font-semibold text-gray-400 italic'}>
              {title || 'Untitled'}
            </span>
            {(cardProperties ?? []).length > 0 && (
              <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                {cardProperties.map((property) => (
                  <div key={property.id} className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                    {formatCardPropertyValue(record.props[property.id], property, personNames)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
