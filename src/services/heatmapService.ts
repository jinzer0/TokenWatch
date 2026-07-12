import type { UsageEvent } from '../models/usageEvent.js';
import { nowIso } from '../utils/time.js';
import { heatmapReportSchema, type HeatmapReport } from './reportContracts.js';

const heatmapMetrics = ['tokens', 'events', 'cost'] as const;

export type HeatmapMetric = (typeof heatmapMetrics)[number];

export type BuildHeatmapReportOptions = {
  readonly year?: unknown;
  readonly metric?: HeatmapMetric;
  readonly filters?: {
    readonly source?: readonly string[];
    readonly sourceName?: readonly string[];
  };
};

type DayAccumulator = {
  date: string;
  events: number;
  tokens: number;
  cost: number;
  knownCostEvents: number;
  unknownCostEvents: number;
};

type TotalsAccumulator = {
  events: number;
  tokens: number;
  cost: number;
  knownCostEvents: number;
  unknownCostEvents: number;
};

export class HeatmapService {
  buildReport(events: readonly UsageEvent[], options: BuildHeatmapReportOptions): HeatmapReport {
    const year = parseHeatmapYear(options.year);
    const metric = options.metric ?? 'tokens';
    validateHeatmapMetric(metric);

    const days = createYearDays(year);
    const totals: TotalsAccumulator = {
      events: 0,
      tokens: 0,
      cost: 0,
      knownCostEvents: 0,
      unknownCostEvents: 0
    };

    for (const event of events) {
      if (utcYear(event.timestamp) !== year) continue;
      const day = days[dayIndex(event.timestamp, year)];
      if (!day) continue;
      addEvent(day, totals, event);
    }

    const values = days.map((day) => dayValue(day, metric));
    const maxPositive = Math.max(0, ...values.filter((value) => value > 0));
    const report = {
      version: 1,
      kind: 'heatmap',
      generatedAt: nowIso(),
      year,
      metric,
      range: { from: yearStartIso(year), to: nextYearStartIso(year) },
      filters: {
        source: [...(options.filters?.source ?? [])],
        sourceName: [...(options.filters?.sourceName ?? [])]
      },
      totals: {
        events: totals.events,
        totalTokens: totals.tokens,
        estimatedCostUsd: nullableCost(totals),
        unknownCostEvents: totals.unknownCostEvents
      },
      days: days.map((day, index) => ({
        date: day.date,
        value: values[index] ?? 0,
        level: heatmapLevel(values[index] ?? 0, maxPositive),
        events: day.events,
        totalTokens: day.tokens,
        estimatedCostUsd: nullableCost(day),
        unknownCostEvents: day.unknownCostEvents
      })),
      legend: heatmapLegend,
      privacy: { sanitized: true }
    };

    return heatmapReportSchema.parse(report);
  }
}

export const heatmapLegend = [
  { level: 0, label: 'No usage', symbol: '·' },
  { level: 1, label: 'Very low usage', symbol: '▁' },
  { level: 2, label: 'Low usage', symbol: '▂' },
  { level: 3, label: 'Medium usage', symbol: '▃' },
  { level: 4, label: 'High usage', symbol: '▅' },
  { level: 5, label: 'Peak usage', symbol: '█' }
] as const;

function parseHeatmapYear(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1970 || value > 9999) {
    throw new Error('invalid_report_option');
  }
  return value;
}

function validateHeatmapMetric(metric: HeatmapMetric): void {
  if (!heatmapMetrics.includes(metric)) {
    throw new Error('invalid_report_option');
  }
}

function createYearDays(year: number): DayAccumulator[] {
  return Array.from({ length: daysInUtcYear(year) }, (_, index) => ({
    date: dateKey(Date.UTC(year, 0, index + 1)),
    events: 0,
    tokens: 0,
    cost: 0,
    knownCostEvents: 0,
    unknownCostEvents: 0
  }));
}

function addEvent(day: DayAccumulator, totals: TotalsAccumulator, event: UsageEvent): void {
  day.events += 1;
  day.tokens += event.totalTokens;
  totals.events += 1;
  totals.tokens += event.totalTokens;
  if (event.estimatedCostUsd === null) {
    day.unknownCostEvents += 1;
    totals.unknownCostEvents += 1;
    return;
  }
  day.cost += event.estimatedCostUsd;
  day.knownCostEvents += 1;
  totals.cost += event.estimatedCostUsd;
  totals.knownCostEvents += 1;
}

function dayValue(day: DayAccumulator, metric: HeatmapMetric): number {
  switch (metric) {
    case 'tokens':
      return day.tokens;
    case 'events':
      return day.events;
    case 'cost':
      return day.cost;
  }
}

function heatmapLevel(value: number, maxPositive: number): number {
  if (maxPositive <= 0 || value <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / maxPositive) * 5)));
}

function nullableCost(accumulator: {
  readonly cost: number;
  readonly knownCostEvents: number;
}): number | null {
  return accumulator.knownCostEvents === 0 ? null : accumulator.cost;
}

function daysInUtcYear(year: number): number {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
}

function utcYear(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

function dayIndex(iso: string, year: number): number {
  return Math.floor((Date.parse(iso) - Date.UTC(year, 0, 1)) / 86_400_000);
}

function dateKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function yearStartIso(year: number): string {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
}

function nextYearStartIso(year: number): string {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString();
}
