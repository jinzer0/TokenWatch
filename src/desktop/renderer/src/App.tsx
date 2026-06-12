import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DesktopAppStatus, DesktopDashboardSnapshot } from '../../shared/contracts.js';
import { formatRendererError } from './errors.js';

import './App.css';

type DashboardLoadState = {
  error: ReturnType<typeof formatRendererError> | null;
  lastRefreshedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  snapshot: DesktopDashboardSnapshot | null;
  status: DesktopAppStatus | null;
  version: string | null;
};

type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;
type LineChartPoint = {
  detail: string;
  key: string;
  unknown?: boolean;
  value: number | null;
};
type DistributionChartItem = {
  detail: string;
  key: string;
  value: number;
};
type BreakdownRow = Dashboard['byModel'][number];
type BreakdownSectionId = 'agent' | 'model' | 'source' | 'sourceName';
type BreakdownSortKey =
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
type BreakdownSortDirection = 'asc' | 'desc';
type BreakdownSortState = {
  column: BreakdownSortKey;
  direction: BreakdownSortDirection;
};
type BreakdownSection = {
  id: BreakdownSectionId;
  rows: BreakdownRow[];
  title: string;
};
type SelectedBreakdown = {
  rowKey: string;
  sectionId: BreakdownSectionId;
} | null;
type DonutSegment = DistributionChartItem & {
  dasharray: string;
  dashoffset: string;
  segmentClassName: string;
};
type SummaryCardData = {
  detail: string;
  label: string;
  tone?: 'normal' | 'warning';
  value: string;
};

const INITIAL_STATE: DashboardLoadState = {
  error: null,
  lastRefreshedAt: null,
  loading: true,
  refreshing: false,
  snapshot: null,
  status: null,
  version: null
};

const navigationItems = ['Overview', 'Sources', 'Runs'] as const;
const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const CHART_PADDING = 24;
const BAR_ROW_HEIGHT = 34;
const BAR_TRACK_WIDTH = 272;
const BAR_TRACK_X = 24;
const BAR_TOP_OFFSET = 132;
const BAR_HEIGHT = 12;
const DONUT_CENTER_X = CHART_WIDTH / 2;
const DONUT_CENTER_Y = 62;
const DONUT_RADIUS = 32;
const DONUT_STROKE_WIDTH = 14;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const WITHHELD_LABEL = 'withheld label';
const UNSAFE_LABEL_PATTERN =
  /(sentinel|api[_-]?key|oauth|credential|secret|password|bearer\s+|raw[_-]?(record|json|content)|metadata\s+json|prompt|response|select\s+\*)/i;
const PATH_LIKE_LABEL_PATTERN =
  /(^~([/\\]|$)|^[A-Za-z]:[/\\]|^[/\\]|[/\\](users|home|private|var|tmp|etc)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$))/i;
const DEFAULT_BREAKDOWN_SORTS: Record<BreakdownSectionId, BreakdownSortState> = {
  agent: { column: 'totalTokens', direction: 'desc' },
  model: { column: 'totalTokens', direction: 'desc' },
  source: { column: 'totalTokens', direction: 'desc' },
  sourceName: { column: 'totalTokens', direction: 'desc' }
};
const stringBreakdownColumns = new Set<BreakdownSortKey>(['label', 'topAgent', 'topModel']);
const breakdownColumns: { key: BreakdownSortKey; label: string }[] = [
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

const formatCount = (value: number | undefined): string => (value ?? 0).toLocaleString('en-US');

const formatUsd = (value: number | null | undefined): string =>
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

const formatDateTime = (value: string): string =>
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

const formatDateRange = (range: Dashboard['dateRange']): string => {
  if (!range.start || !range.end) return 'unknown';
  return `${formatDate(range.start)} - ${formatDate(range.end)}`;
};

const isUnsafeLabel = (value: string): boolean =>
  UNSAFE_LABEL_PATTERN.test(value) || PATH_LIKE_LABEL_PATTERN.test(value);

const formatSafeLabel = (value: string | null): string => {
  if (value === null) return 'unknown';
  const trimmed = value.trim();
  if (!trimmed || isUnsafeLabel(trimmed)) return WITHHELD_LABEL;
  return trimmed;
};

const formatUnknownPricing = (count: number): string => {
  if (count === 0) return 'Fully priced';
  return `${formatCount(count)} unknown pricing ${count === 1 ? 'event' : 'events'}`;
};

const formatDatabaseStatus = (status: DesktopAppStatus['database']['status']): string => {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'database-unavailable':
      return 'Database unavailable';
    case 'setup-needed':
      return 'Setup needed';
  }
};

