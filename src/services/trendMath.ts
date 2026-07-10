import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import { roundMetric } from './insightsCostHelpers.js';
import { safeOutputLabel, type TrendReport } from './insightsContracts.js';
import { projectKeyForEvent, UNKNOWN_PROJECT_KEY } from './projectAttribution.js';

const groupKinds = ['model', 'source', 'sourceName', 'project'] as const;

type Range = { readonly from: Date; readonly to: Date };
type TrendDirection = TrendReport['totals']['direction'];
type TrendMetric = TrendReport['rows'][number]['metric'];
type TrendRowCategory = TrendReport['rows'][number]['category'];
type TrendTotal = TrendReport['totals']['current'];
type RatioMetric = TrendReport['cacheHitRatio']['current'];

type TrendAccumulator = {
  events: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  knownCostUsd: number;
  knownCostEvents: number;
  unknownCostEvents: number;
  unknownCostTokens: number;
};

export function eventInRange(event: UsageEvent, range: Range): boolean {
  const time = Date.parse(event.timestamp);
  return time >= range.from.getTime() && time < range.to.getTime();
}

export function buildRows(
  currentEvents: readonly UsageEvent[],
  previousEvents: readonly UsageEvent[]
): TrendReport['rows'] {
  const current = accumulate(currentEvents);
  const previous = accumulate(previousEvents);
  return [
    buildRow('total', 'total events', 'events', current, previous),
    buildRow('total', 'total tokens', 'tokens', current, previous),
    buildRow('total', 'total cost', 'cost', current, previous),
    ...groupKinds.flatMap((kind) => buildGroupRows(currentEvents, previousEvents, kind))
  ];
}

export function buildTrendTotals(
  currentEvents: readonly UsageEvent[],
  previousEvents: readonly UsageEvent[],
  metric: TrendMetric
): TrendReport['totals'] {
  return compareTotals(accumulate(currentEvents), accumulate(previousEvents), metric);
}

export function buildCacheHitRatioComparison(
  currentEvents: readonly UsageEvent[],
  previousEvents: readonly UsageEvent[]
): TrendReport['cacheHitRatio'] {
  const current = buildCacheHitRatio(currentEvents);
  const previous = buildCacheHitRatio(previousEvents);
  return {
    current,
    previous,
    deltaPercent: calculateDeltaPercent(current.value, previous.value),
    direction: calculateDirection(current.value, previous.value)
  };
}

export function buildBudgetPressure(
  budgetEvaluations: readonly BudgetEvaluation[]
): TrendReport['budgetPressure'] {
  const evaluation = budgetEvaluations.find((budget) => budget.scopeKind === 'monthly_total');
  if (evaluation === undefined) {
    return {
      status: 'not_configured',
      ratio: null,
      knownSpendUsd: null,
      thresholdUsd: null,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    };
  }
  return {
    status: evaluation.status,
    ratio:
      evaluation.thresholdUsd > 0
        ? roundMetric(evaluation.knownSpendUsd / evaluation.thresholdUsd)
        : null,
    knownSpendUsd: evaluation.knownSpendUsd,
    thresholdUsd: evaluation.thresholdUsd,
    unknownCostEvents: evaluation.unknownCostEventCount,
    unknownCostTokens: evaluation.unknownCostTokenCount
  };
}

function buildGroupRows(
  currentEvents: readonly UsageEvent[],
  previousEvents: readonly UsageEvent[],
  kind: (typeof groupKinds)[number]
): TrendReport['rows'] {
  const currentGroups = groupEvents(currentEvents, kind);
  const previousGroups = groupEvents(previousEvents, kind);
  const labels = Array.from(new Set([...currentGroups.keys(), ...previousGroups.keys()])).sort();
  return labels.map((label) =>
    buildRow(
      kind,
      label,
      'tokens',
      currentGroups.get(label) ?? emptyAccumulator(),
      previousGroups.get(label) ?? emptyAccumulator()
    )
  );
}

function groupEvents(
  events: readonly UsageEvent[],
  kind: (typeof groupKinds)[number]
): Map<string, TrendAccumulator> {
  const groups = new Map<string, TrendAccumulator>();
  for (const event of events) {
    const label = groupLabel(event, kind);
    if (label === null) continue;
    const accumulator = groups.get(label) ?? emptyAccumulator();
    addEvent(accumulator, event);
    groups.set(label, accumulator);
  }
  return groups;
}

