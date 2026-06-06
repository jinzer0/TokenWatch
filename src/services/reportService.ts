import type { UsageEvent } from '../models/usageEvent.js';
import { nowIso } from '../utils/time.js';
import { AggregatorService } from './aggregator.js';
import {
  graphReportSchema,
  wrappedReportSchema,
  type GraphReport,
  type WrappedReport
} from './reportContracts.js';

const graphBuckets = ['day', 'hour', 'month'] as const;
const graphMetrics = ['tokens', 'cost', 'events'] as const;

type GraphBucket = (typeof graphBuckets)[number];
type GraphMetric = (typeof graphMetrics)[number];

export type BuildGraphReportOptions = {
  bucket?: GraphBucket;
  metric?: GraphMetric;
  from?: string;
  to?: string;
};

export type BuildWrappedReportOptions = {
  year?: unknown;
};

type SeriesAccumulator = {
  key: string;
  events: number;
  tokens: number;
  cost: number;
  unknownCostEvents: number;
};

export class ReportService {
  private readonly aggregator = new AggregatorService();

  buildGraphReport(events: UsageEvent[], options: BuildGraphReportOptions = {}): GraphReport {
    const parsedOptions = parseOptions(options);
    const includedEvents = filterEvents(events, parsedOptions.fromTime, parsedOptions.toTime);
    const totalsAccumulator = accumulateEvents(includedEvents);
    const report = {
      version: 1,
      kind: 'graph',
      generatedAt: nowIso(),
      range: { from: parsedOptions.from, to: parsedOptions.to },
      bucket: parsedOptions.bucket,
      metric: parsedOptions.metric,
      totals: {
        events: totalsAccumulator.events,
        tokens: totalsAccumulator.tokens,
        estimatedCostUsd: nullableCost(totalsAccumulator)
      },
      series: buildSeries(includedEvents, parsedOptions.bucket),
      unknownCostEvents: totalsAccumulator.unknownCostEvents,
      privacy: { sanitized: true }
    };

    return graphReportSchema.parse(report);
  }

  buildWrappedReport(events: UsageEvent[], options: BuildWrappedReportOptions): WrappedReport {
    const year = parseWrappedYear(options?.year);
    const includedEvents = events.filter((event) => utcYear(event.timestamp) === year);
    const totalsAccumulator = accumulateEvents(includedEvents);
    const sessions = this.aggregator.sessions(includedEvents);
    const sessionTimeMetrics = this.aggregator.sessionTimeMetrics(includedEvents);
    const longestSession = sessions
      .slice()
      .sort(
        (left, right) =>
          right.activeDurationMs - left.activeDurationMs ||
          right.totalTokens - left.totalTokens ||
          right.events - left.events ||
          left.key.localeCompare(right.key)
      )[0];
    const topModels = buildRankings(includedEvents, (event) => event.model);
    const topAgents = buildRankings(includedEvents, (event) => event.agent);
    const topSources = buildRankings(includedEvents, (event) => event.source);
    const topSourceNames = buildRankings(includedEvents, (event) => event.sourceName);
    const monthly = buildChronologicalRankings(includedEvents, (event) =>
      utcMonthBucket(event.timestamp)
    );
    const daily = buildChronologicalRankings(includedEvents, (event) =>
      utcDayBucket(event.timestamp)
    );
    const report = {
      version: 1,
      kind: 'wrapped',
      year,
      generatedAt: nowIso(),
      totals: {
        events: totalsAccumulator.events,
        tokens: totalsAccumulator.tokens,
        estimatedCostUsd: nullableCost(totalsAccumulator)
      },
      highlights: {
        busiestMonth: rankWithoutCost(monthly.slice().sort(compareRanking)[0] ?? null),
        busiestDay: rankWithoutCost(daily.slice().sort(compareRanking)[0] ?? null),
        topModel: rankWithoutCost(topModels[0] ?? null),
        topAgent: rankWithoutCost(topAgents[0] ?? null),
        topSourceName: rankWithoutCost(topSourceNames[0] ?? null),
        longestSessionMs: sessionTimeMetrics.longestSessionMs,
        maxConcurrentSessions: sessionTimeMetrics.maxConcurrentSessions
      },
      topModels,
      topAgents,
      topSources,
      topSourceNames,
      monthly,
      sessionMetrics: {
        sessionCount: sessionTimeMetrics.sessionCount,
        eventsWithoutSession: sessionTimeMetrics.eventsWithoutSession,
        totalActiveDurationMs: sessionTimeMetrics.totalActiveDurationMs,
        averageActiveDurationMs:
          sessionTimeMetrics.sessionCount === 0
            ? 0
            : Math.round(
                sessionTimeMetrics.totalActiveDurationMs / sessionTimeMetrics.sessionCount
              ),
        longestSession: longestSession
          ? {
              key: longestSession.key,
              events: longestSession.events,
              tokens: longestSession.totalTokens,
              activeDurationMs: longestSession.activeDurationMs
            }
          : null
      },
      unknownCostEvents: totalsAccumulator.unknownCostEvents,
      privacy: { sanitized: true }
    };

    return wrappedReportSchema.parse(report);
  }
}

function parseWrappedYear(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error('invalid_wrapped_year');
  }
  return value;
}

