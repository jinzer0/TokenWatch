import type {
  DesktopDashboard,
  DesktopDashboardBreakdown,
  DesktopDashboardFilters,
  DesktopDashboardInsights,
  DesktopDashboardProjectGroup,
  DesktopDashboardScanRun,
  DesktopDashboardTrends
} from '../desktop/shared/contracts.js';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import type { SessionSummaryGroup, SummaryGroup } from './aggregator.js';
import type { InsightsReport, TrendReport } from './insightsContracts.js';
import { projectKeyForEvent, type PublicProjectGroup } from './projectAttribution.js';

type StrictCostFields = {
  readonly estimatedCostUsd: number | null;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
};

type TrendCard = DesktopDashboardTrends['windows'][number]['cards'][number];

export function filterEvents(
  events: readonly UsageEvent[],
  filters: DesktopDashboardFilters
): UsageEvent[] {
  const fromTime = filters.fromTimestamp ? Date.parse(filters.fromTimestamp) : null;
  const toTime = filters.toTimestamp ? Date.parse(filters.toTimestamp) : null;
  return events.filter((event) => {
    const time = Date.parse(event.timestamp);
    return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
  });
}

export function strictCostFields(events: readonly UsageEvent[]): StrictCostFields {
  const knownEvents = events.filter((event) => event.estimatedCostUsd !== null);
  const unknownEvents = events.filter((event) => event.estimatedCostUsd === null);
  const knownEstimatedCostUsd =
    knownEvents.length > 0
      ? roundMetric(knownEvents.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0))
      : null;
  return {
    estimatedCostUsd:
      events.length === 0 || unknownEvents.length > 0 ? null : knownEstimatedCostUsd,
    knownEstimatedCostUsd,
    unknownCostEvents: unknownEvents.length,
    unknownCostTokens: unknownEvents.reduce((total, event) => total + event.totalTokens, 0)
  };
}

export function toDashboardBreakdown(
  group: SummaryGroup,
  events: readonly UsageEvent[]
): DesktopDashboardBreakdown {
  return {
    key: group.key,
    events: group.events,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    cachedTokens: group.cachedTokens,
    reasoningTokens: group.reasoningTokens,
    totalTokens: group.totalTokens,
    ...strictCostFields(events),
    topModel: group.topModel ?? null,
    topAgent: group.topAgent ?? null
  };
}

export function toDashboardProjectGroup(
  group: PublicProjectGroup,
  events: readonly UsageEvent[]
): DesktopDashboardProjectGroup {
  return {
    projectKey: group.projectKey,
    events: group.events,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    totalTokens: group.totalTokens,
    ...strictCostFields(events.filter((event) => projectKeyForEvent(event) === group.projectKey))
  };
}

export function toDashboardScanRun(run: ScanRun): DesktopDashboardScanRun {
  return {
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    sourceName: run.sourceName,
    parserName: run.parserName,
    pathKind: run.pathKind,
    status: run.status,
    discoveredFiles: run.discoveredFiles,
    parsedEvents: run.parsedEvents,
    insertedEvents: run.insertedEvents,
    duplicateEvents: run.duplicateEvents,
    conflictEvents: run.conflictEvents,
    skippedRecords: run.skippedRecords,
    rejectedRecords: run.rejectedRecords,
    errorRecords: run.errorRecords,
    warningCodes: run.warningCodes,
    errorCode: run.errorCode
  };
}

export function toDashboardSessionInterval(
  group: SessionSummaryGroup,
  events: readonly UsageEvent[]
): DesktopDashboard['sessionIntervals'][number] {
  return {
    source: group.source,
    sessionIdHash: group.sessionIdHash,
    startedAt: group.startedAt,
    endedAt: group.endedAt,
    lastSeen: group.lastSeen,
    events: group.events,
    messageCount: group.messageCount,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    cachedTokens: group.cachedTokens,
    reasoningTokens: group.reasoningTokens,
    totalTokens: group.totalTokens,
    ...strictCostFields(
      events.filter(
        (event) => event.source === group.source && event.sessionIdHash === group.sessionIdHash
      )
    ),
    activeDurationMs: group.activeDurationMs,
    wallDurationMs: group.wallDurationMs
  };
}

export function toDesktopInsights(report: InsightsReport): DesktopDashboardInsights {
  return {
    window: report.window,
    range: report.range,
    cards: {
      totals: report.totals,
      cacheHitRatio: report.cacheHitRatio,
      unknownPricingImpact: report.unknownPricingImpact,
      reasoningToOutputRatio: report.reasoningToOutputRatio,
      budgetPressure: report.budgetPressure
    },
    topRows: report.topRows,
    costDriverCandidates: report.costDriverCandidates,
    warnings: report.warnings,
    confidence: report.confidence,
    privacy: report.privacy
  };
}

export function toDesktopTrends(reports: readonly TrendReport[]): DesktopDashboardTrends {
  return {
    trendScope: 'all-events-rolling',
    label: 'all-events rolling trend',
    windows: reports.map((report) => ({
      window: report.window,
      trendScope: report.trendScope,
      range: report.range,
      totals: report.totals,
      cacheHitRatio: report.cacheHitRatio,
      budgetPressure: report.budgetPressure,
      cards: report.rows
        .filter((row) => row.category === 'total')
        .map((row): TrendCard => toTrendCard(report, row)),
      chartRows: report.rows,
      warnings: report.warnings,
      confidence: report.confidence,
      privacy: report.privacy
    })),
    privacy: { sanitized: true }
  };
}

function toTrendCard(report: TrendReport, row: TrendReport['rows'][number]): TrendCard {
  return {
    window: report.window,
    metric: row.metric,
    trendScope: report.trendScope,
    label: 'all-events rolling trend',
    current: row.current,
    previous: row.previous,
    deltaPercent: row.deltaPercent,
    direction: row.direction
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
