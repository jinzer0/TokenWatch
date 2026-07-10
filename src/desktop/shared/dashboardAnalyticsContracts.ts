import { z } from 'zod';

const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const sanitizedPrivacySchema = z.object({ sanitized: z.literal(true) }).strict();
const reportWindows = ['7d', '30d'] as const;
const confidenceLevels = ['high', 'medium', 'low'] as const;
const ratioStatuses = ['ok', 'insufficient-data'] as const;
const budgetPressureStatuses = ['not_configured', 'ok', 'over', 'unknown-costs-present'] as const;
const pricingStatuses = ['known', 'unknown'] as const;
const trendDirections = ['up', 'down', 'flat', 'new', 'unknown'] as const;
const trendMetrics = ['events', 'tokens', 'cost'] as const;
const trendRowCategories = ['total', 'model', 'source', 'sourceName', 'project'] as const;

const unsafePrivacyPattern =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH|STACK_TRACE|SQL_PAYLOAD)_SENTINEL_DO_NOT_LEAK|api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|\b(select\s+.+\s+from|insert\s+into|update\s+[a-z0-9_]+\s+set|delete\s+from|drop\s+table)\b|\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)|(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;

const safeLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (unsafePrivacyPattern.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'invalid_report_option' });
    }
  });

export const dashboardStrictCostSchema = z
  .object({
    estimatedCostUsd: nullableCostSchema,
    knownEstimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

const dashboardInsightTotalsSchema = dashboardStrictCostSchema
  .extend({
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    reasoningTokens: positiveIntegerSchema
  })
  .strict();

const dashboardRatioMetricSchema = z
  .object({ status: z.enum(ratioStatuses), value: nonNegativeNumberSchema.nullable() })
  .strict();

const dashboardUnknownPricingImpactSchema = z
  .object({
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema,
    unknownTokenShare: nonNegativeNumberSchema.max(1),
    knownEstimatedCostUsd: nullableCostSchema
  })
  .strict();

const dashboardTopAggregateRowSchema = dashboardInsightTotalsSchema
  .extend({ label: safeLabelSchema })
  .strict();

const dashboardTopRowsSchema = z
  .object({
    models: z.array(dashboardTopAggregateRowSchema),
    sources: z.array(dashboardTopAggregateRowSchema),
    sourceNames: z.array(dashboardTopAggregateRowSchema),
    projects: z.array(dashboardTopAggregateRowSchema)
  })
  .strict();

const dashboardCostDriverCandidateSchema = z
  .object({
    label: safeLabelSchema,
    pricingStatus: z.enum(pricingStatuses),
    knownTokens: positiveIntegerSchema,
    knownCostUsd: nullableCostSchema,
    effectiveCostPerMillionTokens: nonNegativeNumberSchema.nullable(),
    knownSpendShare: nonNegativeNumberSchema.max(1).nullable(),
    expensiveRelativeToMedian: z.boolean(),
    spendDriverCandidate: z.boolean()
  })
  .strict();

const dashboardBudgetPressureSchema = z
  .object({
    status: z.enum(budgetPressureStatuses),
    ratio: nonNegativeNumberSchema.nullable(),
    knownSpendUsd: nullableCostSchema,
    thresholdUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

const dashboardConfidenceSchema = z
  .object({ level: z.enum(confidenceLevels), reasons: z.array(safeLabelSchema) })
  .strict();

export const dashboardInsightsSchema = z
  .object({
    window: z.enum(reportWindows),
    range: z.object({ from: isoDateTimeSchema, to: isoDateTimeSchema }).strict(),
    cards: z
      .object({
        totals: dashboardInsightTotalsSchema,
        cacheHitRatio: dashboardRatioMetricSchema,
        unknownPricingImpact: dashboardUnknownPricingImpactSchema,
        reasoningToOutputRatio: dashboardRatioMetricSchema,
        budgetPressure: dashboardBudgetPressureSchema
      })
      .strict(),
    topRows: dashboardTopRowsSchema,
    costDriverCandidates: z.array(dashboardCostDriverCandidateSchema),
    warnings: z.array(safeLabelSchema),
    confidence: dashboardConfidenceSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict();

const dashboardTrendCostTotalsSchema = dashboardStrictCostSchema
  .extend({
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    reasoningTokens: positiveIntegerSchema
  })
  .strict();

const dashboardTrendTotalsSchema = z
  .object({
    current: dashboardTrendCostTotalsSchema,
    previous: dashboardTrendCostTotalsSchema,
    deltaPercent: z.number().nullable(),
    direction: z.enum(trendDirections)
  })
  .strict();

const dashboardTrendRatioComparisonSchema = z
  .object({
    current: dashboardRatioMetricSchema,
    previous: dashboardRatioMetricSchema,
    deltaPercent: z.number().nullable(),
    direction: z.enum(trendDirections)
  })
  .strict();

const dashboardTrendCardSchema = dashboardTrendTotalsSchema
  .extend({
    window: z.enum(reportWindows),
    metric: z.enum(trendMetrics),
    trendScope: z.literal('all-events-rolling'),
    label: z.literal('all-events rolling trend')
  })
  .strict();

const dashboardTrendRowSchema = dashboardTrendTotalsSchema
  .extend({
    category: z.enum(trendRowCategories),
    label: safeLabelSchema,
    metric: z.enum(trendMetrics)
  })
  .strict();

const dashboardTrendWindowSchema = z
  .object({
    window: z.enum(reportWindows),
    trendScope: z.literal('all-events-rolling'),
    range: z
      .object({
        current: z.object({ from: isoDateTimeSchema, to: isoDateTimeSchema }).strict(),
        previous: z.object({ from: isoDateTimeSchema, to: isoDateTimeSchema }).strict()
      })
      .strict(),
    totals: dashboardTrendTotalsSchema,
    cacheHitRatio: dashboardTrendRatioComparisonSchema,
    budgetPressure: dashboardBudgetPressureSchema,
    cards: z.array(dashboardTrendCardSchema),
    chartRows: z.array(dashboardTrendRowSchema),
    warnings: z.array(safeLabelSchema),
    confidence: dashboardConfidenceSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict();

export const dashboardTrendsSchema = z
  .object({
    trendScope: z.literal('all-events-rolling'),
    label: z.literal('all-events rolling trend'),
    windows: z.array(dashboardTrendWindowSchema),
    privacy: sanitizedPrivacySchema
  })
  .strict();

export type DesktopDashboardInsights = z.infer<typeof dashboardInsightsSchema>;
export type DesktopDashboardTrends = z.infer<typeof dashboardTrendsSchema>;
