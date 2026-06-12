import type { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import {
  desktopDashboardSchema,
  type DesktopDashboard,
  type DesktopDashboardBreakdown,
  type DesktopDashboardScanRun
} from '../desktop/shared/contracts.js';
import { localDayBucket, nowIso } from '../utils/time.js';
import { AggregatorService, type SummaryGroup } from './aggregator.js';
import { ReportService } from './reportService.js';

export type BuildDesktopDashboardOptions = {
  recentScanLimit?: number;
};

export class DesktopDashboardService {
  constructor(
    private readonly usageEvents: UsageEventsRepository,
    private readonly scanRuns: ScanRunsRepository,
    private readonly aggregator = new AggregatorService(),
    private readonly reports = new ReportService()
  ) {}

  buildDashboard(options: BuildDesktopDashboardOptions = {}): DesktopDashboard {
    const events = this.usageEvents.listAll();
    const recentScanRuns = this.scanRuns.listRecent(options.recentScanLimit ?? 5);
    return this.buildDashboardFromEvents(events, recentScanRuns);
  }

  buildDashboardFromEvents(events: UsageEvent[], recentScanRuns: ScanRun[] = []): DesktopDashboard {
    const totals = this.aggregator.summarize(events);
    const costReport = this.reports.buildGraphReport(events, { bucket: 'day', metric: 'cost' });
    const eventsByDay = groupEventsByDay(events);
    const unknownCostEvents = events.filter((event) => event.estimatedCostUsd === null).length;
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
          inputTokens: sum(bucketEvents, 'inputTokens'),
          outputTokens: sum(bucketEvents, 'outputTokens'),
          cachedTokens: sum(bucketEvents, 'cachedTokens'),
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
      byModel: this.aggregator.group(events, 'model').map(toDashboardBreakdown),
      byAgent: this.aggregator.group(events, 'agent').map(toDashboardBreakdown),
      bySource: this.aggregator.group(events, 'source').map(toDashboardBreakdown),
      bySourceName: this.aggregator.group(events, 'sourceName').map(toDashboardBreakdown),
      unknownPricingCount: unknownCostEvents,
      recentScanRuns: recentScanRuns.map(toDashboardScanRun),
      privacy: { sanitized: true }
    };

    return desktopDashboardSchema.parse(report);
  }
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

function groupEventsByDay(events: UsageEvent[]): Map<string, UsageEvent[]> {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const key = localDayBucket(event.timestamp);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return groups;
}

function sum(events: UsageEvent[], field: keyof UsageEvent): number {
  return events.reduce((total, event) => {
    const value = event[field];
    return typeof value === 'number' ? total + value : total;
  }, 0);
}
