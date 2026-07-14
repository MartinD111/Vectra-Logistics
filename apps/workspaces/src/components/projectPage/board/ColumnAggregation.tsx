'use client';

// Column footer (D-04): count is always available; sum/avg apply to a
// user-chosen number property (view.config.columnAggregation, set via
// ViewSettingsMenu). Pure display -- delegates the actual math to
// aggregateColumn (Plan 25-01) so this component stays a thin renderer.

import type { CollectionPropertyDef, CollectionRecord } from '@/lib/api/records.api';
import { aggregateColumn, type AggregationConfig } from '@/lib/projectPage/viewFilters';

export function ColumnAggregation({
  records, schema, aggregation,
}: {
  records: CollectionRecord[];
  schema: CollectionPropertyDef[];
  aggregation: AggregationConfig | undefined;
}) {
  const agg = aggregation ?? { type: 'count' as const };

  if (agg.type !== 'count' && !agg.propId) return <></>;

  const value = aggregateColumn(records, agg);
  const property = schema.find((p) => p.id === agg.propId);
  const formatted = property ? value.toLocaleString() : String(value);

  const label = agg.type === 'count' ? 'Count' : agg.type === 'sum' ? 'Sum' : 'Avg';

  return (
    <div className="mt-1.5 px-1.5 text-[10px] text-gray-400">
      {label}: {agg.type === 'count' ? value : formatted}
    </div>
  );
}
