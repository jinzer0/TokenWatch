import { DEFAULT_SESSION_IDLE_GAP_MS } from '../app/constants.js';
import type { PricingLookupCacheEntry } from '../db/repositories/pricingModels.js';
import { containsUnsafePrivacyShape } from '../privacy.js';
import { formatUsd } from '../utils/format.js';
import {
  localDayBucket,
  localHourBucket,
  localMinuteBucket,
  localMonthBucket
} from '../utils/time.js';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import { BudgetStatusService, type BudgetStatusRow } from './budgetStatusService.js';
import { HeatmapService } from './heatmapService.js';
import { projectKeyForEvent } from './projectAttribution.js';
import type { HeatmapReport } from './reportContracts.js';
import {
  buildTuiInsightRows,
  buildTuiTrendRows,
  type TuiInsightRow,
  type TuiTrendRow
} from './tuiAnalyticsRows.js';

export type GroupBy =
  | 'model'
  | 'agent'
  | 'source'
  | 'sourceName'
  | 'project'
  | 'day'
  | 'hour'
  | 'month';

export type SummaryTotals = {
  totalEvents: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  estimatedTotalCostUsd: number | null;
  sourceCount: number;
  sourceNameCount: number;
  modelCount: number;
  agentCount: number;
  topSource: string | null;
  topSourceName: string | null;
  topModel: string | null;
  topAgent: string | null;
  dateRange: { start: string | null; end: string | null };
};

export type SummaryGroup = {
  key: string;
  provider?: string;
  pricingSource?: string | null;
  pricingConfidence?: string | null;
  normalizedProvider?: string | null;
  normalizedModel?: string | null;
  events: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  topModel?: string | null;
  topAgent?: string | null;
};

export type PricingCacheStatus =
  | 'matched-cache'
  | 'negative-cache'
  | 'network-fallback'
  | 'not-cached';

export type PricingDiagnosticStatus =
  | 'exact-match'
  | 'alias-match'
  | 'provider-prefix-match'
  | 'cursor-override'
  | 'fuzzy-match'
  | 'unresolved'
  | 'negative-cache'
  | 'network-fallback';

export type PricingDiagnosticGroup = SummaryGroup & {
  matchedKey: string | null;
  cacheStatus: PricingCacheStatus;
  diagnosticStatus: PricingDiagnosticStatus;
  recommendedAction: string;
};

export type PricingDiagnosticsOptions = {
  lookupCache?: readonly PricingLookupCacheEntry[];
  lookupWarning?: boolean;
};

export type SessionSummaryGroup = {
  key: string;
  source: string;
  sessionIdHash: string;
  events: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  startedAt: string;
  endedAt: string;
  lastSeen: string;
  wallDurationMs: number;
  activeDurationMs: number;
};

export type SessionTimeMetrics = {
  sessionCount: number;
  totalWallDurationMs: number;
  totalActiveDurationMs: number;
  longestSessionMs: number;
  longestContinuousMs: number;
  maxConcurrentSessions: number;
  eventsWithoutSession: number;
};

export type TuiUsageRow = {
  timestamp: string;
  source: string;
  sourceName: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  cost: string;
};

export type TuiMinutelyBucket = {
  minute: string;
  events: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  cost: string;
};

export type TuiStatRow = {
  stat: string;
  value: string | number | null;
};

export type TuiStatsSummary = {
  eventCount: number;
  totalTokens: number;
  averageTokensPerEvent: number;
  cacheHitRate: number;
  cacheHitRatePercent: string;
  topAgent: string | null;
  topModel: string | null;
  topSource: string | null;
  topSourceName: string | null;
  estimatedTotalCostUsd: number | null;
  cost: string;
};

export type TuiAgentRow = {
  agent: string;
  events: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  cost: string;
  topModel: string | null;
};

export type TuiOverviewRow = {
  metric: string;
  value: string | number | null;
  detail: string;
};

export type TuiActivityRow = {
  section: string;
  label: string;
  value: string | number | null;
  detail: string;
  level: number | null;
};

