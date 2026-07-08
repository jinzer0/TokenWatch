import type { ReactElement } from 'react';

import type { BreakdownRow, BreakdownSortKey, BreakdownSortState } from '../types.js';
import { breakdownColumns } from '../utils/breakdowns.js';
import { formatCount, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type BreakdownTableProps = {
  readonly onSelect: (row: BreakdownRow) => void;
  readonly onSort: (column: BreakdownSortKey) => void;
  readonly rows: readonly BreakdownRow[];
  readonly selectedRowKey: string | null;
  readonly sort: BreakdownSortState;
  readonly title: string;
};

export const BreakdownTable = ({
  onSelect,
  onSort,
  rows,
  selectedRowKey,
  sort,
  title
}: BreakdownTableProps): ReactElement => (
  <section className="breakdown-section" aria-label={`${title} breakdown section`}>
    <div className="breakdown-section-heading">
      <h3>{title}</h3>
      <span>{formatCount(rows.length)} groups</span>
    </div>
    <div className="breakdown-table-wrap">
      <table className="breakdown-table" aria-label={`${title} breakdown table`}>
        <thead>
          <tr>
            {breakdownColumns.map((column) => (
              <th
                key={column.key}
                aria-sort={
                  sort.column === column.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                scope="col"
              >
                <button
                  className="breakdown-sort-button"
                  type="button"
                  aria-label={`Sort ${title} by ${column.label}`}
                  onClick={() => onSort(column.key)}
                >
                  <span>{column.label}</span>
                  {sort.column === column.key ? (
                    <span>{sort.direction === 'asc' ? 'up' : 'down'}</span>
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={breakdownColumns.length}>No aggregate rows available</td>
            </tr>
          ) : null}
          {rows.map((row, index) => {
            const label = formatSafeLabel(row.key);
            const selected = selectedRowKey === row.key;
            return (
              <tr className={selected ? 'selected' : undefined} key={`${label}-${index}`}>
                <th scope="row">
                  <button
                    className="breakdown-row-button"
                    type="button"
                    aria-label={`Show details for ${label} in ${title}`}
                    onClick={() => onSelect(row)}
                  >
                    {label}
                  </button>
                </th>
                <td>{formatCount(row.events)}</td>
                <td>{formatCount(row.inputTokens)}</td>
                <td>{formatCount(row.outputTokens)}</td>
                <td>{formatCount(row.cachedTokens)}</td>
                <td>{formatCount(row.reasoningTokens)}</td>
                <td>{formatCount(row.totalTokens)}</td>
                <td>{formatUsd(row.estimatedCostUsd)}</td>
                <td>{formatSafeLabel(row.topModel)}</td>
                <td>{formatSafeLabel(row.topAgent)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);
