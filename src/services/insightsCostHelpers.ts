import type { UsageEvent } from '../models/usageEvent.js';
import { safeOutputLabel } from './insightsContracts.js';
import { groupEventsByPublicProject, projectKeyForEvent } from './projectAttribution.js';

export type CostTotals = {
  readonly events: number;
  readonly tokens: number;
  readonly estimatedCostUsd: number | null;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
};

export type InsightsTotals = CostTotals & {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly reasoningTokens: number;
};

export type TopAggregateRow = InsightsTotals & {
  readonly label: string;
};

export type TopRows = {
  readonly models: readonly TopAggregateRow[];
  readonly sources: readonly TopAggregateRow[];
  readonly sourceNames: readonly TopAggregateRow[];
  readonly projects: readonly TopAggregateRow[];
};

type ModelCostGroup = CostTotals & {
  readonly label: string;
};

export function buildInsightsTotals(events: readonly UsageEvent[]): InsightsTotals {
  const costTotals = accumulateCosts(events);
  return {
    ...costTotals,
    inputTokens: sum(events, (event) => event.inputTokens),
    outputTokens: sum(events, (event) => event.outputTokens),
    cachedTokens: sum(events, (event) => event.cachedTokens),
    reasoningTokens: sum(events, (event) => event.reasoningTokens)
  };
}

export function buildCostDriverCandidates(events: readonly UsageEvent[]) {
  const groups = groupedEvents(events, (event) => event.model).map(([label, modelEvents]) => ({
    label: safeOutputLabel(label),
    ...accumulateCosts(modelEvents)
  }));
  const knownGroups = groups.filter(
    (group) =>
      group.knownEstimatedCostUsd !== null && group.tokens > 0 && group.unknownCostEvents === 0
  );
  const totalKnownSpendUsd = roundMetric(
    knownGroups.reduce((total, group) => total + (group.knownEstimatedCostUsd ?? 0), 0)
  );
  const weightedMedian = weightedMedianCost(knownGroups);
  return groups
    .map((group) => buildCostDriverCandidate(group, totalKnownSpendUsd, weightedMedian))
    .sort(sortCostDriverCandidates);
}

export function buildTopRows(events: readonly UsageEvent[]): TopRows {
  return {
    models: buildTopAggregateRows(events, (event) => event.model),
    sources: buildTopAggregateRows(events, (event) => event.source),
    sourceNames: buildTopAggregateRows(events, (event) => event.sourceName),
    projects: buildTopProjectRows(events)
  };
}

export function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function accumulateCosts(events: readonly UsageEvent[]): CostTotals {
  const knownEvents = events.filter((event) => event.estimatedCostUsd !== null);
  const unknownEvents = events.filter((event) => event.estimatedCostUsd === null);
  const knownEstimatedCostUsd =
    knownEvents.length > 0 ? roundMetric(sumKnownCosts(knownEvents)) : null;
  return {
    events: events.length,
    tokens: sum(events, (event) => event.totalTokens),
    estimatedCostUsd: unknownEvents.length > 0 ? null : knownEstimatedCostUsd,
    knownEstimatedCostUsd,
    unknownCostEvents: unknownEvents.length,
    unknownCostTokens: sum(unknownEvents, (event) => event.totalTokens)
  };
}

function buildCostDriverCandidate(
  group: ModelCostGroup,
  totalKnownSpendUsd: number,
  weightedMedian: number | null
) {
  const pricingStatus = group.unknownCostEvents > 0 ? 'unknown' : 'known';
  const knownCostUsd = group.knownEstimatedCostUsd;
  const effectiveCostPerMillionTokens =
    pricingStatus === 'known' && knownCostUsd !== null && group.tokens > 0
      ? roundMetric((knownCostUsd / group.tokens) * 1_000_000)
      : null;
  const knownSpendShare =
    pricingStatus === 'known' && knownCostUsd !== null && totalKnownSpendUsd > 0
      ? roundMetric(knownCostUsd / totalKnownSpendUsd)
      : null;
  return {
    label: group.label,
    pricingStatus,
    knownTokens: pricingStatus === 'known' ? group.tokens : 0,
    knownCostUsd: pricingStatus === 'known' ? knownCostUsd : null,
    effectiveCostPerMillionTokens,
    knownSpendShare,
    expensiveRelativeToMedian:
      effectiveCostPerMillionTokens !== null && weightedMedian !== null && weightedMedian > 0
        ? effectiveCostPerMillionTokens >= weightedMedian * 2
        : false,
    spendDriverCandidate: knownSpendShare !== null ? knownSpendShare >= 0.5 : false
  };
}

function weightedMedianCost(groups: readonly ModelCostGroup[]): number | null {
  const weighted = groups
    .map((group) => ({
      costPerMillion:
        group.knownEstimatedCostUsd === null ? 0 : group.knownEstimatedCostUsd / group.tokens,
      tokens: group.tokens
    }))
    .sort((left, right) => left.costPerMillion - right.costPerMillion);
  const totalTokens = sum(weighted, (entry) => entry.tokens);
  let cumulativeTokens = 0;
  for (const entry of weighted) {
    cumulativeTokens += entry.tokens;
    if (cumulativeTokens >= totalTokens / 2) return roundMetric(entry.costPerMillion * 1_000_000);
  }
  return null;
}

function groupedEvents<K extends string>(
  events: readonly UsageEvent[],
  keyForEvent: (event: UsageEvent) => K
): [K, UsageEvent[]][] {
  const groups = new Map<K, UsageEvent[]>();
  for (const event of events) {
    const key = keyForEvent(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return Array.from(groups.entries());
}

function buildTopAggregateRows(
  events: readonly UsageEvent[],
  keyForEvent: (event: UsageEvent) => string
): TopAggregateRow[] {
  return groupedEvents(events, keyForEvent)
    .map(([label, groupEvents]) => buildTopAggregateRow(label, groupEvents))
    .sort(sortTopAggregateRows);
}

function buildTopProjectRows(events: readonly UsageEvent[]): TopAggregateRow[] {
  return groupEventsByPublicProject(events)
    .map((group) =>
      buildTopAggregateRow(
        group.projectKey,
        events.filter((event) => projectKeyForEvent(event) === group.projectKey)
      )
    )
    .sort(sortTopAggregateRows);
}

function buildTopAggregateRow(label: string, events: readonly UsageEvent[]): TopAggregateRow {
  return { label: safeOutputLabel(label), ...buildInsightsTotals(events) };
}

function sortTopAggregateRows(left: TopAggregateRow, right: TopAggregateRow): number {
  return (
    right.tokens - left.tokens ||
    right.events - left.events ||
    left.label.localeCompare(right.label)
  );
}

function sortCostDriverCandidates(
  left: ReturnType<typeof buildCostDriverCandidate>,
  right: ReturnType<typeof buildCostDriverCandidate>
): number {
  return (
    Number(right.spendDriverCandidate) - Number(left.spendDriverCandidate) ||
    Number(right.expensiveRelativeToMedian) - Number(left.expensiveRelativeToMedian) ||
    (right.knownSpendShare ?? -1) - (left.knownSpendShare ?? -1) ||
    right.knownTokens - left.knownTokens ||
    left.label.localeCompare(right.label)
  );
}

function sum<T>(items: readonly T[], valueForItem: (item: T) => number): number {
  return items.reduce((total, item) => total + valueForItem(item), 0);
}

function sumKnownCosts(events: readonly UsageEvent[]): number {
  return events.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0);
}
