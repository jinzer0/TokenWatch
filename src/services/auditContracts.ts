import { z } from 'zod';
import { pricingLabelSchema } from '../models/usageEvent.js';
import { parserNames } from '../parsers/base.js';
import { listParserMetadata } from '../parsers/registry.js';
import { safeOutputLabelSchema, validateSafeReportJson } from './insightsContracts.js';

const auditWindows = ['7d', '30d'] as const;
const supportStatuses = ['real_parser', 'unsupported_status_parser'] as const;
const accountingModes = [
  'direct',
  'delta',
  'aggregate',
  'mixed',
  'telemetry',
  'unsupported'
] as const;
const scanWarningCodes = [
  'malformed_jsonl_records',
  'malformed_json',
  'unsupported_json_root',
  'unsupported_artifact',
  'empty_or_unreadable',
  'sqlite_schema_unrecognized',
  'sqlite_missing_columns',
  'sqlite_unreadable',
  'privacy_rejected',
  'parser_warning'
] as const;
const auditWarningCodes = [
  'billing_not_verified',
  'no_usage_events',
  'unknown_pricing_present',
  'session_attribution_incomplete',
  'scan_failures_present',
  ...scanWarningCodes
] as const;
const maxSourceNameFilters = 64;
const maxPricingDistributionLabels = 64;

const countSchema = z.number().int().nonnegative();
const ratioSchema = z.number().min(0).max(1).nullable();
const dateTimeSchema = z.string().datetime({ offset: true });
const privacySchema = z.object({ sanitized: z.literal(true) }).strict();
const rangeSchema = z.object({ from: dateTimeSchema, to: dateTimeSchema }).strict();
const filtersSchema = z
  .object({
    source: z
      .array(z.enum(parserNames))
      .max(parserNames.length)
      .superRefine((sources, ctx) => addDuplicateIssues(sources, ctx)),
    sourceName: z
      .array(safeOutputLabelSchema)
      .max(maxSourceNameFilters)
      .superRefine((sourceNames, ctx) => addDuplicateIssues(sourceNames, ctx))
  })
  .strict();
const totalsSchema = z
  .object({
    events: countSchema,
    tokens: countSchema,
    knownCostEvents: countSchema,
    unknownCostEvents: countSchema,
    knownCostTokens: countSchema,
    unknownCostTokens: countSchema
  })
  .strict();
const distributionSchema = z.object({ events: countSchema, tokens: countSchema }).strict();
const pricingDistributionLabelSchema = pricingLabelSchema.pipe(z.string());
const sourceContractsSchema = z
  .array(
    z
      .object({
        source: z.enum(parserNames),
        displayName: safeOutputLabelSchema,
        supportStatus: z.enum(supportStatuses),
        accountingMode: z.enum(accountingModes)
      })
      .strict()
  )
  .max(parserNames.length)
  .superRefine((contracts, ctx) =>
    addDuplicateIssues(
      contracts.map((contract) => contract.source),
      ctx
    )
  );

function addDuplicateIssues(values: readonly string[], ctx: z.RefinementCtx): void {
  if (new Set(values).size !== values.length) {
    ctx.addIssue({ code: 'custom', message: 'invalid_report_option' });
  }
}

