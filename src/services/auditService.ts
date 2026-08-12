import { z } from 'zod';
import type { ScanRun } from '../models/scanRun.js';
import type { UsageEvent } from '../models/usageEvent.js';
import { parserNames, type ParserName, type RegisteredParser } from '../parsers/base.js';
import { isParserName } from '../parsers/registry.js';
import { auditReportSchema, type AuditReport } from './auditContracts.js';
import { safeOutputLabelSchema } from './insightsContracts.js';
import { isStrictIsoInstant, parseStrictIsoInstant } from './auditTime.js';

const windowDays = { '7d': 7, '30d': 30 } as const;
const auditOptionsSchema = z
  .object({
    now: z.date().optional(),
    window: z.enum(['7d', '30d']).optional(),
    source: z.array(z.enum(parserNames)).optional(),
    sourceName: z.array(safeOutputLabelSchema).max(64).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const values of [value.source, value.sourceName]) {
      if (values !== undefined && new Set(values).size !== values.length) {
        ctx.addIssue({ code: 'custom', message: 'invalid_report_option' });
      }
    }
  });

export type BuildAuditReportOptions = z.input<typeof auditOptionsSchema>;

export type BuildAuditReportInput = {
  readonly events: readonly UsageEvent[];
  readonly scanRuns: readonly ScanRun[];
  readonly parsers: readonly RegisteredParser[];
  readonly options?: BuildAuditReportOptions;
};

type Bucket = { events: number; tokens: number };
type Filters = { readonly source: readonly ParserName[]; readonly sourceName: readonly string[] };

export class AuditService {
  build(input: BuildAuditReportInput): AuditReport {
    const options = parseOptions(input.options ?? {});
    const now = options.now ?? new Date();
    if (Number.isNaN(now.getTime())) throw new Error('invalid_report_option');
    const window = options.window ?? '7d';
    const filters = {
      source: canonicalSources(options.source ?? []),
      sourceName: sorted(options.sourceName ?? [])
    };
    const range = buildRange(now, window);
    validateTimestamps(input.events, input.scanRuns);
    const events = input.events.filter((event) => included(event, range, filters));
    const runs = input.scanRuns.filter((run) => includedRun(run, range, filters));
    const report = {
      version: 1,
      kind: 'audit',
      generatedAt: now.toISOString(),
      window,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      filters,
      totals: totals(events),
      pricingCoverage: pricingCoverage(events),
      sessionCoverage: sessionCoverage(events),
      sourceContracts: contracts(input.parsers, filters.source),
      scanHealth: scanHealth(runs),
      warnings: warnings(events, runs),
      privacy: { sanitized: true }
    };
    return auditReportSchema.parse(report);
  }
}

function buildRange(now: Date, window: keyof typeof windowDays) {
  return { from: new Date(now.getTime() - windowDays[window] * 86_400_000), to: now };
}

function parseOptions(options: BuildAuditReportOptions) {
  const parsed = auditOptionsSchema.safeParse(options);
  if (!parsed.success) throw new Error('invalid_report_option');
  return parsed.data;
}

function included(
  event: UsageEvent,
  range: { readonly from: Date; readonly to: Date },
  filters: Filters
): boolean {
  const time = parseStrictIsoInstant(event.timestamp);
  return (
    time > range.from.getTime() &&
    time <= range.to.getTime() &&
    (filters.source.length === 0 || filters.source.includes(event.source)) &&
    (filters.sourceName.length === 0 || filters.sourceName.includes(event.sourceName))
  );
}

function validateTimestamps(events: readonly UsageEvent[], runs: readonly ScanRun[]): void {
  if (
    events.some((event) => !isStrictIsoInstant(event.timestamp)) ||
    runs.some(hasInvalidRunTime)
  ) {
    throw new Error('invalid_report_option');
  }
}

function includedRun(
  run: ScanRun,
  range: { readonly from: Date; readonly to: Date },
  filters: Filters
): boolean {
  const time = parseStrictIsoInstant(run.startedAt);
  const sourceMatches =
    filters.source.length === 0 ||
    (run.parserName !== null &&
      isParserName(run.parserName) &&
      filters.source.includes(run.parserName));
  return (
    time > range.from.getTime() &&
    time <= range.to.getTime() &&
    sourceMatches &&
    (filters.sourceName.length === 0 || filters.sourceName.includes(run.sourceName))
  );
}

function hasInvalidRunTime(run: ScanRun): boolean {
  return (
    !isStrictIsoInstant(run.startedAt) ||
    (run.finishedAt !== null && !isStrictIsoInstant(run.finishedAt))
  );
}

