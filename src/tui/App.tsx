import { basename } from 'node:path';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type {
  PricingDiagnosticGroup,
  SessionSummaryGroup,
  SummaryGroup,
  TuiData
} from '../services/aggregator.js';
import type { BudgetEvaluation } from '../services/budgetService.js';
import { renderStatuslineText } from '../services/statusline.js';
import type { TuiSettings } from '../services/configService.js';
import { formatUsd } from '../utils/format.js';
import { DataTable, type TableRow } from './components/DataTable.js';
import { DetailPanel } from './components/DetailPanel.js';
import { EmptyState } from './components/EmptyState.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { HelpView } from './components/HelpView.js';
import { Layout } from './components/Layout.js';
import { Navigation } from './components/Navigation.js';
import { views, type TuiProps, type ViewKey } from './state.js';
import { tuiRefreshLabel } from './theme.js';

const DEFAULT_TUI_SETTINGS: TuiSettings = {
  theme: 'blue',
  autoRefreshEnabled: false,
  autoRefreshMs: 60000
};

export function App({
  loadData,
  loadStatusline,
  onExportView,
  initialViewKey,
  initialDetails,
  settings = DEFAULT_TUI_SETTINGS,
  cache
}: TuiProps) {
  const app = useApp();
  const initialDataRef = useRef<InitialTuiData | null>(null);
  if (!initialDataRef.current) {
    initialDataRef.current = loadInitialTuiData(loadData, cache);
  }
  const [data, setData] = useState<TuiData>(initialDataRef.current.data);
  const [statuslineText, setStatuslineText] = useState(() =>
    loadStatusline ? renderStatuslineText(loadStatusline()) : undefined
  );
  const refreshStatus = tuiRefreshLabel(settings);
  const [cacheStatus, setCacheStatus] = useState(initialDataRef.current.cacheStatus);
  const refreshedCachedDataRef = useRef(false);
  const [viewIndex, setViewIndex] = useState(() =>
    Math.max(
      0,
      views.findIndex((candidate) => candidate.key === initialViewKey)
    )
  );
  const [rowIndex, setRowIndex] = useState(0);
  const [details, setDetails] = useState(Boolean(initialDetails));
  const [selected, setSelected] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [sortStateByView, setSortStateByView] = useState<Partial<Record<ViewKey, SortState>>>({});
  const refreshData = useCallback(() => {
    const nextData = loadData();
    const nextStatuslineText = loadStatusline ? renderStatuslineText(loadStatusline()) : undefined;
    setData({ ...nextData });
    setStatuslineText(nextStatuslineText);
    cache?.write(nextData);
    setCacheStatus('refreshed');
    setMessage('Refresh: just now');
    return nextData;
  }, [cache, loadData, loadStatusline]);

  useEffect(() => {
    if (!initialDataRef.current?.usedCache || refreshedCachedDataRef.current) return;
    refreshedCachedDataRef.current = true;
    const timeout = setTimeout(() => {
      refreshData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [refreshData]);

  useEffect(() => {
    if (!settings.autoRefreshEnabled || settings.autoRefreshMs <= 0) return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleRefresh = () => {
      timeout = setTimeout(() => {
        if (!active) return;
        refreshData();
        scheduleRefresh();
      }, settings.autoRefreshMs);
    };
    scheduleRefresh();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [refreshData, settings.autoRefreshEnabled, settings.autoRefreshMs]);

  const view = views[viewIndex] ?? views[0];
  const rowSort = sortStateForView(view.key, sortStateByView[view.key]);
  const unsortedRows = useMemo(() => rowsForView(data, view.key), [data, view.key]);
  const rows = useMemo(
    () => sortRows(unsortedRows, view.key, rowSort),
    [rowSort.columnIndex, rowSort.direction, unsortedRows, view.key]
  );
  const safeRowIndex = rows.length === 0 ? 0 : Math.min(rowIndex, rows.length - 1);
  const sortLabel = sortLabelForView(view.key, rowSort);

  useEffect(() => {
    setRowIndex((index) => (rows.length === 0 ? 0 : Math.min(index, rows.length - 1)));
  }, [rows.length, rowSort.columnIndex, rowSort.direction, view.key]);

  useInput((input, key) => {
    if (input === 'q') {
      app.exit();
      return;
    }
    if (key.escape) {
      setDetails(false);
      return;
    }
    if (input === '?') {
      setViewIndex(views.findIndex((candidate) => candidate.key === 'help'));
      setDetails(false);
      setRowIndex(0);
      return;
    }
    if (input === 'r') {
      refreshData();
      return;
    }
    if (input === 'e') {
      const out = onExportView(view.key, rows);
      setMessage(exportStatusMessage(view.label, rows.length, out));
      return;
    }
    if (input === 's') {
      setSortStateByView((states) => cycleSortState(states, view.key));
      setRowIndex(0);
      return;
    }
    if (input === 'S') {
      setSortStateByView((states) => reverseSortState(states, view.key));
      setRowIndex(0);
      return;
    }
    if (input === ' ') {
      setSelected((value) => !value);
      setMessage(selected ? 'selection off' : 'selection on');
      return;
    }
    if (key.return) {
      setDetails(true);
      return;
    }
    if (key.leftArrow) {
      setViewIndex((index) => (index - 1 + views.length) % views.length);
      setRowIndex(0);
      setDetails(false);
      return;
    }
    if (key.rightArrow) {
      setViewIndex((index) => (index + 1) % views.length);
      setRowIndex(0);
      setDetails(false);
      return;
    }
    if (key.upArrow) {
      setRowIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (key.downArrow) {
      setRowIndex((index) => Math.max(0, Math.min(rows.length - 1, index + 1)));
    }
  });

  return (
    <Layout theme={settings.theme}>
      <Header
        totals={data.totals}
        settings={settings}
        refreshStatus={refreshStatus}
        cacheStatus={cacheStatus}
      />
      <Box>
        <Navigation activeIndex={viewIndex} theme={settings.theme} />
        <Box flexDirection="column" flexGrow={1}>
          <Text bold>
            {view.label} {sortLabel}
          </Text>
          {message ? <Text>{message}</Text> : null}
          {view.key === 'help' ? (
            <HelpView />
          ) : rows.length === 0 ? (
            <EmptyState theme={settings.theme} />
          ) : (
            <DataTable
              rows={rows}
              selectedIndex={safeRowIndex}
              theme={settings.theme}
              columnLimit={columnLimitForView(view.key)}
            />
          )}
          {details ? <DetailPanel row={rows[safeRowIndex] ?? null} theme={settings.theme} /> : null}
        </Box>
      </Box>
      <Footer
        settings={settings}
        refreshStatus={refreshStatus}
        cacheStatus={cacheStatus}
        message={message}
        statuslineText={statuslineText}
      />
    </Layout>
  );
}

function exportStatusMessage(viewLabel: string, rowCount: number, out: string): string {
  const safeFile = basename(out) || 'export file';
  const rowLabel = rowCount === 1 ? 'row' : 'rows';
  return `Exported ${viewLabel} current view (${rowCount} ${rowLabel}) to ${safeFile}`;
}

type InitialTuiData = {
  data: TuiData;
  usedCache: boolean;
  cacheStatus: string;
};

type SortDirection = 'asc' | 'desc';

type SortState = {
  columnIndex: number;
  direction: SortDirection;
};

type SortColumn = {
  key: string;
  label: string;
  direction: SortDirection;
};

type SortDefinition = {
  columns: SortColumn[];
};

const STABLE_SORT: SortDefinition = { columns: [] };

const SORT_DEFINITIONS: Record<ViewKey, SortDefinition> = {
  overview: STABLE_SORT,
  usage: columns(
    ['total_tokens', 'total', 'desc'],
    ['estimated_cost_usd', 'cost', 'desc'],
    ['timestamp', 'timestamp', 'desc'],
    ['model', 'model', 'asc'],
    ['source_name', 'source', 'asc']
  ),
  stats: STABLE_SORT,
  insights: columns(
    ['severity', 'severity', 'desc'],
    ['impact', 'impact', 'desc'],
    ['metric', 'metric', 'asc']
  ),
  trends: columns(
    ['absolute_delta', 'delta', 'desc'],
    ['metric', 'metric', 'asc'],
    ['status', 'status', 'asc']
  ),
  reports: STABLE_SORT,
  source: groupedColumns('source'),
  sourceName: groupedColumns('sourceName'),
  model: groupedColumns('model'),
  agent: groupedColumns('agent'),
  agents: columns(
    ['total', 'total', 'desc'],
    ['estimated_cost_usd', 'cost', 'desc'],
    ['agent', 'agent', 'asc'],
    ['events', 'events', 'desc']
  ),
  monthly: bucketColumns('key', 'bucket'),
  minutely: bucketColumns('minute', 'bucket'),
  daily: bucketColumns('key', 'bucket'),
  hourly: bucketColumns('key', 'bucket'),
  sessionIntervals: columns(
    ['ended_at', 'timestamp', 'desc'],
    ['total_tokens', 'total', 'desc'],
    ['estimated_cost_usd', 'cost', 'desc'],
    ['source', 'source', 'asc']
  ),
  sessions: columns(
    ['last_seen', 'timestamp', 'desc'],
    ['total', 'total', 'desc'],
    ['cost', 'cost', 'desc'],
    ['source', 'source', 'asc']
  ),
  concurrency: STABLE_SORT,
  sessionMetrics: STABLE_SORT,
  runs: columns(
    ['started_at', 'timestamp', 'desc'],
    ['status', 'status', 'asc'],
    ['parsed', 'parsed', 'desc']
  ),
  pricing: columns(
    ['token_scale', 'total', 'desc'],
    ['model', 'model', 'asc'],
    ['status', 'status', 'asc']
  ),
  budgets: columns(
    ['known_spend', 'cost', 'desc'],
    ['status', 'status', 'asc'],
    ['scope', 'scope', 'asc']
  ),
  help: STABLE_SORT
};

function columns(
  ...definitions: Array<[key: string, label: string, direction: SortDirection]>
): SortDefinition {
  return {
    columns: definitions.map(([key, label, direction]) => ({ key, label, direction }))
  };
}

function groupedColumns(label: string): SortDefinition {
  return columns(['total', 'total', 'desc'], ['key', label, 'asc'], ['cost', 'cost', 'desc']);
}

function bucketColumns(key: string, label: string): SortDefinition {
  return columns([key, label, 'asc'], ['total', 'total', 'desc'], ['cost', 'cost', 'desc']);
}

function sortStateForView(key: ViewKey, state: SortState | undefined): SortState {
  const definition = SORT_DEFINITIONS[key];
  if (definition.columns.length === 0) return { columnIndex: -1, direction: 'asc' };
  const columnIndex = Math.max(0, Math.min(state?.columnIndex ?? 0, definition.columns.length - 1));
  return {
    columnIndex,
    direction: state?.direction ?? definition.columns[columnIndex]?.direction ?? 'asc'
  };
}

function cycleSortState(
  states: Partial<Record<ViewKey, SortState>>,
  key: ViewKey
): Partial<Record<ViewKey, SortState>> {
  const definition = SORT_DEFINITIONS[key];
  if (definition.columns.length === 0) return states;
  const current = sortStateForView(key, states[key]);
  const columnIndex = (current.columnIndex + 1) % definition.columns.length;
  const column = definition.columns[columnIndex];
  return { ...states, [key]: { columnIndex, direction: column?.direction ?? 'asc' } };
}

function reverseSortState(
  states: Partial<Record<ViewKey, SortState>>,
  key: ViewKey
): Partial<Record<ViewKey, SortState>> {
  const definition = SORT_DEFINITIONS[key];
  if (definition.columns.length === 0) return states;
  const current = sortStateForView(key, states[key]);
  return {
    ...states,
    [key]: { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  };
}

function sortRows(rows: TableRow[], key: ViewKey, state: SortState): TableRow[] {
  const column = SORT_DEFINITIONS[key].columns[state.columnIndex];
  if (!column) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareSortValues(left.row[column.key], right.row[column.key]);
      return (state.direction === 'asc' ? result : -result) || left.index - right.index;
    })
    .map(({ row }) => row);
}

function compareSortValues(left: TableRow[string], right: TableRow[string]): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  const leftNumber = numericSortValue(left);
  const rightNumber = numericSortValue(right);
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function numericSortValue(value: TableRow[string]): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/^\$/, '').replaceAll(',', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function sortLabelForView(key: ViewKey, state: SortState): string {
  const column = SORT_DEFINITIONS[key].columns[state.columnIndex];
  if (!column) return 'Sort: default';
  return `Sort: ${column.label} ${state.direction === 'asc' ? '↑' : '↓'}`;
}

function loadInitialTuiData(loadData: () => TuiData, cache: TuiProps['cache']): InitialTuiData {
  const cachedData = cache?.read() ?? null;
  if (cachedData) {
    return { data: cachedData, usedCache: true, cacheStatus: 'warm' };
  }
  const data = loadData();
  cache?.write(data);
  return { data, usedCache: false, cacheStatus: 'live' };
}

function rowsForView(data: TuiData, key: ViewKey): TableRow[] {
  switch (key) {
    case 'overview':
      return [
        { metric: 'total events', value: data.totals.totalEvents },
        { metric: 'total tokens', value: data.totals.totalTokens },
        { metric: 'input tokens', value: data.totals.totalInputTokens },
        { metric: 'output tokens', value: data.totals.totalOutputTokens },
        { metric: 'cached tokens', value: data.totals.totalCachedTokens },
        { metric: 'estimated cost', value: data.totals.estimatedTotalCostUsd ?? 'unknown' },
        { metric: 'top source', value: data.totals.topSource ?? 'none' },
        { metric: 'top sourceName', value: data.totals.topSourceName ?? 'none' }
      ];
    case 'usage':
      return usageRows(data.usageRows);
    case 'stats':
      return statsRows(data);
    case 'insights':
      return insightRows(data.insightsRows);
    case 'trends':
      return trendRows(data.trendRows);
    case 'reports':
      return reportGuidanceRows(data);
    case 'source':
      return groupRows(data.bySource);
    case 'sourceName':
      return groupRows(data.bySourceName);
    case 'model':
      return groupRows(data.byModel, { includeProvider: true, includePricing: true });
    case 'agent':
      return groupRows(data.byAgent);
    case 'agents':
      return agentRows(data.agentRows);
    case 'monthly':
      return groupRows(data.byMonth);
    case 'minutely':
      return minutelyRows(data.minutelyBuckets);
    case 'daily':
      return groupRows(data.byDay);
    case 'hourly':
      return groupRows(data.byHour);
    case 'sessionIntervals':
      return sessionIntervalRows(data.sessions);
    case 'sessions':
      return sessionRows(data.sessions);
    case 'concurrency':
      return concurrencyRows(data.sessionMetrics);
    case 'sessionMetrics':
      return [
        {
          session_count: data.sessionMetrics.sessionCount,
          total_wall_duration_ms: data.sessionMetrics.totalWallDurationMs,
          total_active_duration_ms: data.sessionMetrics.totalActiveDurationMs,
          longest_continuous_ms: data.sessionMetrics.longestContinuousMs,
          max_concurrent_sessions: data.sessionMetrics.maxConcurrentSessions,
          events_without_session: data.sessionMetrics.eventsWithoutSession,
          longest_session_ms: data.sessionMetrics.longestSessionMs
        }
      ];
    case 'runs':
      return data.recentRuns.map((run) => ({
        started_at: run.startedAt,
        sourceName: run.sourceName,
        parser: run.parserName ?? 'all',
        status: run.status,
        parsed: run.parsedEvents,
        skipped: run.skippedRecords,
        rejected: run.rejectedRecords,
        errors: run.errorRecords,
        code: run.errorCode ?? 'none',
        warnings: run.warningCodes.length > 0 ? run.warningCodes.join(',') : 'none',
        path_kind: run.pathKind
      }));
    case 'pricing':
      return pricingDiagnosticRows(data.pricingDiagnostics);
    case 'budgets':
      return budgetRows(data.budgets);
    case 'help':
      return [];
  }
}

function columnLimitForView(key: ViewKey): number | undefined {
  if (key === 'usage') return 10;
  if (key === 'minutely') return 7;
  if (key === 'agents') return 8;
  if (key === 'insights' || key === 'trends') return 12;
  return undefined;
}

function usageRows(rows: TuiData['usageRows']): TableRow[] {
  return rows.map((row) => ({
    timestamp: row.timestamp,
    source: row.source,
    source_name: row.sourceName,
    agent: row.agent,
    model: row.model,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    cached_tokens: row.cachedTokens,
    total_tokens: row.totalTokens,
    cost: row.cost,
    cache_write_tokens: row.cacheWriteTokens,
    reasoning_tokens: row.reasoningTokens,
    estimated_cost_usd: row.estimatedCostUsd
  }));
}

function minutelyRows(rows: TuiData['minutelyBuckets']): TableRow[] {
  return rows.map((row) => ({
    minute: row.minute,
    events: row.events,
    input: row.inputTokens,
    output: row.outputTokens,
    cached: row.cachedTokens,
    total: row.totalTokens,
    cost: row.cost,
    cache_write_tokens: row.cacheWriteTokens,
    reasoning_tokens: row.reasoningTokens,
    estimated_cost_usd: row.estimatedCostUsd
  }));
}

function statsRows(data: TuiData): TableRow[] {
  if (data.totals.totalEvents === 0) return [];
  return data.statsRows.map((row) => ({ stat: row.stat, value: row.value }));
}

function insightRows(rows: TuiData['insightsRows']): TableRow[] {
  return rows.map((row) => ({
    metric: row.metric,
    status: row.status,
    current: row.current,
    previous: row.previous,
    delta: row.delta,
    tokens: row.tokens,
    estimated_cost_usd: row.estimatedCostUsd,
    known_estimated_cost_usd: row.knownEstimatedCostUsd,
    unknown_cost_events: row.unknownCostEvents,
    unknown_cost_tokens: row.unknownCostTokens,
    warning: row.warning,
    severity: row.severity,
    impact: row.impact
  }));
}

function trendRows(rows: TuiData['trendRows']): TableRow[] {
  return rows.map((row) => ({
    category: row.category,
    metric: row.metric,
    status: row.status,
    current: row.current,
    previous: row.previous,
    delta: row.delta,
    absolute_delta: row.absoluteDelta,
    delta_percent: row.deltaPercent,
    tokens: row.tokens,
    estimated_cost_usd: row.estimatedCostUsd,
    known_estimated_cost_usd: row.knownEstimatedCostUsd,
    unknown_cost_events: row.unknownCostEvents,
    unknown_cost_tokens: row.unknownCostTokens,
    warning: row.warning
  }));
}

function reportGuidanceRows(data: TuiData): TableRow[] {
  const eventLabel = data.totals.totalEvents === 1 ? 'event' : 'events';
  const sourceLabel = data.bySource.length === 1 ? 'source' : 'sources';
  const runLabel = data.recentRuns.length === 1 ? 'run' : 'runs';
  const hasUsage = data.totals.totalEvents > 0;
  const hasSources = data.bySource.length > 0 || data.recentRuns.length > 0;

  return [
    {
      report: 'graph',
      command: 'graph --json; graph --out',
      availability: hasUsage ? 'usage data available' : 'no usage events yet',
      basis: `${data.totals.totalEvents} ${eventLabel}`
    },
    {
      report: 'wrapped',
      command: 'wrapped --year',
      availability: hasUsage ? 'year summary available' : 'no usage events yet',
      basis: `${data.byMonth.length} month buckets`
    },
    {
      report: 'insights',
      command: 'insights --window 7d --json',
      availability: hasUsage ? 'insights report available' : 'no usage events yet',
      basis: `${data.insightsRows.length} insight rows`
    },
    {
      report: 'optimize',
      command: 'optimize --window 30d',
      availability: hasUsage ? 'optimization report available' : 'no usage events yet',
      basis: `${data.trendRows.length} trend rows`
    },
    {
      report: 'doctor sources',
      command: 'doctor --sources',
      availability: hasSources ? 'source status available' : 'no source runs yet',
      basis: `${data.bySource.length} ${sourceLabel}, ${data.recentRuns.length} ${runLabel}`
    },
    {
      report: 'usage provider',
      command: 'usage --provider',
      availability: 'live provider probe',
      basis: `${data.pricingDiagnostics.length} pricing diagnostics`
    },
    {
      report: 'headless codex',
      command: 'headless codex --input',
      availability: 'input file or stdin',
      basis: 'normalized ingest only'
    }
  ];
}

function agentRows(rows: TuiData['agentRows']): TableRow[] {
  return rows.map((row) => ({
    agent: row.agent,
    events: row.events,
    input: row.inputTokens,
    output: row.outputTokens,
    cached: row.cachedTokens,
    total: row.totalTokens,
    cost: row.cost,
    top_model: row.topModel ?? 'none',
    cache_write_tokens: row.cacheWriteTokens,
    reasoning_tokens: row.reasoningTokens,
    estimated_cost_usd: row.estimatedCostUsd
  }));
}

function groupRows(
  groups: SummaryGroup[],
  options: { includeProvider?: boolean; includePricing?: boolean } = {}
): TableRow[] {
  return groups.map((group) => ({
    key: group.key,
    ...(options.includeProvider ? { provider: group.provider ?? 'unknown' } : {}),
    events: group.events,
    total: group.totalTokens,
    input: group.inputTokens,
    output: group.outputTokens,
    cost: group.estimatedCostUsd ?? 'unknown',
    ...(options.includePricing
      ? {
          pricing_source: group.pricingSource ?? 'unknown',
          pricing_confidence: group.pricingConfidence ?? 'none'
        }
      : {})
  }));
}

function sessionIntervalRows(sessions: SessionSummaryGroup[]): TableRow[] {
  return sessions.map((session) => ({
    source: session.source,
    session_id_hash: session.sessionIdHash,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    wall_duration_ms: session.wallDurationMs,
    active_duration_ms: session.activeDurationMs,
    message_count: session.messageCount,
    total_tokens: session.totalTokens,
    estimated_cost_usd: session.estimatedCostUsd ?? 'unknown',
    events: session.events,
    ...workspaceFields(session)
  }));
}

function workspaceFields(session: SessionSummaryGroup): TableRow {
  const candidate = session as SessionSummaryGroup & {
    workspaceLabel?: string | null;
    workspaceHash?: string | null;
  };
  return {
    ...(candidate.workspaceLabel ? { workspace_label: candidate.workspaceLabel } : {}),
    ...(candidate.workspaceHash ? { workspace_hash: candidate.workspaceHash } : {})
  };
}

function sessionRows(sessions: SessionSummaryGroup[]): TableRow[] {
  return sessions.map((session) => ({
    key: session.key,
    source: session.source,
    session_id_hash: session.sessionIdHash,
    events: session.events,
    message_count: session.messageCount,
    total: session.totalTokens,
    input: session.inputTokens,
    output: session.outputTokens,
    active_duration_ms: session.activeDurationMs,
    wall_duration_ms: session.wallDurationMs,
    cost: session.estimatedCostUsd ?? 'unknown',
    started_at: session.startedAt,
    ended_at: session.endedAt,
    last_seen: session.lastSeen
  }));
}

function concurrencyRows(metrics: TuiData['sessionMetrics']): TableRow[] {
  return [
    {
      session_count: metrics.sessionCount,
      max_concurrent_sessions: metrics.maxConcurrentSessions,
      longest_continuous_duration_ms: metrics.longestContinuousMs,
      total_active_duration_ms: metrics.totalActiveDurationMs,
      total_wall_duration_ms: metrics.totalWallDurationMs,
      events_without_session: metrics.eventsWithoutSession,
      longest_session_duration_ms: metrics.longestSessionMs
    }
  ];
}

function pricingDiagnosticRows(groups: PricingDiagnosticGroup[]): TableRow[] {
  return groups.map((group) => ({
    provider: group.provider ?? 'unknown',
    model: group.key,
    status: group.diagnosticStatus,
    pricing_source: group.pricingSource ?? 'unknown',
    pricing_confidence: group.pricingConfidence ?? 'none',
    cache_status: group.cacheStatus,
    matched_key: group.matchedKey ?? 'none',
    occurrence_count: group.events,
    token_scale: group.totalTokens,
    estimated_missing_cost: group.estimatedCostUsd === null ? null : 'not_applicable',
    normalized_provider: group.normalizedProvider ?? 'unknown',
    normalized_model: group.normalizedModel ?? group.key,
    action: group.recommendedAction
  }));
}

function budgetRows(budgets: BudgetEvaluation[]): TableRow[] {
  return budgets
    .filter((budget) => budget.warningRows.length > 0)
    .map((budget) => ({
      scope: budget.scopeKind,
      sourceName: budget.sourceName ?? 'all',
      known_spend: formatUsd(budget.knownSpendUsd),
      threshold: formatUsd(budget.thresholdUsd),
      status: budget.status,
      unknown_events: budget.unknownCostEventCount,
      unknown_tokens: budget.unknownCostTokenCount,
      action: recommendedBudgetAction(budget),
      warnings: budget.warningRows.map((warning) => warning.code).join(','),
      month: budget.month
    }));
}

function recommendedBudgetAction(budget: BudgetEvaluation): string {
  if (budget.warningRows.some((warning) => warning.code === 'budget_threshold_exceeded')) {
    return 'review budget threshold';
  }
  return 'add custom price';
}
