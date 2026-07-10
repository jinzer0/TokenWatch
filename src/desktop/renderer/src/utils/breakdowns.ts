import type {
  BreakdownRow,
  BreakdownSectionId,
  BreakdownSortDirection,
  BreakdownSortKey,
  BreakdownSortState
} from '../types.js';
import { formatSafeLabel } from './privacyLabels.js';

export const DEFAULT_BREAKDOWN_SORTS: Record<BreakdownSectionId, BreakdownSortState> = {
  agent: { column: 'totalTokens', direction: 'desc' },
  model: { column: 'totalTokens', direction: 'desc' },
  source: { column: 'totalTokens', direction: 'desc' },
  sourceName: { column: 'totalTokens', direction: 'desc' }
};

const stringBreakdownColumns = new Set<BreakdownSortKey>(['label', 'topAgent', 'topModel']);

export const breakdownColumns: readonly {
  readonly key: BreakdownSortKey;
  readonly label: string;
}[] = [
  { key: 'label', label: 'Group' },
  { key: 'events', label: 'Events' },
  { key: 'inputTokens', label: 'Input' },
  { key: 'outputTokens', label: 'Output' },
  { key: 'cachedTokens', label: 'Cached' },
  { key: 'reasoningTokens', label: 'Reasoning' },
  { key: 'totalTokens', label: 'Total' },
  { key: 'estimatedCostUsd', label: 'Cost' },
  { key: 'topModel', label: 'Top model' },
  { key: 'topAgent', label: 'Top agent' }
];

export const getBreakdownSortDirection = (
  currentSort: BreakdownSortState,
  column: BreakdownSortKey
): BreakdownSortDirection => {
  if (currentSort.column === column) return currentSort.direction === 'asc' ? 'desc' : 'asc';
  return stringBreakdownColumns.has(column) ? 'asc' : 'desc';
};

const getBreakdownSortValue = (
  row: BreakdownRow,
  column: BreakdownSortKey
): number | string | null => {
  switch (column) {
    case 'label':
      return formatSafeLabel(row.key);
    case 'topAgent':
      return formatSafeLabel(row.topAgent);
    case 'topModel':
      return formatSafeLabel(row.topModel);
    default:
      return row[column];
  }
};

const compareBreakdownValues = (
  left: number | string | null,
  right: number | string | null,
  direction: BreakdownSortDirection
): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const base =
    typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, 'en-US', { sensitivity: 'base' })
      : Number(left) - Number(right);
  return direction === 'asc' ? base : -base;
};

export const sortBreakdownRows = (
  rows: readonly BreakdownRow[],
  sort: BreakdownSortState
): BreakdownRow[] =>
  rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const sorted = compareBreakdownValues(
        getBreakdownSortValue(left.row, sort.column),
        getBreakdownSortValue(right.row, sort.column),
        sort.direction
      );
      if (sorted !== 0) return sorted;

      const labelSorted = formatSafeLabel(left.row.key).localeCompare(
        formatSafeLabel(right.row.key),
        'en-US',
        { sensitivity: 'base' }
      );
      if (labelSorted !== 0) return labelSorted;
      if (left.row.totalTokens !== right.row.totalTokens) {
        return right.row.totalTokens - left.row.totalTokens;
      }
      if (left.row.events !== right.row.events) return right.row.events - left.row.events;
      return left.index - right.index;
    })
    .map(({ row }) => row);