function totals(events: readonly UsageEvent[]) {
  const known = events.filter((event) => event.estimatedCostUsd !== null);
  const unknown = events.filter((event) => event.estimatedCostUsd === null);
  return {
    events: events.length,
    tokens: sum(events, (event) => event.totalTokens),
    knownCostEvents: known.length,
    unknownCostEvents: unknown.length,
    knownCostTokens: sum(known, (event) => event.totalTokens),
    unknownCostTokens: sum(unknown, (event) => event.totalTokens)
  };
}

function pricingCoverage(events: readonly UsageEvent[]) {
  const value = totals(events);
  return {
    knownEvents: value.knownCostEvents,
    unknownEvents: value.unknownCostEvents,
    eventCoverageRatio: ratio(value.knownCostEvents, value.events),
    tokenCoverageRatio: ratio(value.knownCostTokens, value.tokens),
    byPricingSource: pricingSourceDistribution(events),
    byConfidence: pricingConfidenceDistribution(events)
  };
}

function pricingSourceDistribution(events: readonly UsageEvent[]) {
  return distribution(events, (event) => event.pricingSource ?? 'unknown').map(
    ([pricingSource, bucket]) => ({
      pricingSource,
      ...bucket
    })
  );
}

function pricingConfidenceDistribution(events: readonly UsageEvent[]) {
  return distribution(events, (event) => event.pricingConfidence ?? 'unknown').map(
    ([pricingConfidence, bucket]) => ({ pricingConfidence, ...bucket })
  );
}

function distribution(events: readonly UsageEvent[], keyFor: (event: UsageEvent) => string) {
  const buckets = new Map<string, Bucket>();
  for (const event of events) {
    const key = keyFor(event);
    const bucket = buckets.get(key) ?? { events: 0, tokens: 0 };
    bucket.events += 1;
    bucket.tokens += event.totalTokens;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function sessionCoverage(events: readonly UsageEvent[]) {
  const withSession = events.filter((event) => event.sessionIdHash !== null).length;
  return {
    withSession,
    withoutSession: events.length - withSession,
    coverageRatio: ratio(withSession, events.length)
  };
}

function contracts(parsers: readonly RegisteredParser[], sources: readonly ParserName[]) {
  const unique = new Map(parsers.map((parser) => [parser.name, parser]));
  const selected = parserNames.filter((source) => sources.length === 0 || sources.includes(source));
  return selected.map((source) => {
    const parser = unique.get(source);
    if (parser === undefined) throw new Error('invalid_report_option');
    return {
      source: parser.name,
      displayName: parser.displayName,
      supportStatus: parser.supportStatus,
      accountingMode: parser.accountingMode
    };
  });
}

function scanHealth(runs: readonly ScanRun[]) {
  const warningCounts = new Map<string, number>();
  for (const run of runs) {
    for (const code of new Set(run.warningCodes)) {
      warningCounts.set(code, (warningCounts.get(code) ?? 0) + 1);
    }
  }
  return {
    runs: runs.length,
    failedRuns: runs.filter((run) => run.status === 'failed').length,
    discoveredFiles: sum(runs, (run) => run.discoveredFiles),
    parsedEvents: sum(runs, (run) => run.parsedEvents),
    insertedEvents: sum(runs, (run) => run.insertedEvents),
    duplicateEvents: sum(runs, (run) => run.duplicateEvents),
    conflictEvents: sum(runs, (run) => run.conflictEvents),
    skippedRecords: sum(runs, (run) => run.skippedRecords),
    rejectedRecords: sum(runs, (run) => run.rejectedRecords),
    errorRecords: sum(runs, (run) => run.errorRecords),
    warningCodeDistribution: [...warningCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => ({ code, count }))
  };
}

function warnings(events: readonly UsageEvent[], runs: readonly ScanRun[]) {
  return [
    'billing_not_verified',
    ...(events.length === 0 ? ['no_usage_events'] : []),
    ...(events.some((event) => event.estimatedCostUsd === null) ? ['unknown_pricing_present'] : []),
    ...(events.some((event) => event.sessionIdHash === null)
      ? ['session_attribution_incomplete']
      : []),
    ...(runs.some((run) => run.status === 'failed') ? ['scan_failures_present'] : [])
  ];
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function sum<Item>(items: readonly Item[], value: (item: Item) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function sorted<Value extends string>(values: readonly Value[]): Value[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function canonicalSources(sources: readonly ParserName[]): ParserName[] {
  return parserNames.filter((source) => sources.includes(source));
}
