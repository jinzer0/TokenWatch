import type { TuiData } from '../services/aggregator.js';
import type { TuiDataCacheAdapter } from './cache.js';
import type { TuiSettings } from '../services/configService.js';

export type ViewKey =
  | 'overview'
  | 'usage'
  | 'stats'
  | 'reports'
  | 'source'
  | 'sourceName'
  | 'model'
  | 'agent'
  | 'agents'
  | 'monthly'
  | 'minutely'
  | 'daily'
  | 'hourly'
  | 'sessionIntervals'
  | 'sessions'
  | 'concurrency'
  | 'sessionMetrics'
  | 'runs'
  | 'pricing'
  | 'budgets'
  | 'help';

export type ViewDefinition = {
  key: ViewKey;
  label: string;
};

export type TuiRow = Record<string, string | number | null>;

export type TuiProps = {
  loadData: () => TuiData;
  onExportView: (viewKey: string, rows: TuiRow[]) => string;
  initialViewKey?: ViewKey;
  initialDetails?: boolean;
  settings?: TuiSettings;
  cache?: TuiDataCacheAdapter;
};

export const views: ViewDefinition[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'usage', label: 'Usage' },
  { key: 'stats', label: 'Stats' },
  { key: 'reports', label: 'Reports' },
  { key: 'source', label: 'By Source' },
  { key: 'sourceName', label: 'By Source Name' },
  { key: 'model', label: 'By Model' },
  { key: 'agent', label: 'By Agent' },
  { key: 'agents', label: 'Agents' },
  { key: 'monthly', label: 'Monthly Usage' },
  { key: 'minutely', label: 'Minutely Usage' },
  { key: 'daily', label: 'Daily Usage' },
  { key: 'hourly', label: 'Hourly Usage' },
  { key: 'sessionIntervals', label: 'Session Intervals' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'concurrency', label: 'Concurrency' },
  { key: 'sessionMetrics', label: 'Session Metrics' },
  { key: 'runs', label: 'Recent Scan Runs' },
  { key: 'pricing', label: 'Unknown Pricing' },
  { key: 'budgets', label: 'Budget Warnings' },
  { key: 'help', label: 'Help' }
];