export type TuiData = {
  totals: SummaryTotals;
  overviewRows: TuiOverviewRow[];
  usageRows: TuiUsageRow[];
  minutelyBuckets: TuiMinutelyBucket[];
  insightsRows: TuiInsightRow[];
  trendRows: TuiTrendRow[];
  statsSummary: TuiStatsSummary;
  statsRows: TuiStatRow[];
  agentRows: TuiAgentRow[];
  sessions: SessionSummaryGroup[];
  sessionMetrics: SessionTimeMetrics;
  bySource: SummaryGroup[];
  bySourceName: SummaryGroup[];
  byModel: SummaryGroup[];
  byAgent: SummaryGroup[];
  byDay: SummaryGroup[];
  byHour: SummaryGroup[];
  byMonth: SummaryGroup[];
  unknownPricing: SummaryGroup[];
  pricingDiagnostics: PricingDiagnosticGroup[];
  budgets: BudgetEvaluation[];
  budgetStatusRows: BudgetStatusRow[];
  heatmapReport: HeatmapReport;
  activityRows: TuiActivityRow[];
  recentRuns: ScanRun[];
};

type TuiDataOptions = {
  readonly now?: Date;
  readonly heatmapMetric?: HeatmapReport['metric'];
  readonly heatmapYear?: number;
};

export class AggregatorService {
  private readonly budgetStatus = new BudgetStatusService();
  private readonly heatmap = new HeatmapService();

