'use client';

// Calendar render path for the collection-view block (VIEW-03, D-01/D-02/D-03).
// Plots records by a user-chosen `date`-type property on a month grid, with
// an "Unscheduled" tray for records that have no value set for that property
// so nothing silently disappears (D-02). Not wired into BoardBlock.tsx yet
// (Plan 26-05 wires the view.type branch).

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCardPropertyValue } from '../board/BoardCard';
import { useTeam } from '@/lib/hooks/useTeam';
import { useCreateRecord, useUpdateAnyRecord } from '@/lib/hooks/useRecords';
import type { DataCollection, CollectionRecord, CollectionPropertyDef } from '@/lib/api/records.api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local-date day-key helper -- deliberately avoids the UTC-based ISO string
// conversion, which can shift the displayed day near midnight in non-UTC
// timezones. `date`-type property values are plain YYYY-MM-DD strings
// (PropertyField.tsx convention).
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Weekday-aligned (Sunday-first) grid of day cells covering the full visible
// month, including leading/trailing days from adjacent months so every week
// row is complete.
function getMonthGridDays(monthAnchor: Date): Date[] {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  const end = new Date(year, month, lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function CalendarEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">Choose a date property to plot this calendar</p>
      <p className="text-xs text-gray-400">Pick a date property for this view in the view settings menu.</p>
    </div>
  );
}

// Chip body -- title + first cardProperties[] entry, truncated. Click-through
// opens the record detail page (same pattern as BoardCard) when not editing.
// When `autoFocusEdit` is true (set by the day-cell click-to-create handler),
// renders an inline-editable title input instead, replicating BoardCard.tsx's
// editing/draft/debounceTimer/lastCommittedRef/flush/handleChange/commitAndExit
// state machine verbatim (D-03 mirrors Phase 24's D-07 inline "+ New" pattern).
function CalendarChip({
  record,
  titlePropId,
  collectionId,
  cardProperties,
  personNames,
  autoFocusEdit = false,
  onExitEdit,
  updateRecord,
}: {
  record: CollectionRecord;
  titlePropId: string;
  collectionId: string;
  cardProperties: CollectionPropertyDef[];
  personNames: Map<string, string>;
  autoFocusEdit?: boolean;
  onExitEdit?: () => void;
  updateRecord: ReturnType<typeof useUpdateAnyRecord>;
}) {
  const title = String(record.props[titlePropId] ?? '');
  const firstProperty = cardProperties[0];

  const [editing, setEditing] = useState(autoFocusEdit);
  const [draft, setDraft] = useState(title);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(title);

  useEffect(() => {
    setEditing(autoFocusEdit);
    setDraft(title);
    lastCommittedRef.current = title;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusEdit, record.id]);

  const flush = (next: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (next !== lastCommittedRef.current) {
      lastCommittedRef.current = next;
      updateRecord.mutate({ id: record.id, data: { props: { ...record.props, [titlePropId]: next } } });
    }
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flush(next), 800);
  };

  const commitAndExit = () => {
    flush(draft);
    setEditing(false);
    onExitEdit?.();
  };

  if (editing) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-1.5 py-1 text-xs shadow-sm"
      >
        <input
          autoFocus
          type="text"
          value={draft}
          placeholder="Untitled"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={commitAndExit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitAndExit(); }
            // Escape exits edit mode WITHOUT deleting the already-persisted
            // record -- leaves it "Untitled" until edited again (D-07).
            if (e.key === 'Escape') { setDraft(lastCommittedRef.current); setEditing(false); onExitEdit?.(); }
          }}
          className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm text-xs text-gray-800 dark:text-gray-200"
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer');
      }}
      className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-1.5 py-1 text-xs shadow-sm cursor-pointer truncate"
    >
      <span className={title ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 italic'}>
        {title || 'Untitled'}
      </span>
      {firstProperty && (
        <div className="text-gray-500 dark:text-gray-400 truncate">
          {formatCardPropertyValue(record.props[firstProperty.id], firstProperty, personNames)}
        </div>
      )}
    </div>
  );
}

export function CollectionCalendarView({
  collection,
  records,
  collectionId,
  titlePropId,
  calendarDateProperty,
  cardProperties,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  titlePropId: string;
  calendarDateProperty: string;
  cardProperties: CollectionPropertyDef[];
}) {
  const { data: team = [] } = useTeam();
  const personNames = new Map(team.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]));

  const createRecord = useCreateRecord(collectionId);
  const updateRecord = useUpdateAnyRecord(collectionId);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const monthDays = useMemo(() => getMonthGridDays(currentMonth), [currentMonth]);

  const { scheduled, unscheduled } = useMemo(() => {
    const byDay = new Map<string, CollectionRecord[]>();
    const withoutDate: CollectionRecord[] = [];

    if (calendarDateProperty) {
      for (const record of records) {
        const value = record.props[calendarDateProperty];
        if (typeof value === 'string' && value) {
          const bucket = byDay.get(value) ?? [];
          bucket.push(record);
          byDay.set(value, bucket);
        } else {
          withoutDate.push(record);
        }
      }
    }

    return { scheduled: byDay, unscheduled: withoutDate };
  }, [records, calendarDateProperty]);

  if (!calendarDateProperty) {
    return (
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <CalendarEmptyState />
      </div>
    );
  }

  const today = formatDateKey(new Date());
  const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const dayKey = formatDateKey(day);
            const dayRecords = scheduled.get(dayKey) ?? [];
            const isToday = dayKey === today;
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

            return (
              <div
                key={dayKey}
                onClick={() => {
                  createRecord
                    .mutateAsync({ props: { [titlePropId]: '', [calendarDateProperty]: dayKey } })
                    .then((created) => setAutoFocusId(created.id))
                    .catch((err) => console.error('Failed to create calendar record:', err));
                }}
                className={`min-h-[96px] border border-gray-200 dark:border-slate-700 p-1 space-y-1 cursor-pointer ${isCurrentMonth ? '' : 'bg-gray-50 dark:bg-slate-800/40'}`}
              >
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                    {day.getDate()}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{day.getDate()}</span>
                )}
                {dayRecords.map((record) => (
                  <CalendarChip
                    key={record.id}
                    record={record}
                    titlePropId={titlePropId}
                    collectionId={collectionId}
                    cardProperties={cardProperties}
                    personNames={personNames}
                    updateRecord={updateRecord}
                    autoFocusEdit={record.id === autoFocusId}
                    onExitEdit={() => setAutoFocusId(null)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-slate-800/60 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Unscheduled</h3>
        {unscheduled.length === 0 ? (
          <p className="text-xs text-gray-400 italic">All records have a date</p>
        ) : (
          <div className="space-y-1.5">
            {unscheduled.map((record) => (
              <CalendarChip
                key={record.id}
                record={record}
                titlePropId={titlePropId}
                collectionId={collectionId}
                cardProperties={cardProperties}
                personNames={personNames}
                updateRecord={updateRecord}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