const getSnapshotGeneratedAt = (snapshot: DesktopDashboardSnapshot): string | null =>
  snapshot.dashboard?.generatedAt ?? null;

const toPointX = (index: number, total: number): number => {
  if (total <= 1) return CHART_WIDTH / 2;
  const plotWidth = CHART_WIDTH - CHART_PADDING * 2;
  return CHART_PADDING + (plotWidth * index) / (total - 1);
};

const toPointY = (value: number, maxValue: number): number => {
  const baseline = CHART_HEIGHT - CHART_PADDING;
  if (maxValue <= 0) return baseline;
  const plotHeight = CHART_HEIGHT - CHART_PADDING * 2;
  return baseline - (value / maxValue) * plotHeight;
};

const formatCoordinate = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const toDonutSegments = (items: DistributionChartItem[]): DonutSegment[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  let offset = 0;
  return items.map((item, index) => {
    const length = (item.value / total) * DONUT_CIRCUMFERENCE;
    const segment: DonutSegment = {
      ...item,
      dasharray: `${formatCoordinate(length)} ${formatCoordinate(DONUT_CIRCUMFERENCE - length)}`,
      dashoffset: formatCoordinate(-offset),
      segmentClassName: `donut-segment segment-${(index % 4) + 1}`
    };
    offset += length;
    return segment;
  });
};

const getBreakdownSortDirection = (
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

const sortBreakdownRows = (rows: BreakdownRow[], sort: BreakdownSortState): BreakdownRow[] =>
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

const useTokenWatchDashboard = (): DashboardLoadState & { refresh: () => Promise<void> } => {
  const [state, setState] = useState<DashboardLoadState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const [snapshot, status, version] = await Promise.all([
          window.tokenwatch.dashboard.getSnapshot(),
          window.tokenwatch.app.getStatus(),
          window.tokenwatch.app.getVersion()
        ]);

        if (!active) return;
        setState({
          error: null,
          lastRefreshedAt: getSnapshotGeneratedAt(snapshot),
          loading: false,
          refreshing: false,
          snapshot,
          status,
          version
        });
      } catch {
        if (!active) return;
        setState((current) => ({
          ...current,
          error: formatRendererError('dashboard_unavailable'),
          loading: false,
          refreshing: false
        }));
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, error: null, refreshing: true }));

    try {
      const [snapshot, status] = await Promise.all([
        window.tokenwatch.dashboard.refresh(),
        window.tokenwatch.app.getStatus()
      ]);
      setState((current) => ({
        ...current,
        error: null,
        lastRefreshedAt: getSnapshotGeneratedAt(snapshot),
        refreshing: false,
        snapshot,
        status
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: formatRendererError('refresh_failed'),
        refreshing: false
      }));
    }
  }, []);

  return { ...state, refresh };
};

