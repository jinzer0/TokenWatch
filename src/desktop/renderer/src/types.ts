import type {
  DesktopAppStatus,
  DesktopDashboardFilterInput,
  DesktopDashboardSnapshot
} from '../../shared/contracts.js';
import type { RendererSafeError } from './errors.js';

export type DashboardLoadState = {
  readonly error: RendererSafeError | null;
  readonly filters: DesktopDashboardFilterInput;
  readonly lastRefreshedAt: string | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly snapshot: DesktopDashboardSnapshot | null;
  readonly status: DesktopAppStatus | null;
  readonly version: string | null;
};

export type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;
export type DashboardFilterInput = DesktopDashboardFilterInput;

export type LineChartPoint = {
  readonly detail: string;
  readonly key: string;
  readonly unknown?: boolean;
  readonly value: number | null;
};

export type DistributionChartItem = {
  readonly detail: string;
  readonly key: string;
  readonly value: number;
};

export type BreakdownRow = Dashboard['byModel'][number];
export type BreakdownSectionId = 'agent' | 'model' | 'source' | 'sourceName';
export type BreakdownSortKey =
  | 'cachedTokens'
  | 'estimatedCostUsd'
  | 'events'
  | 'inputTokens'
  | 'label'
  | 'outputTokens'
  | 'reasoningTokens'
  | 'topAgent'
  | 'topModel'
  | 'totalTokens';
export type BreakdownSortDirection = 'asc' | 'desc';

export type BreakdownSortState = {
  readonly column: BreakdownSortKey;
  readonly direction: BreakdownSortDirection;
};

export type BreakdownSection = {
  readonly id: BreakdownSectionId;
  readonly rows: readonly BreakdownRow[];
  readonly title: string;
};

export type SelectedBreakdown = {
  readonly rowKey: string;
  readonly sectionId: BreakdownSectionId;
} | null;

export type DonutSegment = DistributionChartItem & {
  readonly dasharray: string;
  readonly dashoffset: string;
  readonly segmentClassName: string;
};

export type SummaryCardData = {
  readonly detail: string;
  readonly label: string;
  readonly tone?: 'normal' | 'warning';
  readonly value: string;
};

export type DashboardDatabaseStatus = DesktopAppStatus['database']['status'];
