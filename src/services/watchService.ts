import type { SourceType, UsageEvent } from '../models/usageEvent.js';
import { AggregatorService } from './aggregator.js';
import type { BudgetEvaluation } from './budgetService.js';
import { BudgetStatusService } from './budgetStatusService.js';
import type { WatchTickReport } from './reportContracts.js';
import { watchTickReportSchema } from './reportContracts.js';
import { buildTopLabels } from './statuslineHelpers.js';

const minimumIntervalMs = 5_000;

export type BuildWatchTickOptions = {
  readonly now?: Date;
  readonly intervalMs: number;
  readonly windowMs: number;
  readonly previousTickAt?: Date;
  readonly source?: SourceType | readonly SourceType[];
  readonly sourceName?: string | readonly string[];
  readonly budgets?: readonly BudgetEvaluation[];
};

type WatchTimeRange = {
  readonly startExclusiveMs: number;
  readonly endInclusiveMs: number;
};

export class WatchServiceError extends Error {
  readonly name = 'WatchServiceError';

  constructor(readonly code: 'invalid_report_option') {
    super(code);
  }
}

export class WatchService {
  private readonly aggregator = new AggregatorService();
  private readonly budgetStatus = new BudgetStatusService();

  buildTick(events: readonly UsageEvent[], options: BuildWatchTickOptions): WatchTickReport {
    const now = options.now ?? new Date();
    const nowMs = now.getTime();
    const intervalMs = validIntervalMs(options.intervalMs);
    const windowMs = validWindowMs(options.windowMs);
    const filters = buildFilters(options);
    const windowRange = { startExclusiveMs: nowMs - windowMs, endInclusiveMs: nowMs };
    const windowEvents = events.filter((event) => isIncludedEvent(event, windowRange, filters));
    const previousTickAt = options.previousTickAt;
    const deltaEvents =
      previousTickAt === undefined
        ? windowEvents
        : events.filter((event) =>
            isIncludedEvent(
              event,
              { startExclusiveMs: previousTickAt.getTime(), endInclusiveMs: nowMs },
              filters
            )
          );
    const summary = this.aggregator.summarize([...windowEvents]);
    const window = buildDelta(windowEvents);
    const delta = options.previousTickAt === undefined ? window : buildDelta(deltaEvents);
    const dto = {
      version: 2,
      kind: 'watch_tick',
      timestamp: now.toISOString(),
      intervalMs,
      windowMs,
      filters,
      delta,
      window,
      velocity: buildVelocity(window, windowMs),
      top: {
        ...buildTopLabels(windowEvents, summary.topModel, summary.topSourceName),
        source: summary.topSource ?? 'unknown',
        agent: summary.topAgent ?? 'unknown'
      },
      budgets: buildBudgetSummary(this.budgetStatus, options.budgets ?? [], options.sourceName),
      privacy: { sanitized: true }
    } satisfies WatchTickReport;
    return watchTickReportSchema.parse(dto);
  }
}

export function parseWatchInterval(value: string): number {
  return validIntervalMs(parseWatchDuration(value));
}

export function parseWatchWindow(value = '10m'): number {
  return validWindowMs(parseWatchDuration(value));
}

function parseWatchDuration(value: string): number {
  const match = /^([1-9][0-9]*)([sm]?)$/.exec(value);
  if (!match) {
    throw new WatchServiceError('invalid_report_option');
  }
  const amount = Number(match[1]);
  const unit = match[2];
  return unit === 'm' ? amount * 60_000 : unit === 's' ? amount * 1_000 : amount;
}

function validIntervalMs(intervalMs: number): number {
  if (!Number.isInteger(intervalMs) || intervalMs < minimumIntervalMs) {
    throw new WatchServiceError('invalid_report_option');
  }
  return intervalMs;
}

function validWindowMs(windowMs: number): number {
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new WatchServiceError('invalid_report_option');
  }
  return windowMs;
}

