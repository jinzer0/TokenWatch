import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import {
  trendReportOptionsSchema,
  trendReportSchema,
  type TrendReport
} from './reportContracts.js';
import {
  buildBudgetPressure,
  buildCacheHitRatioComparison,
  buildRows,
  buildTrendTotals,
  eventInRange
} from './trendMath.js';

const windowDays = { '7d': 7, '30d': 30 } as const;

type TrendWindow = keyof typeof windowDays;

export type BuildTrendReportOptions = {
  readonly window?: unknown;
  readonly now?: Date | string;
  readonly budgets?: readonly BudgetEvaluation[];
};

type Range = { readonly from: Date; readonly to: Date };
type Ranges = { readonly current: Range; readonly previous: Range };

export class TrendService {
  build(events: readonly UsageEvent[], options: BuildTrendReportOptions = {}): TrendReport {
    const parsedOptions = trendReportOptionsSchema.parse({ window: options.window });
    const now = parseNow(options.now);
    const ranges = buildRanges(now, parsedOptions.window);
    const currentEvents = events.filter((event) => eventInRange(event, ranges.current));
    const previousEvents = events.filter((event) => eventInRange(event, ranges.previous));
    const report = {
      version: 1,
      kind: 'trend',
      generatedAt: now.toISOString(),
      window: parsedOptions.window,
      trendScope: 'all-events-rolling',
      range: {
        current: { from: ranges.current.from.toISOString(), to: ranges.current.to.toISOString() },
        previous: { from: ranges.previous.from.toISOString(), to: ranges.previous.to.toISOString() }
      },
      totals: buildTrendTotals(currentEvents, previousEvents, 'tokens'),
      cacheHitRatio: buildCacheHitRatioComparison(currentEvents, previousEvents),
      budgetPressure: buildBudgetPressure(options.budgets ?? []),
      rows: buildRows(currentEvents, previousEvents),
      warnings: [],
      confidence: { level: 'high', reasons: [] },
      privacy: { sanitized: true }
    };

    return trendReportSchema.parse(report);
  }
}

function parseNow(value: Date | string | undefined): Date {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('invalid_report_option');
  return date;
}

function buildRanges(now: Date, window: TrendWindow): Ranges {
  const durationMs = windowDays[window] * 24 * 60 * 60 * 1000;
  const currentFrom = new Date(now.getTime() - durationMs);
  return {
    current: { from: currentFrom, to: now },
    previous: { from: new Date(now.getTime() - durationMs * 2), to: currentFrom }
  };
}