export const App = (): ReactElement => {
  const { error, lastRefreshedAt, loading, refresh, refreshing, snapshot, status, version } =
    useTokenWatchDashboard();
  const databaseStatus = status?.database.status ?? snapshot?.status ?? 'setup-needed';
  const dashboard = snapshot?.dashboard ?? null;
  const hasDashboardData = Boolean(dashboard && dashboard.totals.events > 0);
  const shellState = useMemo(() => {
    if (loading) return 'Loading';
    if (error) return 'Protected error';
    if (hasDashboardData) return 'Ready';
    if (databaseStatus === 'database-unavailable') return 'Database unavailable';
    return 'Setup needed';
  }, [databaseStatus, error, hasDashboardData, loading]);

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section className="dashboard-frame" aria-labelledby="desktop-shell-title">
        <header className="app-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <p className="eyebrow">TokenWatch Desktop</p>
              <h1 id="desktop-shell-title">Local token analytics</h1>
            </div>
          </div>
          <div className="header-actions">
            <p className="version-label" aria-label="Application version">
              {version ? `v${version}` : 'Version loading'}
            </p>
            <button
              className="refresh-button"
              type="button"
              aria-label="Refresh dashboard snapshot"
              disabled={loading || refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        <nav className="dashboard-nav" aria-label="Dashboard sections">
          {navigationItems.map((item, index) => (
            <span className={index === 0 ? 'nav-item active' : 'nav-item'} key={item}>
              {item}
            </span>
          ))}
        </nav>

        <section className="status-banner" aria-label="Dashboard status">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <p className="status-label">{shellState}</p>
            <p className="status-copy">
              {loading
                ? 'Loading the sanitized desktop snapshot through the preload boundary.'
                : 'Renderer sandbox active. Only normalized metadata summaries are shown.'}
            </p>
            <dl className="status-meta" aria-label="Database and refresh status">
              <div>
                <dt>Database</dt>
                <dd>{formatDatabaseStatus(databaseStatus)}</dd>
              </div>
              <div>
                <dt>Last refreshed</dt>
                <dd>{lastRefreshedAt ? formatDateTime(lastRefreshedAt) : 'Not refreshed yet'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="overview-panel" aria-labelledby="overview-title">
          <div className="overview-copy">
            <p className="eyebrow">Overview</p>
            <h2 id="overview-title">A private command center for usage signals.</h2>
            <p>
              TokenWatch Desktop frames aggregate token usage without exposing prompts, responses,
              auth material, raw paths, or database internals.
            </p>
          </div>
          <div className="signal-panel" aria-label="Analytics summary metrics">
            <Metric label="Total events" value={formatCount(dashboard?.totals.events)} />
            <Metric label="Total tokens" value={formatCount(dashboard?.totals.tokens)} />
            <Metric label="Sources" value={formatCount(dashboard?.totals.sources)} />
          </div>
        </section>

        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState error={error} /> : null}
        {!loading && !error && !hasDashboardData ? (
          <SetupState databaseStatus={databaseStatus} />
        ) : null}
        {!loading && !error && dashboard && hasDashboardData ? (
          <PopulatedState dashboard={dashboard} />
        ) : null}
      </section>
    </main>
  );
};

const Metric = ({ label, value }: { label: string; value: string }): ReactElement => (
  <article className="metric-card">
    <p>{label}</p>
    <strong>{value}</strong>
  </article>
);

const LoadingState = (): ReactElement => (
  <section className="state-card" aria-label="Loading dashboard snapshot" aria-live="polite">
    <div className="loading-orbit" aria-hidden="true" />
    <div>
      <h2>Loading sanitized snapshot</h2>
      <p>Connecting to the preload API and preparing the dashboard shell.</p>
    </div>
  </section>
);

const SetupState = ({ databaseStatus }: { databaseStatus: string }): ReactElement => (
  <section className="state-card setup-card" aria-label="Setup needed dashboard state">
    <div className="state-glyph" aria-hidden="true" />
    <div>
      <h2>{databaseStatus === 'database-unavailable' ? 'Database unavailable' : 'Setup needed'}</h2>
      <p>
        No TokenWatch database data is available yet. Run a scan or seed data from the CLI, then
        refresh this private analytics shell.
      </p>
    </div>
  </section>
);