  summarize(events: UsageEvent[]): SummaryTotals {
    const totalEvents = events.length;
    const totalTokens = sum(events, 'totalTokens');
    const totalInputTokens = sum(events, 'inputTokens');
    const totalOutputTokens = sum(events, 'outputTokens');
    const totalCachedTokens = sum(events, 'cachedTokens');
    const costEvents = events.filter((event) => event.estimatedCostUsd !== null);
    const estimatedTotalCostUsd =
      events.length === 0
        ? null
        : costEvents.length === events.length
          ? round(sum(costEvents, 'estimatedCostUsd' as keyof UsageEvent))
          : costEvents.length > 0
            ? round(costEvents.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0))
            : null;
    const timestamps = events.map((event) => event.timestamp).sort();
    return {
      totalEvents,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens,
      estimatedTotalCostUsd,
      sourceCount: new Set(events.map((event) => event.source)).size,
      sourceNameCount: new Set(events.map((event) => event.sourceName)).size,
      modelCount: new Set(events.map((event) => event.model)).size,
      agentCount: new Set(events.map((event) => event.agent)).size,
      topSource: topBy(events, (event) => event.source),
      topSourceName: topBy(events, (event) => event.sourceName),
      topModel: topBy(events, (event) => event.model),
      topAgent: topBy(events, (event) => event.agent),
      dateRange: {
        start: timestamps[0] ?? null,
        end: timestamps.at(-1) ?? null
      }
    };
  }

  group(events: UsageEvent[], groupBy: GroupBy): SummaryGroup[] {
    const groups = new Map<string, UsageEvent[]>();
    for (const event of events) {
      const key = groupKey(event, groupBy);
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([key, groupEvents]) => ({
        key,
        provider: groupBy === 'model' ? groupEvents[0]?.provider : undefined,
        pricingSource: distinctNullableLabel(groupEvents, (event) => event.pricingSource),
        pricingConfidence: distinctNullableLabel(groupEvents, (event) => event.pricingConfidence),
        normalizedProvider: distinctNullableLabel(groupEvents, (event) => event.normalizedProvider),
        normalizedModel: distinctNullableLabel(groupEvents, (event) => event.normalizedModel),
        events: groupEvents.length,
        inputTokens: sum(groupEvents, 'inputTokens'),
        outputTokens: sum(groupEvents, 'outputTokens'),
        cachedTokens: sum(groupEvents, 'cachedTokens'),
        reasoningTokens: sum(groupEvents, 'reasoningTokens'),
        totalTokens: sum(groupEvents, 'totalTokens'),
        estimatedCostUsd: sumNullableCost(groupEvents),
        topModel: topBy(groupEvents, (event) => event.model),
        topAgent: topBy(groupEvents, (event) => event.agent)
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key));
  }

  unknownPricing(events: UsageEvent[]): SummaryGroup[] {
    return this.group(
      events.filter((event) => event.estimatedCostUsd === null),
      'model'
    );
  }

  pricingDiagnostics(
    events: UsageEvent[],
    options: PricingDiagnosticsOptions = {}
  ): PricingDiagnosticGroup[] {
    const lookupCache = options.lookupCache ?? [];
    return this.group(events, 'model')
      .map((group) => {
        const cacheEntry = findPricingCacheEntry(group, lookupCache);
        const cacheStatus = pricingCacheStatus(group, cacheEntry, Boolean(options.lookupWarning));
        return {
          ...group,
          matchedKey: safePricingLabel(cacheEntry?.matchedKey ?? null),
          cacheStatus,
          diagnosticStatus: pricingDiagnosticStatus(group, cacheStatus),
          recommendedAction: recommendedPricingAction(group, cacheStatus)
        };
      })
      .sort(
        (a, b) =>
          pricingDiagnosticPriority(a) - pricingDiagnosticPriority(b) ||
          b.totalTokens - a.totalTokens ||
          a.key.localeCompare(b.key)
      );
  }

  sessions(
    events: UsageEvent[],
    sessionIdleGapMs = DEFAULT_SESSION_IDLE_GAP_MS
  ): SessionSummaryGroup[] {
    const groups = groupEventsBySession(events);
    return Array.from(groups.entries())
      .map(([, groupEvents]) => {
        const sortedEvents = sortEventsByTimestamp(groupEvents);
        const timestamps = sortedEvents.map((event) => event.timestamp);
        const startedAt = timestamps[0] ?? '';
        const lastSeen = timestamps.at(-1) ?? '';
        const timestampMs = timestamps.map((timestamp) => Date.parse(timestamp));
        const wallDurationMs = intervalWallDurationMs(timestampMs);
        return {
          key: sortedEvents[0]?.sessionIdHash ?? '',
          source: sortedEvents[0]?.source ?? '',
          sessionIdHash: sortedEvents[0]?.sessionIdHash ?? '',
          events: sortedEvents.length,
          messageCount: sumMessageCount(sortedEvents),
          inputTokens: sum(sortedEvents, 'inputTokens'),
          outputTokens: sum(sortedEvents, 'outputTokens'),
          cachedTokens: sum(sortedEvents, 'cachedTokens'),
          reasoningTokens: sum(sortedEvents, 'reasoningTokens'),
          totalTokens: sum(sortedEvents, 'totalTokens'),
          estimatedCostUsd: sumIntervalCost(sortedEvents),
          startedAt,
          endedAt: lastSeen,
          lastSeen,
          wallDurationMs,
          activeDurationMs: intervalActiveDurationMs(timestampMs, sessionIdleGapMs)
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.totalTokens - a.totalTokens);
  }

  sessionTimeMetrics(
    events: UsageEvent[],
    sessionIdleGapMs = DEFAULT_SESSION_IDLE_GAP_MS
  ): SessionTimeMetrics {
    const intervals = this.sessions(events, sessionIdleGapMs);
    const totalWallDurationMs = intervals.reduce(
      (total, interval) => total + interval.wallDurationMs,
      0
    );
    const totalActiveDurationMs = intervals.reduce(
      (total, interval) => total + interval.activeDurationMs,
      0
    );
    const longestSessionMs = intervals.reduce(
      (longest, interval) => Math.max(longest, interval.wallDurationMs),
      0
    );

    const metrics = {
      sessionCount: intervals.length,
      totalWallDurationMs,
      totalActiveDurationMs,
      longestSessionMs,
      longestContinuousMs: longestContinuousMs(intervals, sessionIdleGapMs),
      maxConcurrentSessions: maxConcurrentSessions(intervals),
      eventsWithoutSession: events.filter((event) => !event.sessionIdHash).length
    };
    return metrics;
  }

  buildTuiData(
    events: UsageEvent[],
    recentRuns: ScanRun[],
    sessionIdleGapMs = DEFAULT_SESSION_IDLE_GAP_MS,
    budgets: BudgetEvaluation[] = [],
    pricingDiagnosticsOptions: PricingDiagnosticsOptions = {},
    options: TuiDataOptions = {}
  ): TuiData {
    const totals = this.summarize(events);
    const budgetStatusRows = this.budgetStatus.buildRows(budgets);
    const heatmapReport = this.heatmap.buildReport(events, {
      year: options.heatmapYear ?? (options.now ?? new Date()).getUTCFullYear(),
      metric: options.heatmapMetric ?? 'tokens'
    });
    return {
      totals,
      overviewRows: overviewRows(events, totals, budgetStatusRows, options.now ?? new Date()),
      usageRows: usageRows(events),
      minutelyBuckets: minutelyBuckets(events),
      insightsRows: buildTuiInsightRows(events, budgets),
      trendRows: buildTuiTrendRows(events, budgets),
      statsSummary: statsSummary(totals),
      statsRows: statsRows(totals),
      agentRows: agentRows(events),
      sessions: this.sessions(events, sessionIdleGapMs),
      sessionMetrics: this.sessionTimeMetrics(events, sessionIdleGapMs),
      bySource: this.group(events, 'source'),
      bySourceName: this.group(events, 'sourceName'),
      byModel: this.group(events, 'model'),
      byAgent: this.group(events, 'agent'),
      byDay: this.group(events, 'day'),
      byHour: this.group(events, 'hour'),
      byMonth: sortByKeyAscending(this.group(events, 'month')),
      unknownPricing: this.unknownPricing(events),
      pricingDiagnostics: this.pricingDiagnostics(events, pricingDiagnosticsOptions),
      budgets,
      budgetStatusRows,
      heatmapReport,
      activityRows: activityRows(heatmapReport),
      recentRuns
    };
  }
}

function overviewRows(
  events: UsageEvent[],
  totals: SummaryTotals,
  budgetRows: readonly BudgetStatusRow[],
  now: Date
): TuiOverviewRow[] {
  const today = summarizeWindow(events, localDayRange(now));
  const week = summarizeWindow(events, localWeekRange(now));
  const month = summarizeWindow(events, localMonthRange(now));
  const unknownEvents = events.filter((event) => event.estimatedCostUsd === null);
  return [
    { metric: 'Today', value: eventCountLabel(today.events), detail: windowDetail(today) },
    { metric: 'This Week', value: eventCountLabel(week.events), detail: windowDetail(week) },
    { metric: 'This Month', value: eventCountLabel(month.events), detail: windowDetail(month) },
    {
      metric: 'Budget',
      value: budgetOverviewStatus(budgetRows),
      detail: budgetOverviewDetail(budgetRows)
    },
    {
      metric: 'Unknown pricing',
      value: eventCountLabel(unknownEvents.length),
      detail: `${sum(unknownEvents, 'totalTokens')} tokens`
    },
    { metric: 'Top model', value: totals.topModel ?? 'none', detail: 'by total tokens' },
    { metric: 'Top source', value: totals.topSource ?? 'none', detail: 'by total tokens' },
    { metric: 'Top sourceName', value: totals.topSourceName ?? 'none', detail: 'by total tokens' }
  ];
}

function activityRows(report: HeatmapReport): TuiActivityRow[] {
  const activeDays = report.days.filter((day) => day.events > 0);
  const peakDay = [...activeDays].sort(
    (a, b) => b.value - a.value || a.date.localeCompare(b.date)
  )[0];
  const unknownWarning =
    report.totals.unknownCostEvents > 0 ? 'unknown cost events present' : 'none';
  return [
    {
      section: 'summary',
      label: 'year',
      value: report.year,
      detail: report.range.from,
      level: null
    },
    {
      section: 'summary',
      label: 'metric',
      value: report.metric,
      detail: report.range.to,
      level: null
    },
    {
      section: 'summary',
      label: 'active days',
      value: activeDays.length,
      detail: `${report.days.length} days in range`,
      level: null
    },
    {
      section: 'summary',
      label: 'peak day',
      value: peakDay?.date ?? 'none',
      detail: peakDay ? `${peakDay.value} ${report.metric}` : 'no usage',
      level: peakDay?.level ?? null
    },
    {
      section: 'summary',
      label: 'unknown cost warning',
      value: unknownWarning,
      detail: `${report.totals.unknownCostEvents} events`,
      level: null
    },
    ...report.legend.map((item) => ({
      section: 'density legend',
      label: item.label,
      value: item.symbol,
      detail: `level ${item.level}`,
      level: item.level
    }))
  ];
}

type TuiWindowSummary = {
  readonly events: number;
  readonly tokens: number;
  readonly cost: number | null;
};

type LocalWindow = {
  readonly from: Date;
  readonly toExclusive: Date;
};

function summarizeWindow(events: UsageEvent[], window: LocalWindow): TuiWindowSummary {
  const included = events.filter((event) => {
    const timestamp = Date.parse(event.timestamp);
    return timestamp >= window.from.getTime() && timestamp < window.toExclusive.getTime();
  });
  return {
    events: included.length,
    tokens: sum(included, 'totalTokens'),
    cost: sumNullableCost(included)
  };
}

function windowDetail(summary: TuiWindowSummary): string {
  return `${summary.tokens} tokens, ${formatUsd(summary.cost)}`;
}

function eventCountLabel(events: number): string {
  return `${events} ${events === 1 ? 'event' : 'events'}`;
}

function localDayRange(now: Date): LocalWindow {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { from, toExclusive: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
}

function localWeekRange(now: Date): LocalWindow {
  const dayOffset = (now.getDay() + 6) % 7;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, 0, 0, 0, 0);
  return { from, toExclusive: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
}

function localMonthRange(now: Date): LocalWindow {
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from, toExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0) };
}

function budgetOverviewStatus(rows: readonly BudgetStatusRow[]): string {
  if (rows.length === 0) return 'not configured';
  if (rows.some((row) => row.status === 'exceeded')) return 'exceeded';
  if (rows.some((row) => row.status === 'warning')) return 'warning';
  if (rows.some((row) => row.status === 'unknown')) return 'unknown';
  return 'ok';
}

function budgetOverviewDetail(rows: readonly BudgetStatusRow[]): string {
  if (rows.length === 0) return '0 thresholds';
  const exceeded = rows.filter((row) => row.status === 'exceeded').length;
  const warning = rows.filter((row) => row.status === 'warning').length;
  const unknown = rows.filter((row) => row.status === 'unknown').length;
  const ok = rows.filter((row) => row.status === 'ok').length;
  return `${ok} ok, ${warning} warning, ${exceeded} exceeded, ${unknown} unknown`;
}

function usageRows(events: UsageEvent[]): TuiUsageRow[] {
  return [...events]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.source.localeCompare(b.source))
    .map((event) => ({
      timestamp: event.timestamp,
      source: event.source,
      sourceName: event.sourceName,
      agent: event.agent,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cachedTokens: event.cachedTokens,
      cacheWriteTokens: event.cacheWriteTokens,
      reasoningTokens: event.reasoningTokens,
      totalTokens: event.totalTokens,
      estimatedCostUsd: event.estimatedCostUsd,
      cost: formatUsd(event.estimatedCostUsd)
    }));
}

