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
  readonly source?: SourceType | readonly SourceType[];
  readonly sourceName?: string | readonly string[];
  readonly budgets?: readonly BudgetEvaluation[];
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
    const intervalMs = validIntervalMs(options.intervalMs);
    const windowStartExclusiveMs = now.getTime() - intervalMs;
    const windowEndInclusiveMs = now.getTime();
    const windowEvents = events.filter((event) => {
      const timestampMs = Date.parse(event.timestamp);
      return (
        timestampMs > windowStartExclusiveMs &&
        timestampMs <= windowEndInclusiveMs &&
        matchesFilters(event, options)
      );
    });
    const summary = this.aggregator.summarize([...windowEvents]);
    const delta = buildDelta(windowEvents);
    const dto = {
      version: 1,
      kind: 'watch_tick',
      timestamp: now.toISOString(),
      intervalMs,
      delta,
      velocity: buildVelocity(delta, intervalMs),
      top: buildTopLabels(windowEvents, summary.topModel, summary.topSourceName),
      budgets: buildBudgetSummary(this.budgetStatus, options.budgets ?? [], options.sourceName),
      privacy: { sanitized: true }
    } satisfies WatchTickReport;
    return watchTickReportSchema.parse(dto);
  }
}

export function parseWatchInterval(value: string): number {
  const match = /^([1-9][0-9]*)([sm]?)$/.exec(value);
  if (!match) {
    throw new WatchServiceError('invalid_report_option');
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const intervalMs = unit === 'm' ? amount * 60_000 : unit === 's' ? amount * 1_000 : amount;
  return validIntervalMs(intervalMs);
}

function validIntervalMs(intervalMs: number): number {
  if (!Number.isInteger(intervalMs) || intervalMs < minimumIntervalMs) {
    throw new WatchServiceError('invalid_report_option');
  }
  return intervalMs;
}

function matchesFilters(event: UsageEvent, options: BuildWatchTickOptions): boolean {
  if (options.source !== undefined && !matchesOne(event.source, options.source)) {
    return false;
  }
  if (options.sourceName !== undefined && !matchesOne(event.sourceName, options.sourceName)) {
    return false;
  }
  return true;
}

function matchesOne<T extends string>(value: T, filter: T | readonly T[]): boolean {
  return Array.isArray(filter) ? filter.includes(value) : value === filter;
}

function buildDelta(events: readonly UsageEvent[]): WatchTickReport['delta'] {
  const unknownCostEvents = events.filter((event) => event.estimatedCostUsd === null);
  return {
    events: events.length,
    tokens: sum(events, 'totalTokens'),
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
  delta: WatchTickReport['delta'],
  intervalMs: number
): WatchTickReport['velocity'] {
  const minutes = intervalMs / 60_000;
  const hours = intervalMs / 3_600_000;
  return {
    tokensPerMinute: roundMetric(delta.tokens / minutes),
    estimatedCostUsdPerHour:
      delta.estimatedCostUsd === null ? null : roundMetric(delta.estimatedCostUsd / hours)
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
