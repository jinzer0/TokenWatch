import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import { InsightsService } from './insightsService.js';
import type { InsightsReport, TrendReport } from './insightsContracts.js';
import { TrendService } from './trendService.js';

const TUI_ANALYTICS_WINDOW = '7d';

export type TuiInsightRow = {
  readonly metric: string;
  readonly status: string;
  readonly severity: number;
  readonly impact: number;
  readonly current: string | number | null;
  readonly previous: string | number | null;
  readonly delta: string | number | null;
  readonly tokens: number;
  readonly estimatedCostUsd: number | null;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
  readonly warning: string;
};

export type TuiTrendRow = {
  readonly category: string;
  readonly metric: string;
  readonly status: string;
  readonly current: number | null;
  readonly previous: number | null;
  readonly delta: number | null;
  readonly absoluteDelta: number;
  readonly deltaPercent: number | null;
  readonly tokens: number;
  readonly estimatedCostUsd: number | null;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
  readonly warning: string;
};

export function buildTuiInsightRows(
  events: readonly UsageEvent[],
  budgets: readonly BudgetEvaluation[]
): TuiInsightRow[] {
  if (events.length === 0) return [];
  const report = new InsightsService().build(events, { window: TUI_ANALYTICS_WINDOW }, budgets);
  const warnings = new Set(report.warnings);
  const modelTotals = new Map(report.topRows.models.map((row) => [row.label, row]));
  return [
    ratioRow('cache_hit_ratio', report.cacheHitRatio, report.totals, warnings),
    unknownPricingRow(report, warnings),
    ratioRow('reasoning_to_output_ratio', report.reasoningToOutputRatio, report.totals, warnings),
    reworkRow(report, warnings),
    budgetRow(report),
    ...topAggregateRows('top_model', report.topRows.models),
    ...topAggregateRows('top_source', report.topRows.sources),
    ...topAggregateRows('top_source_name', report.topRows.sourceNames),
    ...topAggregateRows('top_project', report.topRows.projects),
    ...report.costDriverCandidates
      .slice(0, 3)
      .map((candidate) =>
        costDriverRow(candidate, modelTotals.get(candidate.label) ?? report.totals)
      )
  ].sort(sortInsightRows);
}

export function buildTuiTrendRows(
  events: readonly UsageEvent[],
  budgets: readonly BudgetEvaluation[]
): TuiTrendRow[] {
  if (events.length === 0) return [];
  const report = new TrendService().build(events, { budgets, window: TUI_ANALYTICS_WINDOW });
  return report.rows.map(trendRow).sort(sortTrendRows);
}

function ratioRow(
  metric: string,
  ratio: InsightsReport['cacheHitRatio'],
  totals: InsightsReport['totals'],
  warnings: ReadonlySet<string>
): TuiInsightRow {
  return {
    metric,
    status: ratio.status,
    severity: ratio.status === 'ok' ? 0 : 1,
    impact: ratio.value ?? 0,
    current: ratio.value === null ? ratio.status : formatPercent(ratio.value),
    previous: null,
    delta: null,
    ...costFields(totals),
    warning: warnings.has('partial_reasoning_signal') ? 'partial_reasoning_signal' : 'none'
  };
}

function unknownPricingRow(report: InsightsReport, warnings: ReadonlySet<string>): TuiInsightRow {
  const hasUnknownCost = report.totals.unknownCostEvents > 0;
  return {
    metric: 'unknown_pricing_impact',
    status: hasUnknownCost ? 'warning' : 'ok',
    severity: hasUnknownCost ? 2 : 0,
    impact: report.totals.unknownCostTokens,
    current: report.totals.unknownCostEvents,
    previous: null,
    delta: null,
    ...costFields(report.totals),
    warning: warnings.has('unknown_pricing_present') ? 'unknown_pricing_present' : 'none'
  };
}

function reworkRow(report: InsightsReport, warnings: ReadonlySet<string>): TuiInsightRow {
  return {
    metric: 'rework_signal',
    status: report.reworkRatio.status,
    severity: 1,
    impact: report.reworkRatio.proxies.length,
    current: report.reworkRatio.status,
    previous: null,
    delta: null,
    ...costFields(report.totals),
    warning: warnings.has('rework_signal_unavailable') ? 'rework_signal_unavailable' : 'none'
  };
}

