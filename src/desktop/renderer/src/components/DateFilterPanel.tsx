import type { FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { Dashboard, DashboardFilterInput } from '../types.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value: string): string | undefined => (value.trim() ? value : undefined);

const validateRange = (from: string, to: string): string | null => {
  if (from && !DATE_ONLY_PATTERN.test(from)) return 'From date must use YYYY-MM-DD.';
  if (to && !DATE_ONLY_PATTERN.test(to)) return 'To date must use YYYY-MM-DD.';
  if (from && to && from > to) return 'From date must be on or before to date.';
  return null;
};

export const DateFilterPanel = ({
  disabled,
  filters,
  onApply
}: {
  readonly disabled: boolean;
  readonly filters: Dashboard['filters'];
  readonly onApply: (filters: DashboardFilterInput) => void;
}): ReactElement => {
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setFrom(filters.from ?? '');
    setTo(filters.to ?? '');
  }, [filters.from, filters.to]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const message = validateRange(from, to);
    setValidation(message);
    if (message) return;
    onApply({ from: normalizeDate(from), to: normalizeDate(to) });
  };

  return (
    <article className="analytics-card date-filter-card" aria-label="UTC date filters">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">UTC filters</p>
          <h2>Date-only event window</h2>
        </div>
        <span>
          {filters.from || filters.to
            ? `${filters.from ?? 'start'} to ${filters.to ?? 'end'}`
            : 'all dates'}
        </span>
      </div>
      <form className="date-filter-form" onSubmit={submit}>
        <div className="date-filter-fields">
          <label>
            <span>From date UTC</span>
            <input
              aria-label="From date UTC"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>To date UTC</span>
            <input
              aria-label="To date UTC"
              type="date"
              value={to}
              onChange={(event) => setTo(event.currentTarget.value)}
            />
          </label>
        </div>
        {validation ? (
          <p className="date-filter-validation" aria-label="UTC filter validation">
            {validation}
          </p>
        ) : null}
        <div className="date-filter-actions">
          <button className="refresh-button" disabled={disabled} type="submit">
            Apply UTC date filter
          </button>
          <button
            className="date-filter-clear"
            disabled={disabled}
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setValidation(null);
              onApply({});
            }}
          >
            Clear filter
          </button>
        </div>
      </form>
    </article>
  );
};