function minutelyBuckets(events: UsageEvent[]): TuiMinutelyBucket[] {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const minute = localMinuteBucket(event.timestamp);
    const bucket = groups.get(minute) ?? [];
    bucket.push(event);
    groups.set(minute, bucket);
  }
  return Array.from(groups.entries())
    .map(([minute, bucketEvents]) => {
      const estimatedCostUsd = sumNullableCost(bucketEvents);
      return {
        minute,
        events: bucketEvents.length,
        inputTokens: sum(bucketEvents, 'inputTokens'),
        outputTokens: sum(bucketEvents, 'outputTokens'),
        cachedTokens: sum(bucketEvents, 'cachedTokens'),
        cacheWriteTokens: sum(bucketEvents, 'cacheWriteTokens'),
        reasoningTokens: sum(bucketEvents, 'reasoningTokens'),
        totalTokens: sum(bucketEvents, 'totalTokens'),
        estimatedCostUsd,
        cost: formatUsd(estimatedCostUsd)
      };
    })
    .sort((a, b) => a.minute.localeCompare(b.minute));
}

function statsSummary(totals: SummaryTotals): TuiStatsSummary {
  const averageTokensPerEvent =
    totals.totalEvents === 0 ? 0 : round(totals.totalTokens / totals.totalEvents);
  const cacheDenominator = totals.totalInputTokens + totals.totalCachedTokens;
  const cacheHitRate =
    cacheDenominator === 0 ? 0 : round(totals.totalCachedTokens / cacheDenominator);
  return {
    eventCount: totals.totalEvents,
    totalTokens: totals.totalTokens,
    averageTokensPerEvent,
    cacheHitRate,
    cacheHitRatePercent: `${(cacheHitRate * 100).toFixed(2)}%`,
    topAgent: totals.topAgent,
    topModel: totals.topModel,
    topSource: totals.topSource,
    topSourceName: totals.topSourceName,
    estimatedTotalCostUsd: totals.estimatedTotalCostUsd,
    cost: formatUsd(totals.estimatedTotalCostUsd)
  };
}

