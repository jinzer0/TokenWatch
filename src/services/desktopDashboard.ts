import type { PricingModelsRepository } from '../db/repositories/pricingModels.js';
import type { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import {
  desktopDashboardSchema,
  type DesktopDashboard,
  type DesktopDashboardBreakdown,
  type DesktopDashboardFilters,
  type DesktopDashboardProjectGroup,
  type DesktopDashboardScanRun
} from '../desktop/shared/contracts.js';
import { nowIso } from '../utils/time.js';
import { AggregatorService, type SessionSummaryGroup, type SummaryGroup } from './aggregator.js';
import type { BudgetService } from './budgetService.js';
import {
  toDashboardBudgetDiagnostics,
  toDashboardPricingDiagnostics
} from './desktopDiagnostics.js';
import { buildDesktopDiagnosticsHub } from './desktopDiagnosticsHub.js';
import { groupEventsByDay, sumNumericEventField } from './desktopDashboardUtils.js';
import { ReportService } from './reportService.js';
import {
  groupEventsByPublicProject,
  projectAttributionDiagnostics,
  type PublicProjectGroup
} from './projectAttribution.js';

export type BuildDesktopDashboardOptions = {
  budgetEvaluationDate?: Date;
  filters?: DesktopDashboardFilters;
  recentScanLimit?: number;
};

export type DesktopDashboardDependencies = {
  readonly aggregator?: AggregatorService;
  readonly budget?: BudgetService;
  readonly pricingModels?: PricingModelsRepository;
  readonly reports?: ReportService;
  readonly scanRuns: ScanRunsRepository;
  readonly usageEvents: UsageEventsRepository;
};

const DEFAULT_FILTERS: DesktopDashboardFilters = {
  from: null,
  to: null,
  fromTimestamp: null,
  toTimestamp: null
};

export class DesktopDashboardService {
  private readonly aggregator: AggregatorService;
  private readonly budget: BudgetService | undefined;
  private readonly pricingModels: PricingModelsRepository | undefined;
  private readonly reports: ReportService;
  private readonly scanRuns: ScanRunsRepository;
  private readonly usageEvents: UsageEventsRepository;

  constructor(dependencies: DesktopDashboardDependencies) {
    this.aggregator = dependencies.aggregator ?? new AggregatorService();
    this.budget = dependencies.budget;
    this.pricingModels = dependencies.pricingModels;
    this.reports = dependencies.reports ?? new ReportService();
    this.scanRuns = dependencies.scanRuns;
    this.usageEvents = dependencies.usageEvents;
  }

  buildDashboard(options: BuildDesktopDashboardOptions = {}): DesktopDashboard {
    const events = this.usageEvents.listAll();
    const recentScanRuns = this.scanRuns.listRecent(options.recentScanLimit ?? 5);
    return this.buildDashboardFromEvents(events, recentScanRuns, options.filters, options);
  }

  buildDashboardFromEvents(
    events: UsageEvent[],
    recentScanRuns: ScanRun[] = [],
    filters: DesktopDashboardFilters = DEFAULT_FILTERS,
    options: Pick<BuildDesktopDashboardOptions, 'budgetEvaluationDate'> = {}
  ): DesktopDashboard {
    const filteredEvents = filterEvents(events, filters);
    const totals = this.aggregator.summarize(filteredEvents);
    const costReport = this.reports.buildGraphReport(filteredEvents, {
      bucket: 'day',
      metric: 'cost'
    });
    const eventsByDay = groupEventsByDay(filteredEvents);
    const unknownCostEvents = filteredEvents.filter(
      (event) => event.estimatedCostUsd === null
    ).length;
    const pricingDiagnostics = this.aggregator.pricingDiagnostics(filteredEvents, {
      lookupCache: this.pricingModels?.listLookupCache() ?? []
    });
    const budgetDiagnostics = toDashboardBudgetDiagnostics(
      this.budget?.evaluateCurrentMonth(options.budgetEvaluationDate) ?? []
    );
    const projectGroups = groupEventsByPublicProject(filteredEvents).map(toDashboardProjectGroup);
    const projectDiagnostics = projectAttributionDiagnostics(filteredEvents);
    const dashboardPricingDiagnostics = toDashboardPricingDiagnostics(
      pricingDiagnostics,
      filteredEvents
    );
    const dashboardScanRuns = recentScanRuns.map(toDashboardScanRun);
    const sessionMetrics = this.aggregator.sessionTimeMetrics(filteredEvents);
    const report = {
      version: 1,
      kind: 'desktop-dashboard',
      generatedAt: nowIso(),
      totals: {
        events: totals.totalEvents,
        tokens: totals.totalTokens,
        inputTokens: totals.totalInputTokens,
        outputTokens: totals.totalOutputTokens,
        cachedTokens: totals.totalCachedTokens,
        estimatedCostUsd: totals.estimatedTotalCostUsd,
        sources: totals.sourceCount,
        sourceNames: totals.sourceNameCount,
        models: totals.modelCount,
        agents: totals.agentCount,
        unknownCostEvents
      },
      dateRange: totals.dateRange,
      top: {
        model: totals.topModel,
        agent: totals.topAgent,
        source: totals.topSource,
        sourceName: totals.topSourceName
      },
      usageSeries: costReport.series.map((point) => {
        const bucketEvents = eventsByDay.get(point.key) ?? [];
        return {
          key: point.key,
          events: point.events,
          tokens: point.tokens,
          inputTokens: sumNumericEventField(bucketEvents, 'inputTokens'),
          outputTokens: sumNumericEventField(bucketEvents, 'outputTokens'),
          cachedTokens: sumNumericEventField(bucketEvents, 'cachedTokens'),
          estimatedCostUsd: point.estimatedCostUsd,
          unknownCostEvents: bucketEvents.filter((event) => event.estimatedCostUsd === null).length
        };
      }),
      costSeries: costReport.series.map((point) => ({
        key: point.key,
        estimatedCostUsd: point.estimatedCostUsd,
        unknownCostEvents: (eventsByDay.get(point.key) ?? []).filter(
          (event) => event.estimatedCostUsd === null
        ).length
      })),
      byModel: this.aggregator.group(filteredEvents, 'model').map(toDashboardBreakdown),
      byAgent: this.aggregator.group(filteredEvents, 'agent').map(toDashboardBreakdown),
      bySource: this.aggregator.group(filteredEvents, 'source').map(toDashboardBreakdown),
      bySourceName: this.aggregator.group(filteredEvents, 'sourceName').map(toDashboardBreakdown),
      projectGroups,
      unknownPricingCount: unknownCostEvents,
      budgetDiagnostics,
      pricingDiagnostics: dashboardPricingDiagnostics,
      recentScanRuns: dashboardScanRuns,
      diagnosticsHub: buildDesktopDiagnosticsHub({
        eventCount: filteredEvents.length,
        scanRunCount: recentScanRuns.length,
        recentScanRuns: dashboardScanRuns,
        budgetDiagnostics,
        pricingDiagnostics: dashboardPricingDiagnostics,
        projectGroups,
        projectDiagnostics,
        sessionMetrics
      }),
      filters: { from: filters.from, to: filters.to },
      sessionMetrics,
      sessionIntervals: this.aggregator.sessions(filteredEvents).map(toDashboardSessionInterval),
      privacy: { sanitized: true }
    };

    return desktopDashboardSchema.parse(report);
  }
}

function filterEvents(events: UsageEvent[], filters: DesktopDashboardFilters): UsageEvent[] {
  const fromTime = filters.fromTimestamp ? Date.parse(filters.fromTimestamp) : null;
  const toTime = filters.toTimestamp ? Date.parse(filters.toTimestamp) : null;
  return events.filter((event) => {
    const time = Date.parse(event.timestamp);
    return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
  });
}

function toDashboardBreakdown(group: SummaryGroup): DesktopDashboardBreakdown {
  return {
    key: group.key,
    events: group.events,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    cachedTokens: group.cachedTokens,
    reasoningTokens: group.reasoningTokens,
    totalTokens: group.totalTokens,
    estimatedCostUsd: group.estimatedCostUsd,
    topModel: group.topModel ?? null,
    topAgent: group.topAgent ?? null
  };
}

function toDashboardProjectGroup(group: PublicProjectGroup): DesktopDashboardProjectGroup {
  return {
    projectKey: group.projectKey,
    events: group.events,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    totalTokens: group.totalTokens,
    estimatedCostUsd: group.estimatedCostUsd
  };
}

function toDashboardScanRun(run: ScanRun): DesktopDashboardScanRun {
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

function toDashboardSessionInterval(
  group: SessionSummaryGroup
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
    estimatedCostUsd: group.estimatedCostUsd,
    activeDurationMs: group.activeDurationMs,
    wallDurationMs: group.wallDurationMs
  };
}
