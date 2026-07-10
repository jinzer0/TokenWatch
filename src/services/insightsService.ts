import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import {
  buildCostDriverCandidates,
  buildInsightsTotals,
  buildTopRows,
  roundMetric,
  type InsightsTotals
} from './insightsCostHelpers.js';
import {
  insightsReportOptionsSchema,
  insightsReportSchema,
  safeOutputLabel,
  type InsightsReport,
  type InsightsReportOptions
} from './insightsContracts.js';
import { groupEventsByPublicProject } from './projectAttribution.js';

type Clock = () => Date;

type SessionProxy = {
  readonly label: string;
  readonly value: number;
};

const windowDays = { '7d': 7, '30d': 30 } as const;

export class InsightsService {
  constructor(private readonly clock: Clock = () => new Date()) {}

  build(
    events: readonly UsageEvent[],
    options: InsightsReportOptions,
    budgetEvaluations: readonly BudgetEvaluation[] = []
  ): InsightsReport {
    const parsedOptions = insightsReportOptionsSchema.parse(options);
    const generatedAt = this.clock().toISOString();
    const includedEvents = events.filter((event) =>
      eventInRange(event, generatedAt, parsedOptions.window)
    );
    validateProjectLabels(includedEvents);
    const totals = buildInsightsTotals(includedEvents);
    const report = {
      version: 1,
      kind: 'insights',
      generatedAt,
      window: parsedOptions.window,
      range: buildRange(generatedAt, parsedOptions.window),
      totals,
      cacheHitRatio: buildCacheHitRatio(includedEvents),
      unknownPricingImpact: buildUnknownPricingImpact(totals),
      reasoningToOutputRatio: buildReasoningToOutputRatio(
        totals.outputTokens,
        totals.reasoningTokens
      ),
      reworkRatio: {
        status: 'insufficient-data',
        value: null,
        proxies: buildReworkProxies(includedEvents)
      },
      topRows: buildTopRows(includedEvents),
      costDriverCandidates: buildCostDriverCandidates(includedEvents),
      budgetPressure: buildBudgetPressure(budgetEvaluations),
      warnings: buildWarnings(includedEvents, totals),
      confidence: buildConfidence(includedEvents, totals),
      privacy: { sanitized: true }
    };
    return insightsReportSchema.parse(report);
  }
}

function buildRange(generatedAt: string, window: InsightsReportOptions['window']) {
  const to = new Date(generatedAt);
  const from = new Date(to.getTime() - windowDays[window] * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: generatedAt };
}

function eventInRange(
  event: UsageEvent,
  generatedAt: string,
  window: InsightsReportOptions['window']
): boolean {
  const to = Date.parse(generatedAt);
  const from = to - windowDays[window] * 24 * 60 * 60 * 1000;
  const time = Date.parse(event.timestamp);
  return time >= from && time < to;
}

function buildCacheHitRatio(events: readonly UsageEvent[]) {
  const inputTokens = sumNumbers(events, (event) => event.inputTokens);
  const cachedTokens = sumNumbers(events, (event) => event.cachedTokens);
  const denominator = inputTokens + cachedTokens;
  return { status: 'ok', value: denominator === 0 ? 0 : cachedTokens / denominator };
}

function buildReasoningToOutputRatio(outputTokens: number, reasoningTokens: number) {
  return outputTokens === 0
    ? { status: 'insufficient-data', value: null }
    : { status: 'ok', value: reasoningTokens / outputTokens };
}

function buildUnknownPricingImpact(totals: InsightsTotals) {
  return {
    unknownCostEvents: totals.unknownCostEvents,
    unknownCostTokens: totals.unknownCostTokens,
    unknownTokenShare: totals.tokens === 0 ? 0 : totals.unknownCostTokens / totals.tokens,
    knownEstimatedCostUsd: totals.knownEstimatedCostUsd
  };
}

function buildReworkProxies(events: readonly UsageEvent[]): SessionProxy[] {
  const sessions = groupedEvents(
    events.filter((event) => event.sessionIdHash !== null),
    (event) => event.sessionIdHash ?? ''
  ).map(([, sessionEvents]) => sessionEvents);
  if (sessions.length === 0) return [];
  return [
    { label: safeOutputLabel('events_per_session'), value: events.length / sessions.length },
    {
      label: safeOutputLabel('sessions_with_multiple_events'),
      value: sessions.filter((sessionEvents) => sessionEvents.length > 1).length
    },
    {
      label: safeOutputLabel('repeated_session_bursts'),
      value: countRepeatedSessionBursts(sessions)
    }
  ];
}

function countRepeatedSessionBursts(sessions: readonly (readonly UsageEvent[])[]): number {
  return sessions.filter((sessionEvents) => {
    const timestamps = sessionEvents
      .map((event) => Date.parse(event.timestamp))
      .sort((a, b) => a - b);
    return timestamps.some((timestamp, index) => {
      const next = timestamps[index + 1];
      return next !== undefined && next - timestamp <= 10 * 60 * 1000;
    });
  }).length;
}

function buildBudgetPressure(budgetEvaluations: readonly BudgetEvaluation[]) {
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

function buildWarnings(events: readonly UsageEvent[], totals: InsightsTotals) {
  return [
    ...(totals.unknownCostEvents > 0 ? ['unknown_pricing_present'] : []),
    ...(events.length > 0 ? ['rework_signal_unavailable'] : []),
    ...(hasPartialReasoningSignal(events) ? ['partial_reasoning_signal'] : [])
  ].map((warning) => safeOutputLabel(warning));
}

function buildConfidence(events: readonly UsageEvent[], totals: InsightsTotals) {
  const reasons = [
    ...(totals.unknownCostEvents > 0 ? ['mixed_pricing_confidence'] : []),
    ...(hasPartialReasoningSignal(events) ? ['partial_reasoning_signal'] : [])
  ].map((reason) => safeOutputLabel(reason));
  return { level: reasons.length > 0 ? 'medium' : 'high', reasons };
}

function hasPartialReasoningSignal(events: readonly UsageEvent[]): boolean {
  return (
    events.some((event) => event.reasoningTokens > 0) &&
    events.some((event) => event.reasoningTokens === 0)
  );
}

function validateProjectLabels(events: readonly UsageEvent[]): void {
  for (const group of groupEventsByPublicProject(events)) safeOutputLabel(group.projectKey);
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

function sumNumbers<T>(items: readonly T[], valueForItem: (item: T) => number): number {
  return items.reduce((total, item) => total + valueForItem(item), 0);
}
