import type { Dashboard, DashboardDatabaseStatus } from '../types.js';

export const formatCount = (value: number | undefined): string =>
  (value ?? 0).toLocaleString('en-US');

export const formatUsd = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? 'unknown'
    : value.toLocaleString('en-US', {
        currency: 'USD',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: 'currency'
      });

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(value));

export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  }).format(new Date(value));

export const formatDateRange = (range: Dashboard['dateRange']): string => {
  if (!range.start || !range.end) return 'unknown';
  return `${formatDate(range.start)} - ${formatDate(range.end)}`;
};

export const formatDurationMs = (value: number): string => {
  if (value <= 0) return '0s';
  const seconds = Math.floor(value / 1000);
  const parts = [
    ['d', Math.floor(seconds / 86400)],
    ['h', Math.floor((seconds % 86400) / 3600)],
    ['m', Math.floor((seconds % 3600) / 60)],
    ['s', seconds % 60]
  ] as const;
  return parts
    .filter(([, amount]) => amount > 0)
    .slice(0, 2)
    .map(([unit, amount]) => `${amount}${unit}`)
    .join(' ');
};

export const formatUnknownPricing = (count: number): string => {
  if (count === 0) return 'Fully priced';
  return `${formatCount(count)} unknown pricing ${count === 1 ? 'event' : 'events'}`;
};

export const formatDatabaseStatus = (status: DashboardDatabaseStatus): string => {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'database-unavailable':
      return 'Database unavailable';
    case 'setup-needed':
      return 'Setup needed';
  }
};
