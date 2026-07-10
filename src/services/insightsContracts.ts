import { z } from 'zod';
import { containsUnsafeOutputLabelShape } from '../privacy.js';

const reportWindows = ['7d', '30d'] as const;
const confidenceLevels = ['high', 'medium', 'low'] as const;
const ratioStatuses = ['ok', 'insufficient-data'] as const;
const budgetPressureStatuses = ['not_configured', 'ok', 'over', 'unknown-costs-present'] as const;
const pricingStatuses = ['known', 'unknown'] as const;
const trendDirections = ['up', 'down', 'flat', 'new', 'unknown'] as const;
const trendMetrics = ['events', 'tokens', 'cost'] as const;
const trendScopes = ['all-events-rolling'] as const;
const trendRowCategories = ['total', 'model', 'source', 'sourceName', 'project'] as const;

const forbiddenOutputKeyPattern =
  /^(metadata|rawIdHash|rawSessionId|rawPath|rawRecord|prompt|response|credential|credentials|sql|stackTrace)$/i;
const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const sanitizedPrivacySchema = z.object({ sanitized: z.literal(true) }).strict();

function addInvalidReportOption(ctx: z.RefinementCtx, path: (string | number)[] = []): void {
  ctx.addIssue({ code: 'custom', message: 'invalid_report_option', path });
}

function isUnsafeOutputLabel(value: string): boolean {
  return containsUnsafeOutputLabelShape(value);
}

export const safeOutputLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (isUnsafeOutputLabel(value)) addInvalidReportOption(ctx);
  });

export type SafeOutputLabel = z.infer<typeof safeOutputLabelSchema>;

export function safeOutputLabel(value: string): SafeOutputLabel {
  return safeOutputLabelSchema.parse(value);
}

export function assertSafeOutputText(value: string): void {
  if (isUnsafeOutputLabel(value)) throw new Error('invalid_report_option');
}

function validateSafeReportJson(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[] = []
): void {
  if (typeof value === 'string') {
    if (isUnsafeOutputLabel(value)) addInvalidReportOption(ctx, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSafeReportJson(item, ctx, [...path, index]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenOutputKeyPattern.test(key) || isUnsafeOutputLabel(key)) {
        addInvalidReportOption(ctx, [...path, key]);
      }
      validateSafeReportJson(child, ctx, [...path, key]);
    }
  }
}

function reportWindowSchema() {
  return z
    .string()
    .default('7d')
    .transform((value, ctx) => {
      if (value === '7d' || value === '30d') return value;
      addInvalidReportOption(ctx, ['window']);
      return z.NEVER;
    });
}

export const insightsReportOptionsSchema = z.object({ window: reportWindowSchema() }).strict();
export const trendReportOptionsSchema = z.object({ window: reportWindowSchema() }).strict();

export type InsightsReportOptions = z.infer<typeof insightsReportOptionsSchema>;
export type TrendReportOptions = z.infer<typeof trendReportOptionsSchema>;

const dateRangeSchema = z.object({ from: isoDateTimeSchema, to: isoDateTimeSchema }).strict();