function budgetRow(report: InsightsReport): TuiInsightRow {
  return {
    metric: 'budget_pressure',
    status: report.budgetPressure.status,
    severity: report.budgetPressure.status === 'over' ? 2 : 0,
    impact: report.budgetPressure.ratio ?? 0,
    current:
      report.budgetPressure.ratio === null
        ? 'not_configured'
        : formatPercent(report.budgetPressure.ratio),
    previous: null,
    delta: null,
    tokens: report.totals.tokens,
    estimatedCostUsd: report.totals.estimatedCostUsd,
    knownEstimatedCostUsd: report.budgetPressure.knownSpendUsd,
    unknownCostEvents: report.budgetPressure.unknownCostEvents,
    unknownCostTokens: report.budgetPressure.unknownCostTokens,
    warning: 'none'
  };
}

function topAggregateRows(
  prefix: string,
  rows: readonly InsightsReport['topRows']['models'][number][]
): TuiInsightRow[] {
  return rows.slice(0, 3).map((row) => ({
    metric: `${prefix}:${row.label}`,
    status: row.unknownCostEvents > 0 ? 'unknown-cost' : 'ok',
    severity: row.unknownCostEvents > 0 ? 1 : 0,
    impact: row.tokens,
    current: row.tokens,
    previous: null,
    delta: null,
    ...costFields(row),
    warning: row.unknownCostEvents > 0 ? 'unknown_pricing_present' : 'none'
  }));
}

function costDriverRow(
  candidate: InsightsReport['costDriverCandidates'][number],
  totals: InsightsReport['topRows']['models'][number] | InsightsReport['totals']
): TuiInsightRow {
  return {
    metric: `cost_driver:${candidate.label}`,
    status: candidate.pricingStatus,
    severity: Number(candidate.spendDriverCandidate) + Number(candidate.expensiveRelativeToMedian),
    impact: candidate.knownSpendShare ?? candidate.knownTokens,
    current:
      candidate.knownSpendShare === null
        ? candidate.pricingStatus
        : formatPercent(candidate.knownSpendShare),
    previous: null,
    delta: null,
    ...costFields(totals),
    warning: candidate.spendDriverCandidate
      ? 'spend_driver_candidate'
      : candidate.expensiveRelativeToMedian
        ? 'expensive_relative_to_median'
        : 'none'
  };
}

function trendRow(row: TrendReport['rows'][number]): TuiTrendRow {
  const current = trendMetricValue(row.current, row.metric);
  const previous = trendMetricValue(row.previous, row.metric);
  const delta = current === null || previous === null ? null : current - previous;
  return {
    category: row.category,
    metric: row.category === 'total' ? row.label : `${row.category}:${row.label}`,
    status: row.direction,
    current,
    previous,
    delta,
    absoluteDelta: delta === null ? 0 : Math.abs(delta),
    deltaPercent: row.deltaPercent,
    tokens: row.current.tokens,
    estimatedCostUsd: row.current.estimatedCostUsd,
    knownEstimatedCostUsd: row.current.knownEstimatedCostUsd,
    unknownCostEvents: row.current.unknownCostEvents,
    unknownCostTokens: row.current.unknownCostTokens,
    warning: row.current.unknownCostEvents > 0 ? 'unknown_pricing_present' : 'none'
  };
}

function costFields(
  totals: InsightsReport['totals']
): Pick<
  TuiInsightRow,
  | 'tokens'
  | 'estimatedCostUsd'
  | 'knownEstimatedCostUsd'
  | 'unknownCostEvents'
  | 'unknownCostTokens'
> {
  return {
    tokens: totals.tokens,
    estimatedCostUsd: totals.estimatedCostUsd,
    knownEstimatedCostUsd: totals.knownEstimatedCostUsd,
    unknownCostEvents: totals.unknownCostEvents,
    unknownCostTokens: totals.unknownCostTokens
  };
}

function trendMetricValue(
  total: TrendReport['rows'][number]['current'],
  metric: TrendReport['rows'][number]['metric']
): number | null {
  switch (metric) {
    case 'events':
      return total.events;
    case 'tokens':
      return total.tokens;
    case 'cost':
      return total.estimatedCostUsd;
  }
}

function sortInsightRows(left: TuiInsightRow, right: TuiInsightRow): number {
  return (
    right.severity - left.severity ||
    right.impact - left.impact ||
    left.metric.localeCompare(right.metric)
  );
}

function sortTrendRows(left: TuiTrendRow, right: TuiTrendRow): number {
  return right.absoluteDelta - left.absoluteDelta || left.metric.localeCompare(right.metric);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