export const auditReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('audit'),
    generatedAt: dateTimeSchema,
    window: z.enum(auditWindows),
    range: rangeSchema,
    filters: filtersSchema,
    totals: totalsSchema,
    pricingCoverage: z
      .object({
        knownEvents: countSchema,
        unknownEvents: countSchema,
        eventCoverageRatio: ratioSchema,
        tokenCoverageRatio: ratioSchema,
        byPricingSource: z
          .array(
            z
              .object({
                pricingSource: pricingDistributionLabelSchema,
                ...distributionSchema.shape
              })
              .strict()
          )
          .max(maxPricingDistributionLabels)
          .superRefine((rows, ctx) =>
            addDuplicateIssues(
              rows.map((row) => row.pricingSource),
              ctx
            )
          ),
        byConfidence: z
          .array(
            z
              .object({
                pricingConfidence: pricingDistributionLabelSchema,
                ...distributionSchema.shape
              })
              .strict()
          )
          .max(maxPricingDistributionLabels)
          .superRefine((rows, ctx) =>
            addDuplicateIssues(
              rows.map((row) => row.pricingConfidence),
              ctx
            )
          )
      })
      .strict(),
    sessionCoverage: z
      .object({ withSession: countSchema, withoutSession: countSchema, coverageRatio: ratioSchema })
      .strict(),
    sourceContracts: sourceContractsSchema,
    scanHealth: z
      .object({
        runs: countSchema,
        failedRuns: countSchema,
        discoveredFiles: countSchema,
        parsedEvents: countSchema,
        insertedEvents: countSchema,
        duplicateEvents: countSchema,
        conflictEvents: countSchema,
        skippedRecords: countSchema,
        rejectedRecords: countSchema,
        errorRecords: countSchema,
        warningCodeDistribution: z
          .array(z.object({ code: z.enum(scanWarningCodes), count: countSchema }).strict())
          .max(scanWarningCodes.length)
          .superRefine((rows, ctx) =>
            addDuplicateIssues(
              rows.map((row) => row.code),
              ctx
            )
          )
      })
      .strict(),
    warnings: z.array(z.enum(auditWarningCodes)).max(8),
    privacy: privacySchema
  })
  .strict()
  .superRefine((value, ctx) => {
    validateSafeReportJson(value, ctx);
    const from = new Date(value.range.from).getTime();
    const to = new Date(value.range.to).getTime();
    const duration = value.window === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
    if (from >= to || value.generatedAt !== value.range.to || to - from !== duration) {
      addInvalidReportOption(ctx, ['range']);
    }
    const expectedSources = parserNames.filter(
      (source) => value.filters.source.length === 0 || value.filters.source.includes(source)
    );
    const contractSources = value.sourceContracts.map((contract) => contract.source);
    if (
      contractSources.length !== expectedSources.length ||
      contractSources.some((source, index) => source !== expectedSources[index])
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalid_report_option', path: ['sourceContracts'] });
    }
    for (const contract of value.sourceContracts) {
      const parser = listParserMetadata().find(({ name }) => name === contract.source);
      if (
        parser === undefined ||
        parser.displayName !== contract.displayName ||
        parser.supportStatus !== contract.supportStatus ||
        parser.accountingMode !== contract.accountingMode
      ) {
        addInvalidReportOption(ctx, ['sourceContracts']);
      }
    }
    const { totals, pricingCoverage, sessionCoverage, scanHealth } = value;
    const sourceDistribution = distributionTotals(pricingCoverage.byPricingSource);
    const confidenceDistribution = distributionTotals(pricingCoverage.byConfidence);
    if (
      totals.knownCostEvents + totals.unknownCostEvents !== totals.events ||
      totals.knownCostTokens + totals.unknownCostTokens !== totals.tokens ||
      pricingCoverage.knownEvents !== totals.knownCostEvents ||
      pricingCoverage.unknownEvents !== totals.unknownCostEvents ||
      !matchesRatio(pricingCoverage.eventCoverageRatio, totals.knownCostEvents, totals.events) ||
      !matchesRatio(pricingCoverage.tokenCoverageRatio, totals.knownCostTokens, totals.tokens) ||
      sourceDistribution.events !== totals.events ||
      sourceDistribution.tokens !== totals.tokens ||
      confidenceDistribution.events !== totals.events ||
      confidenceDistribution.tokens !== totals.tokens ||
      sessionCoverage.withSession + sessionCoverage.withoutSession !== totals.events ||
      !matchesRatio(sessionCoverage.coverageRatio, sessionCoverage.withSession, totals.events) ||
      scanHealth.failedRuns > scanHealth.runs
    ) {
      addInvalidReportOption(ctx);
    }
  });

export type AuditReport = z.infer<typeof auditReportSchema>;

function addInvalidReportOption(ctx: z.RefinementCtx, path: (string | number)[] = []): void {
  ctx.addIssue({ code: 'custom', message: 'invalid_report_option', path });
}

function distributionTotals(rows: readonly { readonly events: number; readonly tokens: number }[]) {
  return rows.reduce(
    (total, row) => ({ events: total.events + row.events, tokens: total.tokens + row.tokens }),
    { events: 0, tokens: 0 }
  );
}

function matchesRatio(value: number | null, numerator: number, denominator: number): boolean {
  return value === (denominator === 0 ? null : numerator / denominator);
}