function buildFilters(options: BuildWatchTickOptions): WatchTickReport['filters'] {
  return {
    source: toArray(options.source),
    sourceName: toArray(options.sourceName)
  };
}

function toArray<T extends string>(value: T | readonly T[] | undefined): T[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

function isIncludedEvent(
  event: UsageEvent,
  range: WatchTimeRange,
  filters: WatchTickReport['filters']
): boolean {
  const timestampMs = Date.parse(event.timestamp);
  return (
    timestampMs > range.startExclusiveMs &&
    timestampMs <= range.endInclusiveMs &&
    (filters.source.length === 0 || filters.source.includes(event.source)) &&
    (filters.sourceName.length === 0 || filters.sourceName.includes(event.sourceName))
  );
}

function matchesOne<T extends string>(value: T, filter: T | readonly T[]): boolean {
  return Array.isArray(filter) ? filter.includes(value) : value === filter;
}

function buildDelta(events: readonly UsageEvent[]): WatchTickReport['delta'] {
  const unknownCostEvents = events.filter((event) => event.estimatedCostUsd === null);
  return {
    events: events.length,
    totalTokens: sum(events, 'totalTokens'),
    inputTokens: sum(events, 'inputTokens'),
    outputTokens: sum(events, 'outputTokens'),
    cachedTokens: sum(events, 'cachedTokens'),
    reasoningTokens: sum(events, 'reasoningTokens'),
    estimatedCostUsd: allKnownCost(events),
    unknownCostEvents: unknownCostEvents.length,
    unknownCostTokens: sum(unknownCostEvents, 'totalTokens')
  };
}

function buildVelocity(
  usage: WatchTickReport['window'],
  windowMs: number
): WatchTickReport['velocity'] {
  const minutes = windowMs / 60_000;
  const hours = windowMs / 3_600_000;
  return {
    tokensPerMinute: roundMetric(usage.totalTokens / minutes),
    estimatedCostUsdPerHour:
      usage.estimatedCostUsd === null ? null : roundMetric(usage.estimatedCostUsd / hours)
  };
}

function buildBudgetSummary(
  service: BudgetStatusService,
  evaluations: readonly BudgetEvaluation[],
  sourceName: BuildWatchTickOptions['sourceName']
): WatchTickReport['budgets'] {
  const matchingEvaluations = evaluations.filter(
    (evaluation) =>
      sourceName === undefined ||
      evaluation.scopeKind === 'monthly_total' ||
      (evaluation.sourceName !== null && matchesOne(evaluation.sourceName, sourceName))
  );
  const rows = service.buildRows(matchingEvaluations);
  const exceededCount = rows.filter((row) => row.status === 'exceeded').length;
  const unknownCount = rows.filter((row) => row.status === 'unknown').length;
  const warningCount = rows.filter((row) => row.status !== 'ok').length;
  return {
    status: budgetSummaryStatus(rows, exceededCount, unknownCount),
    warningCount,
    exceededCount,
    unknownCount,
    rows
  };
}

function budgetSummaryStatus(
  rows: readonly WatchTickReport['budgets']['rows'][number][],
  exceededCount: number,
  unknownCount: number
): WatchTickReport['budgets']['status'] {
  if (rows.length === 0) return 'not_configured';
  if (exceededCount > 0) return 'exceeded';
  if (unknownCount > 0) return 'unknown';
  if (rows.some((row) => row.status === 'warning')) return 'warning';
  return 'ok';
}

function allKnownCost(events: readonly UsageEvent[]): number | null {
  if (events.length === 0 || events.some((event) => event.estimatedCostUsd === null)) {
    return null;
  }
  return roundCost(events.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0));
}

function sum(
  events: readonly UsageEvent[],
  field: 'totalTokens' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'reasoningTokens'
): number {
  return events.reduce((total, event) => total + event[field], 0);
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(8));
}
