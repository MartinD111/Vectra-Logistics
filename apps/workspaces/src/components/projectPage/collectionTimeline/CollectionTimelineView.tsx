'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CollectionPropertyDef, CollectionRecord, DataCollection } from '@/lib/api/records.api';

// Timeline/Gantt render path for the collection-view block (VIEW-05, D-06,
// D-07, D-08). Bars are drawn from two independently-chosen `date`-type
// schema properties (start/end) -- no new `date-range` property type exists
// (D-06). Fixed month-wide horizontal scale with prev/next navigation,
// mirroring Calendar's D-03 nav pattern (D-08). A record only renders a bar
// when BOTH its start and end date values are set (D-07) -- otherwise it is
// entirely absent from this view (no placeholder row, no point-marker), but
// remains visible in every other view (board/table/list/calendar).
//
// No existing Gantt-chart precedent in this codebase -- computeBarPosition
// is composed fresh as a small pure function, styled after
// viewFilters.ts's compareValues/aggregateColumn convention: no side
// effects, plain arithmetic, called once per qualifying record before
// render.

// Given a month's day-count and a record's already-validated (D-07) start/end
// date values, returns the number of days in the month `monthStart` falls in.
function getDaysInMonth(monthStart: Date): number {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
}

// Computes proportional left/width percentages for a Gantt bar within the
// visible month, clamping bars that start before or end after the visible
// month to the grid's edges rather than overflowing. Malformed/unparseable
// date strings produce NaN percentages (JS Date parsing failure yields
// Invalid Date, and arithmetic on it yields NaN) which CSS silently ignores
// as an invalid style value rather than crashing the render (T-26-07) -- the
// same tolerance already exists in viewFilters.ts's compareValues for date
// comparisons, so no additional validation is added here.
function computeBarPosition(
  startIso: string,
  endIso: string,
  monthStart: Date,
  daysInMonth: number,
): { leftPct: number; widthPct: number } {
  const dayMs = 24 * 60 * 60 * 1000;
  const clampedStart = Math.max(0, (new Date(startIso).getTime() - monthStart.getTime()) / dayMs);
  const clampedEnd = Math.min(
    daysInMonth,
    (new Date(endIso).getTime() - monthStart.getTime()) / dayMs + 1,
  );
  const leftPct = (clampedStart / daysInMonth) * 100;
  const widthPct = ((clampedEnd - clampedStart) / daysInMonth) * 100;
  return { leftPct, widthPct };
}

const CONTAINER_CLASS =
  'border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden';

function CollectionTimelineEmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">{heading}</p>
      <p className="text-xs text-gray-400">{body}</p>
    </div>
  );
}

export function CollectionTimelineView({
  collection,
  records,
  collectionId,
  timelineStartProperty,
  timelineEndProperty,
  cardProperties,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  timelineStartProperty: string;
  timelineEndProperty: string;
  cardProperties: CollectionPropertyDef[];
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  if (!timelineStartProperty || !timelineEndProperty) {
    return (
      <div className={CONTAINER_CLASS}>
        <CollectionTimelineEmptyState
          heading="Choose start and end date properties to plot this timeline"
          body="Try removing a filter condition or adjusting a value to see more records."
        />
      </div>
    );
  }

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const daysInMonth = getDaysInMonth(monthStart);

  const qualifying = records.filter(
    (r) => r.props[timelineStartProperty] && r.props[timelineEndProperty],
  );

  const goToPrevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <div className={CONTAINER_CLASS}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-gray-100 dark:border-slate-800">
        <button
          type="button"
          aria-label="Previous month"
          onClick={goToPrevMonth}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={goToNextMonth}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {qualifying.length === 0 ? (
        <CollectionTimelineEmptyState
          heading="No records match these filters"
          body="Try removing a filter condition or adjusting a value to see more records."
        />
      ) : (
        <div className="p-3">
          <div className="flex mb-1">
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div
                key={i}
                className="flex-1 border-l border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 text-center"
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {qualifying.map((record) => {
              const { leftPct, widthPct } = computeBarPosition(
                String(record.props[timelineStartProperty]),
                String(record.props[timelineEndProperty]),
                monthStart,
                daysInMonth,
              );
              const title = String(record.props[collection.schema[0]?.id ?? ''] ?? 'Untitled');
              return (
                <div key={record.id} className="relative min-h-[36px]">
                  <div
                    className="absolute bg-primary-600 rounded-md h-6 cursor-pointer"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() =>
                      window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
                  >
                    {widthPct >= 15 && (
                      <span className="text-xs text-white truncate px-1 block leading-6">{title}</span>
                    )}
                  </div>
                  {widthPct < 15 && (
                    <span
                      className="absolute text-xs text-gray-700 dark:text-gray-300 truncate leading-6"
                      style={{ marginLeft: `${leftPct + widthPct}%` }}
                    >
                      {title}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