const ErrorState = ({ error }: { error: ReturnType<typeof formatRendererError> }): ReactElement => (
  <section
    className="state-card error-card"
    aria-label="Sanitized dashboard error"
    aria-live="polite"
  >
    <div className="state-glyph" aria-hidden="true" />
    <div>
      <h2>Dashboard unavailable</h2>
      <p>{error.message}</p>
      <p className="error-code">Code: {error.code}</p>
    </div>
  </section>
);

const PopulatedState = ({ dashboard }: { dashboard: Dashboard }): ReactElement => {
  const [breakdownSorts, setBreakdownSorts] =
    useState<Record<BreakdownSectionId, BreakdownSortState>>(DEFAULT_BREAKDOWN_SORTS);
  const [selectedBreakdown, setSelectedBreakdown] = useState<SelectedBreakdown>(null);
  const unknownCostCount = Math.max(
    dashboard.unknownPricingCount,
    dashboard.totals.unknownCostEvents
  );
  const summaryCards: SummaryCardData[] = [
    {
      label: 'Total tokens',
      value: formatCount(dashboard.totals.tokens),
      detail: `${formatCount(dashboard.totals.inputTokens)} in / ${formatCount(
        dashboard.totals.outputTokens
      )} out`
    },
    {
      label: 'Estimated cost',
      value: formatUsd(dashboard.totals.estimatedCostUsd),
      detail: formatUnknownPricing(unknownCostCount),
      tone:
        dashboard.totals.estimatedCostUsd === null || unknownCostCount > 0 ? 'warning' : 'normal'
    },
    {
      label: 'Event count',
      value: formatCount(dashboard.totals.events),
      detail: `${formatCount(dashboard.totals.cachedTokens)} cached tokens`
    },
    {
      label: 'Date range',
      value: formatDateRange(dashboard.dateRange),
      detail: 'Sanitized aggregate window'
    },
    {
      label: 'Top model',
      value: formatSafeLabel(dashboard.top.model),
      detail: `${formatCount(dashboard.totals.models)} models observed`
    },
    {
      label: 'Top agent',
      value: formatSafeLabel(dashboard.top.agent),
      detail: `${formatCount(dashboard.totals.agents)} agents observed`
    },
    {
      label: 'Top sourceName',
      value: formatSafeLabel(dashboard.top.sourceName),
      detail: `${formatCount(dashboard.totals.sourceNames)} source names`
    },
    {
      label: 'Top source',
      value: formatSafeLabel(dashboard.top.source),
      detail: `${formatCount(dashboard.totals.sources)} source types`
    }
  ];
  const usagePoints = dashboard.usageSeries.map((point) => ({
    detail: `${formatCount(point.tokens)} tokens across ${formatCount(point.events)} events`,
    key: point.key,
    value: point.tokens
  }));
  const costPoints = dashboard.costSeries.map((point) => ({
    detail:
      point.estimatedCostUsd === null
        ? `unknown cost for ${formatCount(point.unknownCostEvents)} events`
        : `${formatUsd(point.estimatedCostUsd)} estimated`,
    key: point.key,
    unknown: point.estimatedCostUsd === null || point.unknownCostEvents > 0,
    value: point.estimatedCostUsd
  }));
  const modelItems = dashboard.byModel.map((item) => ({
    detail: `${formatCount(item.events)} events`,
    key: formatSafeLabel(item.key),
    value: item.totalTokens
  }));
  const sourceNameItems = dashboard.bySourceName.map((item) => ({
    detail: `${formatCount(item.events)} events`,
    key: formatSafeLabel(item.key),
    value: item.totalTokens
  }));
  const breakdownSections: BreakdownSection[] = [
    { id: 'model', rows: dashboard.byModel, title: 'By Model' },
    { id: 'agent', rows: dashboard.byAgent, title: 'By Agent' },
    { id: 'source', rows: dashboard.bySource, title: 'By Source' },
    { id: 'sourceName', rows: dashboard.bySourceName, title: 'By Source Name' }
  ];
  const selectedSection = selectedBreakdown
    ? breakdownSections.find((section) => section.id === selectedBreakdown.sectionId)
    : undefined;
  const selectedRow =
    selectedSection && selectedBreakdown
      ? (selectedSection.rows.find((row) => row.key === selectedBreakdown.rowKey) ?? null)
      : null;
  const updateBreakdownSort = (sectionId: BreakdownSectionId, column: BreakdownSortKey): void => {
    setBreakdownSorts((current) => ({
      ...current,
      [sectionId]: {
        column,
        direction: getBreakdownSortDirection(current[sectionId], column)
      }
    }));
  };

  return (
    <section className="analytics-grid" aria-label="Analytics regions">
      {unknownCostCount > 0 ? (
        <article className="pricing-warning" aria-label="Unknown pricing warning">
          <strong>Unknown pricing detected</strong>
          <span>{formatUnknownPricing(unknownCostCount)} are shown as unknown, not zero cost.</span>
        </article>
      ) : null}
      <article className="analytics-card summary-card-panel" aria-label="Dashboard summary cards">
        <p className="eyebrow">Summary cards</p>
        <h2>Privacy-safe rollup</h2>
        <div className="summary-grid">
          {summaryCards.map((card) => (
            <SummaryCard
              detail={card.detail}
              key={card.label}
              label={card.label}
              tone={card.tone}
              value={card.value}
            />
          ))}
        </div>
      </article>

      <LineChart
        emptyLabel="No usage data available"
        eyebrow="Token flow"
        points={usagePoints}
        title="Usage over time chart"
        valueLabel="tokens"
      />

      <LineChart
        emptyLabel="No known cost data available"
        eyebrow="Cost flow"
        points={costPoints}
        title="Cost over time chart"
        valueLabel="estimated cost"
      />

      <DistributionChart
        emptyLabel="No model distribution available"
        eyebrow="Model mix"
        items={modelItems}
        title="Model distribution chart"
      />

      <DistributionChart
        emptyLabel="No sourceName distribution available"
        eyebrow="SourceName mix"
        items={sourceNameItems}
        title="SourceName distribution chart"
      />

      <article className="analytics-card breakdown-card" aria-label="Dashboard breakdown tables">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Breakdowns</p>
            <h2>Sortable aggregate tables</h2>
          </div>
          <span>safe fields</span>
        </div>
        <div className="breakdown-layout">
          <div className="breakdown-list">
            {breakdownSections.map((section) => (
              <BreakdownTable
                key={section.id}
                onSelect={(row) => setSelectedBreakdown({ rowKey: row.key, sectionId: section.id })}
                onSort={(column) => updateBreakdownSort(section.id, column)}
                rows={sortBreakdownRows(section.rows, breakdownSorts[section.id])}
                selectedRowKey={
                  selectedBreakdown?.sectionId === section.id ? selectedBreakdown.rowKey : null
                }
                sort={breakdownSorts[section.id]}
                title={section.title}
              />
            ))}
          </div>
          <BreakdownDrilldown row={selectedRow} sectionTitle={selectedSection?.title ?? null} />
        </div>
      </article>
    </section>
  );
};

