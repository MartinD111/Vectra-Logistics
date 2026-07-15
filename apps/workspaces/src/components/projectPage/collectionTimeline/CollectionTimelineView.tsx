'use client';

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

export function CollectionTimelineView() {
  return null;
}
