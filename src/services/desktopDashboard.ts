import type { PricingModelsRepository } from '../db/repositories/pricingModels.js';
import type { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import {
  desktopDashboardSchema,
  type DesktopDashboard,
  type DesktopDashboardFilters
} from '../desktop/shared/contracts.js';
import { nowIso } from '../utils/time.js';
import { AggregatorService } from './aggregator.js';
import type { BudgetService } from './budgetService.js';
import {
  toDashboardBudgetDiagnostics,
  toDashboardPricingDiagnostics
} from './desktopDiagnostics.js';
import { buildDesktopDiagnosticsHub } from './desktopDiagnosticsHub.js';
import { groupEventsByDay, sumNumericEventField } from './desktopDashboardUtils.js';
import {
  filterEvents,
  strictCostFields,
  toDashboardBreakdown,
  toDashboardProjectGroup,
  toDashboardScanRun,
  toDashboardSessionInterval,
  toDesktopInsights,
  toDesktopTrends
} from './desktopDashboardMappers.js';
import { InsightsService } from './insightsService.js';
import { ReportService } from './reportService.js';
import { groupEventsByPublicProject, projectAttributionDiagnostics } from './projectAttribution.js';
import { TrendService } from './trendService.js';

export type BuildDesktopDashboardOptions = {
  budgetEvaluationDate?: Date;
  filters?: DesktopDashboardFilters;
  recentScanLimit?: number;
};

export type DesktopDashboardDependencies = {
  readonly aggregator?: AggregatorService;
  readonly budget?: BudgetService;
  readonly insights?: InsightsService;
  readonly pricingModels?: PricingModelsRepository;
  readonly reports?: ReportService;
  readonly scanRuns: ScanRunsRepository;
  readonly trend?: TrendService;
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
  private readonly insights: InsightsService;
  private readonly pricingModels: PricingModelsRepository | undefined;
  private readonly reports: ReportService;
  private readonly scanRuns: ScanRunsRepository;
  private readonly trend: TrendService;
  private readonly usageEvents: UsageEventsRepository;

  constructor(dependencies: DesktopDashboardDependencies) {
    this.aggregator = dependencies.aggregator ?? new AggregatorService();
    this.budget = dependencies.budget;
    this.insights = dependencies.insights ?? new InsightsService();
    this.pricingModels = dependencies.pricingModels;
    this.reports = dependencies.reports ?? new ReportService();
    this.scanRuns = dependencies.scanRuns;
    this.trend = dependencies.trend ?? new TrendService();
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
    const strictTotals = strictCostFields(filteredEvents);
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
    const budgetEvaluations = this.budget?.evaluateCurrentMonth(options.budgetEvaluationDate) ?? [];
    const budgetDiagnostics = toDashboardBudgetDiagnostics(budgetEvaluations);
    const projectGroups = groupEventsByPublicProject(filteredEvents).map((group) =>
      toDashboardProjectGroup(group, filteredEvents)
    );
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
        ...strictTotals,
        sources: totals.sourceCount,
        sourceNames: totals.sourceNameCount,
        models: totals.modelCount,
        agents: totals.agentCount,
        unknownCostEvents: strictTotals.unknownCostEvents,
        unknownCostTokens: strictTotals.unknownCostTokens
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
          ...strictCostFields(bucketEvents)
        };
      }),
      costSeries: costReport.series.map((point) => ({
        key: point.key,
        ...strictCostFields(eventsByDay.get(point.key) ?? [])
      })),
      byModel: this.aggregator.group(filteredEvents, 'model').map((group) =>
        toDashboardBreakdown(
          group,
          filteredEvents.filter((event) => event.model === group.key)
        )
      ),
      byAgent: this.aggregator.group(filteredEvents, 'agent').map((group) =>
        toDashboardBreakdown(
          group,
          filteredEvents.filter((event) => event.agent === group.key)
        )
      ),
      bySource: this.aggregator.group(filteredEvents, 'source').map((group) =>
        toDashboardBreakdown(
          group,
          filteredEvents.filter((event) => event.source === group.key)
        )
      ),
      bySourceName: this.aggregator.group(filteredEvents, 'sourceName').map((group) =>
        toDashboardBreakdown(
          group,
          filteredEvents.filter((event) => event.sourceName === group.key)
        )
      ),
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
      sessionIntervals: this.aggregator
        .sessions(filteredEvents)
        .map((group) => toDashboardSessionInterval(group, filteredEvents)),
      insights: toDesktopInsights(
        this.insights.build(filteredEvents, { window: '7d' }, budgetEvaluations)
      ),
      trends: toDesktopTrends([
        this.trend.build(events, { budgets: budgetEvaluations, window: '7d' }),
        this.trend.build(events, { budgets: budgetEvaluations, window: '30d' })
      ]),
      privacy: { sanitized: true }
    };

    return desktopDashboardSchema.parse(report);
  }
}