const strictCostTotalsSchema = z
  .object({
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    knownEstimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

const insightsTotalsSchema = strictCostTotalsSchema
  .extend({
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    reasoningTokens: positiveIntegerSchema
  })
  .strict();

const topAggregateRowSchema = insightsTotalsSchema
  .extend({ label: safeOutputLabelSchema })
  .strict();

const topAggregateRowsSchema = z
  .object({
    models: z.array(topAggregateRowSchema),
    sources: z.array(topAggregateRowSchema),
    sourceNames: z.array(topAggregateRowSchema),
    projects: z.array(topAggregateRowSchema)
  })
  .strict();

const ratioMetricSchema = z
  .object({ status: z.enum(ratioStatuses), value: nonNegativeNumberSchema.nullable() })
  .strict();

const unknownPricingImpactSchema = z
  .object({
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema,
    unknownTokenShare: nonNegativeNumberSchema.max(1),
    knownEstimatedCostUsd: nullableCostSchema
  })
  .strict();

const proxyMetricRowSchema = z
  .object({ label: safeOutputLabelSchema, value: nonNegativeNumberSchema })
  .strict();

const reworkRatioSchema = z
  .object({
    status: z.literal('insufficient-data'),
    value: z.null(),
    proxies: z.array(proxyMetricRowSchema)
  })
  .strict();

const costDriverCandidateSchema = z
  .object({
    label: safeOutputLabelSchema,
    pricingStatus: z.enum(pricingStatuses),
    knownTokens: positiveIntegerSchema,
    knownCostUsd: nullableCostSchema,
    effectiveCostPerMillionTokens: nonNegativeNumberSchema.nullable(),
    knownSpendShare: nonNegativeNumberSchema.max(1).nullable(),
    expensiveRelativeToMedian: z.boolean(),
    spendDriverCandidate: z.boolean()
  })
  .strict();

const budgetPressureSchema = z
  .object({
    status: z.enum(budgetPressureStatuses),
    ratio: nonNegativeNumberSchema.nullable(),
    knownSpendUsd: nullableCostSchema,
    thresholdUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

const confidenceSchema = z
  .object({ level: z.enum(confidenceLevels), reasons: z.array(safeOutputLabelSchema) })
  .strict();

export const insightsReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('insights'),
    generatedAt: isoDateTimeSchema,
    window: z.enum(reportWindows),
    range: dateRangeSchema,
    totals: insightsTotalsSchema,
    cacheHitRatio: ratioMetricSchema,
    unknownPricingImpact: unknownPricingImpactSchema,
    reasoningToOutputRatio: ratioMetricSchema,
    reworkRatio: reworkRatioSchema,
    topRows: topAggregateRowsSchema,
    costDriverCandidates: z.array(costDriverCandidateSchema),
    budgetPressure: budgetPressureSchema,
    warnings: z.array(safeOutputLabelSchema),
    confidence: confidenceSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeReportJson(value, ctx));

export type InsightsReport = z.infer<typeof insightsReportSchema>;

const trendTotalsSchema = z
  .object({
    current: insightsTotalsSchema,
    previous: insightsTotalsSchema,
    deltaPercent: z.number().nullable(),
    direction: z.enum(trendDirections)
  })
  .strict();

const trendRatioComparisonSchema = z
  .object({
    current: ratioMetricSchema,
    previous: ratioMetricSchema,
    deltaPercent: z.number().nullable(),
    direction: z.enum(trendDirections)
  })
  .strict();

const trendRowSchema = z
  .object({
    category: z.enum(trendRowCategories),
    label: safeOutputLabelSchema,
    metric: z.enum(trendMetrics),
    current: insightsTotalsSchema,
    previous: insightsTotalsSchema,
    deltaPercent: z.number().nullable(),
    direction: z.enum(trendDirections)
  })
  .strict();

export const trendReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('trend'),
    generatedAt: isoDateTimeSchema,
    window: z.enum(reportWindows),
    trendScope: z.enum(trendScopes),
    range: z.object({ current: dateRangeSchema, previous: dateRangeSchema }).strict(),
    totals: trendTotalsSchema,
    cacheHitRatio: trendRatioComparisonSchema,
    budgetPressure: budgetPressureSchema,
    rows: z.array(trendRowSchema),
    warnings: z.array(safeOutputLabelSchema),
    confidence: confidenceSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeReportJson(value, ctx));

export type TrendReport = z.infer<typeof trendReportSchema>;

export const insightsCommandReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('insights-command'),
    generatedAt: isoDateTimeSchema,
    window: z.enum(reportWindows),
    insights: insightsReportSchema,
    trend: trendReportSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeReportJson(value, ctx));

export type InsightsCommandReport = z.infer<typeof insightsCommandReportSchema>;