function parseOptions(options: BuildGraphReportOptions): {
  bucket: GraphBucket;
  metric: GraphMetric;
  from: string | null;
  to: string | null;
  fromTime: number | null;
  toTime: number | null;
} {
  const bucket = options.bucket ?? 'day';
  const metric = options.metric ?? 'tokens';
  if (!isGraphBucket(bucket) || !isGraphMetric(metric)) {
    throwInvalidReportOption();
  }

  const from = parseIsoOption(options.from);
  const to = parseIsoOption(options.to);
  if (from.time !== null && to.time !== null && from.time > to.time) {
    throwInvalidReportOption();
  }

  return { bucket, metric, from: from.value, to: to.value, fromTime: from.time, toTime: to.time };
}

function parseIsoOption(value: string | undefined): { value: string | null; time: number | null } {
  if (value === undefined) {
    return { value: null, time: null };
  }
  if (typeof value !== 'string') {
    throwInvalidReportOption();
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throwInvalidReportOption();
  }
  return { value, time };
}

function filterEvents(
  events: UsageEvent[],
  fromTime: number | null,
  toTime: number | null
): UsageEvent[] {
  return events.filter((event) => {
    const time = Date.parse(event.timestamp);
    return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
  });
}

function buildSeries(events: UsageEvent[], bucket: GraphBucket): GraphReport['series'] {
  const groups = new Map<string, SeriesAccumulator>();
  for (const event of events) {
    const key = bucketKey(event, bucket);
    const accumulator = groups.get(key) ?? createAccumulator(key);
    addEvent(accumulator, event);
    groups.set(key, accumulator);
  }

  return Array.from(groups.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((accumulator) => ({
      key: accumulator.key,
      events: accumulator.events,
      tokens: accumulator.tokens,
      estimatedCostUsd: nullableCost(accumulator)
    }));
}

function buildRankings(
  events: UsageEvent[],
  selectKey: (event: UsageEvent) => string
): WrappedReport['topModels'] {
  return buildRankingValues(events, selectKey).sort(compareRanking);
}

function buildChronologicalRankings(
  events: UsageEvent[],
  selectKey: (event: UsageEvent) => string
): WrappedReport['monthly'] {
  return buildRankingValues(events, selectKey).sort((left, right) =>
    left.key.localeCompare(right.key)
  );
}

function buildRankingValues(
  events: UsageEvent[],
  selectKey: (event: UsageEvent) => string
): WrappedReport['topModels'] {
  const groups = new Map<string, SeriesAccumulator>();
  for (const event of events) {
    const key = selectKey(event);
    const accumulator = groups.get(key) ?? createAccumulator(key);
    addEvent(accumulator, event);
    groups.set(key, accumulator);
  }

  return Array.from(groups.values()).map((accumulator) => ({
    key: accumulator.key,
    events: accumulator.events,
    tokens: accumulator.tokens,
    estimatedCostUsd: nullableCost(accumulator)
  }));
}

function compareRanking(
  left: WrappedReport['topModels'][number],
  right: WrappedReport['topModels'][number]
): number {
  return (
    right.tokens - left.tokens || right.events - left.events || left.key.localeCompare(right.key)
  );
}

function rankWithoutCost(
  ranking: WrappedReport['topModels'][number] | null
): WrappedReport['highlights']['topModel'] {
  if (!ranking) {
    return null;
  }
  return { key: ranking.key, events: ranking.events, tokens: ranking.tokens };
}

function accumulateEvents(events: UsageEvent[]): SeriesAccumulator {
  const accumulator = createAccumulator('totals');
  for (const event of events) {
    addEvent(accumulator, event);
  }
  return accumulator;
}

function createAccumulator(key: string): SeriesAccumulator {
  return { key, events: 0, tokens: 0, cost: 0, unknownCostEvents: 0 };
}

function addEvent(accumulator: SeriesAccumulator, event: UsageEvent): void {
  accumulator.events += 1;
  accumulator.tokens += event.totalTokens;
  if (event.estimatedCostUsd === null) {
    accumulator.unknownCostEvents += 1;
    return;
  }
  accumulator.cost += event.estimatedCostUsd;
}

function nullableCost(accumulator: SeriesAccumulator): number | null {
  if (accumulator.events === 0 || accumulator.unknownCostEvents > 0) {
    return null;
  }
  return roundUsd(accumulator.cost);
}

function bucketKey(event: UsageEvent, bucket: GraphBucket): string {
  switch (bucket) {
    case 'day':
      return utcDayBucket(event.timestamp);
    case 'hour':
      return utcHourBucket(event.timestamp);
    case 'month':
      return utcMonthBucket(event.timestamp);
  }
}

function utcDayBucket(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function utcHourBucket(iso: string): string {
  const date = new Date(iso);
  return `${utcDayBucket(iso)}T${pad(date.getUTCHours())}`;
}

function utcMonthBucket(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function utcYear(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isGraphBucket(value: unknown): value is GraphBucket {
  return graphBuckets.includes(value as GraphBucket);
}

function isGraphMetric(value: unknown): value is GraphMetric {
  return graphMetrics.includes(value as GraphMetric);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function throwInvalidReportOption(): never {
  throw new Error('invalid_report_option');
}