function statsRows(totals: SummaryTotals): TuiStatRow[] {
  const summary = statsSummary(totals);
  return [
    { stat: 'events', value: summary.eventCount },
    { stat: 'total tokens', value: summary.totalTokens },
    { stat: 'average tokens per event', value: summary.averageTokensPerEvent },
    { stat: 'cache hit rate', value: summary.cacheHitRatePercent },
    { stat: 'top agent', value: summary.topAgent ?? 'none' },
    { stat: 'top model', value: summary.topModel ?? 'none' },
    { stat: 'top source', value: summary.topSource ?? 'none' },
    { stat: 'top sourceName', value: summary.topSourceName ?? 'none' },
    { stat: 'estimated cost', value: summary.cost }
  ];
}

function agentRows(events: UsageEvent[]): TuiAgentRow[] {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const agentEvents = groups.get(event.agent) ?? [];
    agentEvents.push(event);
    groups.set(event.agent, agentEvents);
  }
  return Array.from(groups.entries())
    .map(([agent, agentEvents]) => {
      const estimatedCostUsd = sumNullableCost(agentEvents);
      return {
        agent,
        events: agentEvents.length,
        inputTokens: sum(agentEvents, 'inputTokens'),
        outputTokens: sum(agentEvents, 'outputTokens'),
        cachedTokens: sum(agentEvents, 'cachedTokens'),
        cacheWriteTokens: sum(agentEvents, 'cacheWriteTokens'),
        reasoningTokens: sum(agentEvents, 'reasoningTokens'),
        totalTokens: sum(agentEvents, 'totalTokens'),
        estimatedCostUsd,
        cost: formatUsd(estimatedCostUsd),
        topModel: topBy(agentEvents, (event) => event.model)
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens || a.agent.localeCompare(b.agent));
}

function findPricingCacheEntry(
  group: SummaryGroup,
  lookupCache: readonly PricingLookupCacheEntry[]
): PricingLookupCacheEntry | null {
  const providerCandidates = new Set(
    [group.normalizedProvider, group.provider].filter((value): value is string => Boolean(value))
  );
  const modelCandidates = new Set(
    [group.normalizedModel, group.key].filter((value): value is string => Boolean(value))
  );
  return (
    lookupCache.find(
      (entry) => providerCandidates.has(entry.provider) && modelCandidates.has(entry.model)
    ) ?? null
  );
}

function pricingCacheStatus(
  group: SummaryGroup,
  cacheEntry: PricingLookupCacheEntry | null,
  lookupWarning: boolean
): PricingCacheStatus {
  if (cacheEntry?.noMatch) return 'negative-cache';
  if (lookupWarning && group.estimatedCostUsd === null) return 'network-fallback';
  if (cacheEntry) return 'matched-cache';
  return 'not-cached';
}

function pricingDiagnosticStatus(
  group: SummaryGroup,
  cacheStatus: PricingCacheStatus
): PricingDiagnosticStatus {
  if (cacheStatus === 'negative-cache') return 'negative-cache';
  if (cacheStatus === 'network-fallback') return 'network-fallback';
  switch (group.pricingConfidence ?? 'none') {
    case 'exact':
      return 'exact-match';
    case 'alias':
      return 'alias-match';
    case 'provider-prefix':
      return 'provider-prefix-match';
    case 'cursor-override':
      return 'cursor-override';
    case 'fuzzy':
      return 'fuzzy-match';
    default:
      return 'unresolved';
  }
}

function recommendedPricingAction(group: SummaryGroup, cacheStatus: PricingCacheStatus): string {
  if (cacheStatus === 'network-fallback') return 'retry pricing lookup';
  if (cacheStatus === 'negative-cache') return 'add custom price';
  switch (group.pricingConfidence ?? 'none') {
    case 'fuzzy':
      return 'confirm fuzzy match';
    case 'alias':
    case 'provider-prefix':
    case 'cursor-override':
      return 'verify mapped price';
    case 'none':
      return 'add custom price';
    default:
      return 'no action';
  }
}

function pricingDiagnosticPriority(group: PricingDiagnosticGroup): number {
  switch (group.diagnosticStatus) {
    case 'network-fallback':
      return 0;
    case 'negative-cache':
      return 1;
    case 'unresolved':
      return 2;
    case 'fuzzy-match':
      return 3;
    case 'alias-match':
    case 'provider-prefix-match':
    case 'cursor-override':
      return 4;
    default:
      return 5;
  }
}

function safePricingLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (
    trimmed.length < 1 ||
    trimmed.length > 160 ||
    !/^[a-z0-9][a-z0-9_.:/@+-]*$/.test(trimmed) ||
    containsUnsafePrivacyShape(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function groupKey(event: UsageEvent, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'model':
      return event.model;
    case 'agent':
      return event.agent;
    case 'source':
      return event.source;
    case 'sourceName':
      return event.sourceName;
    case 'project':
      return projectKeyForEvent(event);
    case 'day':
      return localDayBucket(event.timestamp);
    case 'hour':
      return localHourBucket(event.timestamp);
    case 'month':
      return localMonthBucket(event.timestamp);
  }
}

function sum(events: UsageEvent[], field: keyof UsageEvent): number {
  return events.reduce((total, event) => {
    const value = event[field];
    return typeof value === 'number' ? total + value : total;
  }, 0);
}

function sumNullableCost(events: UsageEvent[]): number | null {
  const known = events.filter((event) => event.estimatedCostUsd !== null);
  if (known.length === 0) {
    return null;
  }
  return round(known.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0));
}

function sumIntervalCost(events: UsageEvent[]): number | null {
  if (events.some((event) => event.estimatedCostUsd === null)) {
    return null;
  }
  return round(events.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0));
}