function groupLabel(event: UsageEvent, kind: (typeof groupKinds)[number]): string | null {
  switch (kind) {
    case 'model':
      return event.model;
    case 'source':
      return event.source;
    case 'sourceName':
      return event.sourceName;
    case 'project': {
      const projectKey = projectKeyForEvent(event);
      return projectKey === UNKNOWN_PROJECT_KEY ? null : projectKey;
    }
  }
}

function buildRow(
  category: TrendRowCategory,
  label: string,
  metric: TrendMetric,
  current: TrendAccumulator,
  previous: TrendAccumulator
): TrendReport['rows'][number] {
  const comparison = compareTotals(current, previous, metric);
  return { category, label: safeOutputLabel(label), metric, ...comparison };
}

function compareTotals(
  current: TrendAccumulator,
  previous: TrendAccumulator,
  metric: TrendMetric
): TrendReport['totals'] {
  const currentTotal = toTrendTotal(current);
  const previousTotal = toTrendTotal(previous);
  const currentValue = metricValue(currentTotal, metric);
  const previousValue = metricValue(previousTotal, metric);
  return {
    current: currentTotal,
    previous: previousTotal,
    deltaPercent: calculateDeltaPercent(currentValue, previousValue),
    direction: calculateDirection(currentValue, previousValue)
  };
}

function metricValue(total: TrendTotal, metric: TrendMetric): number | null {
  switch (metric) {
    case 'events':
      return total.events;
    case 'tokens':
      return total.tokens;
    case 'cost':
      return total.estimatedCostUsd;
  }
}

function calculateDeltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return roundMetric(((current - previous) / previous) * 100);
}

function calculateDirection(current: number | null, previous: number | null): TrendDirection {
  if (current === null || previous === null)
    return current !== null && current > 0 ? 'new' : 'unknown';
  if (current === previous) return 'flat';
  if (previous === 0) return current > 0 ? 'new' : 'down';
  return current > previous ? 'up' : 'down';
}

function buildCacheHitRatio(events: readonly UsageEvent[]): RatioMetric {
  const inputTokens = sum(events, (event) => event.inputTokens);
  const cachedTokens = sum(events, (event) => event.cachedTokens);
  const denominator = inputTokens + cachedTokens;
  return { status: 'ok', value: denominator === 0 ? 0 : cachedTokens / denominator };
}

function accumulate(events: readonly UsageEvent[]): TrendAccumulator {
  const accumulator = emptyAccumulator();
  for (const event of events) addEvent(accumulator, event);
  return accumulator;
}

function emptyAccumulator(): TrendAccumulator {
  return {
    events: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    knownCostUsd: 0,
    knownCostEvents: 0,
    unknownCostEvents: 0,
    unknownCostTokens: 0
  };
}

function addEvent(accumulator: TrendAccumulator, event: UsageEvent): void {
  accumulator.events += 1;
  accumulator.tokens += event.totalTokens;
  accumulator.inputTokens += event.inputTokens;
  accumulator.outputTokens += event.outputTokens;
  accumulator.cachedTokens += event.cachedTokens;
  accumulator.reasoningTokens += event.reasoningTokens;
  if (event.estimatedCostUsd === null) {
    accumulator.unknownCostEvents += 1;
    accumulator.unknownCostTokens += event.totalTokens;
    return;
  }
  accumulator.knownCostUsd += event.estimatedCostUsd;
  accumulator.knownCostEvents += 1;
}

function toTrendTotal(accumulator: TrendAccumulator): TrendTotal {
  return {
    events: accumulator.events,
    tokens: accumulator.tokens,
    inputTokens: accumulator.inputTokens,
    outputTokens: accumulator.outputTokens,
    cachedTokens: accumulator.cachedTokens,
    reasoningTokens: accumulator.reasoningTokens,
    estimatedCostUsd:
      accumulator.events === 0 || accumulator.unknownCostEvents > 0
        ? null
        : roundMetric(accumulator.knownCostUsd),
    knownEstimatedCostUsd:
      accumulator.knownCostEvents === 0 ? null : roundMetric(accumulator.knownCostUsd),
    unknownCostEvents: accumulator.unknownCostEvents,
    unknownCostTokens: accumulator.unknownCostTokens
  };
}

function sum<T>(items: readonly T[], valueForItem: (item: T) => number): number {
  return items.reduce((total, item) => total + valueForItem(item), 0);
}