const BreakdownTable = ({
  onSelect,
  onSort,
  rows,
  selectedRowKey,
  sort,
  title
}: {
  onSelect: (row: BreakdownRow) => void;
  onSort: (column: BreakdownSortKey) => void;
  rows: BreakdownRow[];
  selectedRowKey: string | null;
  sort: BreakdownSortState;
  title: string;
}): ReactElement => (
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

const BreakdownDrilldown = ({
  row,
  sectionTitle
}: {
  row: BreakdownRow | null;
  sectionTitle: string | null;
}): ReactElement => (
  <aside className="breakdown-drilldown" aria-label="Breakdown drilldown panel">
    <p className="eyebrow">Drilldown</p>
    {row && sectionTitle ? (
      <>
        <h3>{formatSafeLabel(row.key)}</h3>
        <p>{sectionTitle} aggregate details. No raw events or local artifacts are shown.</p>
        <dl>
          <div>
            <dt>Events</dt>
            <dd>{formatCount(row.events)}</dd>
          </div>
          <div>
            <dt>Input tokens</dt>
            <dd>{formatCount(row.inputTokens)}</dd>
          </div>
          <div>
            <dt>Output tokens</dt>
            <dd>{formatCount(row.outputTokens)}</dd>
          </div>
          <div>
            <dt>Cached tokens</dt>
            <dd>{formatCount(row.cachedTokens)}</dd>
          </div>
          <div>
            <dt>Reasoning tokens</dt>
            <dd>{formatCount(row.reasoningTokens)}</dd>
          </div>
          <div>
            <dt>Total tokens</dt>
            <dd>{formatCount(row.totalTokens)}</dd>
          </div>
          <div>
            <dt>Estimated cost</dt>
            <dd>{formatUsd(row.estimatedCostUsd)}</dd>
          </div>
          <div>
            <dt>Top related model</dt>
            <dd>{formatSafeLabel(row.topModel)}</dd>
          </div>
          <div>
            <dt>Top related agent</dt>
            <dd>{formatSafeLabel(row.topAgent)}</dd>
          </div>
        </dl>
      </>
    ) : (
      <>
        <h3>Select an aggregate row</h3>
        <p>Choose any breakdown row to inspect aggregate-only token and cost fields.</p>
      </>
    )}
  </aside>
);

const SummaryCard = ({
  detail,
  label,
  tone = 'normal',
  value
}: {
  detail: string;
  label: string;
  tone?: 'normal' | 'warning';
  value: string;
}): ReactElement => (
  <article className={tone === 'warning' ? 'summary-card warning' : 'summary-card'}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
);

const LineChart = ({
  emptyLabel,
  eyebrow,
  points,
  title,
  valueLabel
}: {
  emptyLabel: string;
  eyebrow: string;
  points: LineChartPoint[];
  title: string;
  valueLabel: string;
}): ReactElement => {
  const knownPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter(
      (point): point is LineChartPoint & { index: number; value: number } =>
        typeof point.value === 'number'
    );
  const maxValue = Math.max(0, ...knownPoints.map((point) => point.value));
  const path = knownPoints
    .map((point, knownIndex) => {
      const command = knownIndex === 0 ? 'M' : 'L';
      const x = toPointX(point.index, points.length);
      const y = toPointY(point.value, maxValue);
      return `${command} ${formatCoordinate(x)} ${formatCoordinate(y)}`;
    })
    .join(' ');
  const unknownPoints = points.filter((point) => point.unknown).length;

  return (
    <article className="analytics-card chart-card" aria-label={`${title} region`}>
      <div className="chart-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title.replace(' chart', '')}</h2>
        </div>
        <span>{valueLabel}</span>
      </div>
      <svg
        aria-label={title}
        className="line-chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <title>{title}</title>
        <rect
          className="chart-plot"
          x="0"
          y="0"
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          rx="18"
        />
        <line
          className="chart-axis"
          x1={CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y1={CHART_HEIGHT - CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />
        {path ? <path className="chart-line" d={path} /> : null}
        {knownPoints.map((point) => (
          <circle
            className="chart-point"
            cx={formatCoordinate(toPointX(point.index, points.length))}
            cy={formatCoordinate(toPointY(point.value, maxValue))}
            key={point.key}
            r="5"
          />
        ))}
        {knownPoints.length === 0 ? (
          <text className="chart-empty" x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2}>
            {emptyLabel}
          </text>
        ) : null}
      </svg>
      <div className="chart-labels" aria-label={`${title} data`}>
        {points.length === 0 ? <span>{emptyLabel}</span> : null}
        {points.map((point) => (
          <span className={point.unknown ? 'unknown' : undefined} key={point.key}>
            {point.key}: {point.detail}
          </span>
        ))}
        {unknownPoints > 0 ? <span className="unknown">unknown cost present</span> : null}
      </div>
    </article>
  );
};

const DistributionChart = ({
  emptyLabel,
  eyebrow,
  items,
  title
}: {
  emptyLabel: string;
  eyebrow: string;
  items: DistributionChartItem[];
  title: string;
}): ReactElement => {
  const maxValue = Math.max(0, ...items.map((item) => item.value));
  const chartHeight = Math.max(220, BAR_TOP_OFFSET + items.length * BAR_ROW_HEIGHT + CHART_PADDING);
  const donutSegments = toDonutSegments(items);

  return (
    <article className="analytics-card chart-card" aria-label={`${title} region`}>
      <div className="chart-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title.replace(' chart', '')}</h2>
        </div>
        <span>tokens</span>
      </div>
      <svg
        aria-label={title}
        className="bar-chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
      >
        <title>{title}</title>
        <rect className="chart-plot" x="0" y="0" width={CHART_WIDTH} height={chartHeight} rx="18" />
        {donutSegments.length > 0 ? (
          <g className="donut-chart" aria-hidden="true">
            <circle
              className="donut-track"
              cx={DONUT_CENTER_X}
              cy={DONUT_CENTER_Y}
              r={DONUT_RADIUS}
              strokeWidth={DONUT_STROKE_WIDTH}
            />
            <g transform={`rotate(-90 ${DONUT_CENTER_X} ${DONUT_CENTER_Y})`}>
              {donutSegments.map((segment) => (
                <circle
                  className={segment.segmentClassName}
                  cx={DONUT_CENTER_X}
                  cy={DONUT_CENTER_Y}
                  key={segment.key}
                  r={DONUT_RADIUS}
                  strokeDasharray={segment.dasharray}
                  strokeDashoffset={segment.dashoffset}
                  strokeWidth={DONUT_STROKE_WIDTH}
                />
              ))}
            </g>
            <text className="donut-total" x={DONUT_CENTER_X} y={DONUT_CENTER_Y - 2}>
              {items.length}
            </text>
            <text className="donut-caption" x={DONUT_CENTER_X} y={DONUT_CENTER_Y + 15}>
              groups
            </text>
          </g>
        ) : null}
        {items.map((item, index) => {
          const barWidth =
            maxValue > 0 ? Math.max(2, (item.value / maxValue) * BAR_TRACK_WIDTH) : 2;
          const y = BAR_TOP_OFFSET + index * BAR_ROW_HEIGHT;
          return (
            <g key={item.key}>
              <text className="bar-label" x={BAR_TRACK_X} y={y - 8}>
                {item.key}
              </text>
              <rect
                className="bar-track"
                height={BAR_HEIGHT}
                rx="6"
                width={BAR_TRACK_WIDTH}
                x={BAR_TRACK_X}
                y={y}
              />
              <rect
                className="bar-fill"
                height={BAR_HEIGHT}
                rx="6"
                width={formatCoordinate(barWidth)}
                x={BAR_TRACK_X}
                y={y}
              />
            </g>
          );
        })}
        {items.length === 0 ? (
          <text className="chart-empty" x={CHART_WIDTH / 2} y={chartHeight / 2}>
            {emptyLabel}
          </text>
        ) : null}
      </svg>
      <div className="chart-labels" aria-label={`${title} data`}>
        {items.length === 0 ? <span>{emptyLabel}</span> : null}
        {items.map((item) => (
          <span key={item.key}>
            {item.key}: {formatCount(item.value)} tokens, {item.detail}
          </span>
        ))}
      </div>
    </article>
  );
};