function sumMessageCount(events: UsageEvent[]): number {
  return events.reduce((total, event) => total + Math.max(event.messageCount ?? 1, 1), 0);
}

function topBy(events: UsageEvent[], selector: (event: UsageEvent) => string): string | null {
  const totals = new Map<string, number>();
  for (const event of events) {
    const key = selector(event);
    totals.set(key, (totals.get(key) ?? 0) + event.totalTokens);
  }
  return (
    Array.from(totals.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    null
  );
}

function distinctNullableLabel(
  events: UsageEvent[],
  selector: (event: UsageEvent) => string | null
): string | null {
  const values = new Set(events.map(selector).filter((value): value is string => value !== null));
  if (values.size === 0) return null;
  if (values.size === 1) return Array.from(values)[0] ?? null;
  return 'mixed';
}

function sortByKeyAscending(groups: SummaryGroup[]): SummaryGroup[] {
  return [...groups].sort((a, b) => a.key.localeCompare(b.key));
}

function groupEventsBySession(events: UsageEvent[]): Map<string, UsageEvent[]> {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    if (!event.sessionIdHash) {
      continue;
    }
    const key = `${event.source}\u0000${event.sessionIdHash}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return groups;
}

function sortEventsByTimestamp(events: UsageEvent[]): UsageEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function intervalWallDurationMs(timestamps: number[]): number {
  if (timestamps.length < 2) {
    return 0;
  }
  return timestamps.at(-1)! - timestamps[0]!;
}

function intervalActiveDurationMs(timestamps: number[], sessionIdleGapMs: number): number {
  let activeDurationMs = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    const gapMs = timestamps[index]! - timestamps[index - 1]!;
    if (gapMs <= sessionIdleGapMs) {
      activeDurationMs += gapMs;
    }
  }
  return activeDurationMs;
}

function longestContinuousMs(intervals: SessionSummaryGroup[], sessionIdleGapMs: number): number {
  const windows = intervals
    .filter((interval) => interval.activeDurationMs > 0)
    .map((interval) => ({
      start: Date.parse(interval.startedAt),
      end: Date.parse(interval.startedAt) + interval.activeDurationMs
    }))
    .sort((a, b) => a.start - b.start);

  const first = windows[0];
  if (!first) {
    return 0;
  }

  let longest = 0;
  let mergedStart = first.start;
  let mergedEnd = first.end;

  for (const window of windows.slice(1)) {
    if (window.start <= mergedEnd + sessionIdleGapMs) {
      mergedEnd = Math.max(mergedEnd, window.end);
    } else {
      longest = Math.max(longest, mergedEnd - mergedStart);
      mergedStart = window.start;
      mergedEnd = window.end;
    }
  }

  return Math.max(longest, mergedEnd - mergedStart);
}

function maxConcurrentSessions(intervals: SessionSummaryGroup[]): number {
  const points = intervals.flatMap((interval) => {
    const start = Date.parse(interval.startedAt);
    const end = Date.parse(interval.endedAt);
    return [
      { timestamp: start, delta: 1 },
      { timestamp: end <= start ? start + 1 : end, delta: -1 }
    ];
  });
  points.sort((a, b) => a.timestamp - b.timestamp || b.delta - a.delta);

  let current = 0;
  let peak = 0;
  for (const point of points) {
    current += point.delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

function round(value: number): number {
  return Number(value.toFixed(8));
}
