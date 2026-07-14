import type { CollectionPropertyDef, CollectionRecord } from '@/lib/api/records.api';

export interface FilterCondition {
  propId: string;
  operator: string;
  value: unknown;
}

export interface SortCondition {
  propId: string;
  direction: 'asc' | 'desc';
}

export interface AggregationConfig {
  type: 'count' | 'sum' | 'avg';
  propId?: string;
}

/** Valid filter operators per property type, keyed on CollectionPropertyDef['type']. */
export const FILTER_OPERATORS: Record<CollectionPropertyDef['type'], { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'Is' },
    { value: 'contains', label: 'Contains' },
  ],
  url: [
    { value: 'equals', label: 'Is' },
    { value: 'contains', label: 'Contains' },
  ],
  email: [
    { value: 'equals', label: 'Is' },
    { value: 'contains', label: 'Contains' },
  ],
  phone: [
    { value: 'equals', label: 'Is' },
    { value: 'contains', label: 'Contains' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'between', label: 'Between' },
  ],
  date: [
    { value: 'equals', label: 'On' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
  ],
  select: [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is not' },
  ],
  person: [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is not' },
  ],
  'multi-select': [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
  ],
  files: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
  ],
  relation: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
  ],
  checkbox: [
    { value: 'is', label: 'Is' },
  ],
};

const ARRAY_TYPES = new Set<CollectionPropertyDef['type']>(['multi-select', 'files', 'relation']);

/** Evaluates a single filter condition against a record; fails open (returns true) on malformed input. */
export function evaluateCondition(
  record: CollectionRecord,
  condition: FilterCondition,
  schema: CollectionPropertyDef[],
): boolean {
  const property = schema.find((p) => p.id === condition.propId);
  if (!property) return true;

  const recordValue = record.props[condition.propId];

  switch (condition.operator) {
    case 'equals': {
      if (property.type === 'number') {
        // An unset/not-yet-typed value ('' or null) is "not configured yet" —
        // fail open rather than coercing Number('') to 0 and actively
        // matching every zero-valued record (WR-05).
        if (condition.value === '' || condition.value == null) return true;
        return Number(recordValue) === Number(condition.value);
      }
      return String(recordValue ?? '') === String(condition.value ?? '');
    }
    case 'contains':
    case 'not_contains': {
      let matches: boolean;
      if (ARRAY_TYPES.has(property.type)) {
        // condition.value for array-typed properties is itself an array (the
        // full selection from MultiSelectChips/StringArrayChips), not a single
        // scalar — test intersection against recordValue rather than a
        // reference-equality includes() (CR-01).
        const targets = Array.isArray(condition.value) ? condition.value : [condition.value];
        matches = Array.isArray(recordValue) && targets.some((t) => recordValue.includes(t));
      } else {
        matches = String(recordValue ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
      }
      return condition.operator === 'contains' ? matches : !matches;
    }
    case 'gt':
      if (condition.value === '' || condition.value == null) return true;
      return Number(recordValue) > Number(condition.value);
    case 'lt':
      if (condition.value === '' || condition.value == null) return true;
      return Number(recordValue) < Number(condition.value);
    case 'between': {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) return true;
      const [min, max] = condition.value;
      if (property.type === 'date') {
        const v = new Date(recordValue as string).getTime();
        return v >= new Date(min).getTime() && v <= new Date(max).getTime();
      }
      const v = Number(recordValue);
      return v >= Number(min) && v <= Number(max);
    }
    case 'before':
      return new Date(recordValue as string) < new Date(condition.value as string);
    case 'after':
      return new Date(recordValue as string) > new Date(condition.value as string);
    case 'is':
      return recordValue === condition.value;
    case 'is_not':
      return recordValue !== condition.value;
    default:
      return true;
  }
}

/** Combines filter conditions with AND-only logic (D-02). No-op fast path when filters is empty. */
export function applyFilters(
  records: CollectionRecord[],
  filters: FilterCondition[],
  schema: CollectionPropertyDef[],
): CollectionRecord[] {
  if (!filters.length) return records;
  return records.filter((r) => filters.every((f) => evaluateCondition(r, f, schema)));
}

function compareValues(
  a: CollectionRecord,
  b: CollectionRecord,
  sort: SortCondition,
  schema: CollectionPropertyDef[],
): number {
  const property = schema.find((p) => p.id === sort.propId);
  const av = a.props[sort.propId];
  const bv = b.props[sort.propId];

  let result: number;
  if (property?.type === 'number') {
    result = Number(av) - Number(bv);
  } else if (property?.type === 'date') {
    result = new Date(av as string).getTime() - new Date(bv as string).getTime();
  } else {
    result = String(av ?? '').localeCompare(String(bv ?? ''));
  }

  return sort.direction === 'desc' ? result * -1 : result;
}

/** Applies sort conditions in array order (first = primary, rest = tiebreakers). No-op fast path when sorts is empty. */
export function applySorts(
  records: CollectionRecord[],
  sorts: SortCondition[],
  schema: CollectionPropertyDef[],
): CollectionRecord[] {
  if (!sorts.length) return records;
  return [...records].sort((a, b) => {
    for (const sort of sorts) {
      const result = compareValues(a, b, sort, schema);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/** Aggregates a column across records; sum/avg default to 0 (never NaN) when no numeric values exist. */
export function aggregateColumn(records: CollectionRecord[], agg: AggregationConfig): number {
  if (agg.type === 'count') return records.length;

  const values = records
    .map((r) => r.props[agg.propId ?? ''])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return 0;

  const sum = values.reduce((a, b) => a + b, 0);
  return agg.type === 'sum' ? sum : sum / values.length;
}
