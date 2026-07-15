'use client';

// Card-grid gallery view for the collection-view block (VIEW-04, D-04, D-05).
// Cards are never draggable (no useSortable/@dnd-kit) -- read-only,
// card-face-preview-driven, same as List. Reuses formatCardPropertyValue
// (exported from BoardCard.tsx, Plan 26-01) and mirrors BoardCard's card
// surface/body layout near-verbatim.

import { formatCardPropertyValue } from '../board/BoardCard';
import { useTeam } from '@/lib/hooks/useTeam';
import type { CollectionPropertyDef, CollectionRecord, DataCollection } from '@/lib/api/records.api';

function CollectionGalleryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">No records match these filters</p>
      <p className="text-xs text-gray-400">Try removing a filter condition or adjusting a value to see more records.</p>
    </div>
  );
}

export function CollectionGalleryView({
  collection,
  records,
  collectionId,
  titlePropId,
  cardProperties,
  galleryCoverProperty,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  titlePropId: string;
  cardProperties: CollectionPropertyDef[];
  galleryCoverProperty: string;
}) {
  const { data: team = [] } = useTeam();
  const personNames = new Map(team.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]));

  if (records.length === 0) {
    return <CollectionGalleryEmptyState />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {records.map((record) => {
        const title = String(record.props[titlePropId] ?? '');
        const coverValue = galleryCoverProperty ? record.props[galleryCoverProperty] : undefined;
        const coverUrl =
          galleryCoverProperty && Array.isArray(coverValue) && typeof coverValue[0] === 'string' && coverValue[0]
            ? (coverValue[0] as string)
            : null;

        return (
          <div
            key={record.id}
            onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
            className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden cursor-pointer"
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gray-100 dark:bg-slate-800" />
            )}
            <div className="p-2.5">
              <span className={title ? 'text-base font-semibold text-gray-800 dark:text-gray-200' : 'text-base font-semibold text-gray-400 italic'}>
                {title || 'Untitled'}
              </span>
              {(cardProperties ?? []).length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {cardProperties.map((property) => (
                    <div key={property.id} className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {formatCardPropertyValue(record.props[property.id], property, personNames)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
