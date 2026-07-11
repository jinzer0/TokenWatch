import { z } from 'zod';
import { containsUnsafePrivacyShape } from '../privacy.js';
import { safeOutputLabelSchema } from './insightsContracts.js';

const budgetStatusValues = ['ok', 'warning', 'exceeded', 'unknown'] as const;
const watchBudgetStatusValues = ['not_configured', ...budgetStatusValues] as const;
const budgetWarningCodes = ['budget_threshold_exceeded', 'budget_unknown_cost_present'] as const;
const budgetScopeKinds = ['monthly_total', 'sourceName'] as const;
const heatmapMetrics = ['tokens', 'events', 'cost'] as const;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();
const privacySchema = z.object({ sanitized: z.literal(true) }).strict();

function addPrivacyIssue(ctx: z.RefinementCtx, path: (string | number)[]): void {
  ctx.addIssue({ code: 'custom', message: 'headless_payload_rejected', path });
}

function validateSafeJson(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[] = []
): void {
  if (typeof value === 'string') {
    if (containsUnsafePrivacyShape(value)) addPrivacyIssue(ctx, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSafeJson(item, ctx, [...path, index]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (containsUnsafePrivacyShape(key)) addPrivacyIssue(ctx, [...path, key]);
      validateSafeJson(child, ctx, [...path, key]);
    }
  }
}

const progressSchema = z
  .object({
    width: z.number().int().nonnegative(),
    filled: z.number().int().nonnegative(),
    empty: z.number().int().nonnegative(),
    label: safeOutputLabelSchema
  })
  .strict();

const budgetStatusRowSchema = z
  .object({
    scopeKind: z.enum(budgetScopeKinds),
    label: safeOutputLabelSchema,
    sourceName: safeOutputLabelSchema.nullable(),
    month: safeOutputLabelSchema,
    status: z.enum(budgetStatusValues),
    knownSpendUsd: nonNegativeNumberSchema,
    thresholdUsd: nonNegativeNumberSchema,
    percent: nonNegativeNumberSchema.nullable(),
    progress: progressSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema,
    warnings: z.array(z.enum(budgetWarningCodes))
  })
  .strict();

const budgetSummarySchema = z
  .object({
    total: positiveIntegerSchema,
    ok: positiveIntegerSchema,
    warning: positiveIntegerSchema,
    exceeded: positiveIntegerSchema,
    unknown: positiveIntegerSchema
  })
  .strict();

export const budgetStatusReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('budget_status'),
    generatedAt: isoDateTimeSchema,
    rows: z.array(budgetStatusRowSchema),
    summary: budgetSummarySchema,
    privacy: privacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type BudgetStatusReport = z.infer<typeof budgetStatusReportSchema>;

const usageTotalsSchema = z
  .object({
    events: positiveIntegerSchema,
    totalTokens: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    reasoningTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

const topLabelsSchema = z
  .object({
    model: safeOutputLabelSchema,
    source: safeOutputLabelSchema,
    sourceName: safeOutputLabelSchema,
    agent: safeOutputLabelSchema,
    project: safeOutputLabelSchema
  })
  .strict();

export const watchTickReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('watch_tick'),
    timestamp: isoDateTimeSchema,
    intervalMs: z.number().int().positive(),
    delta: usageTotalsSchema,
    velocity: z
      .object({
        tokensPerMinute: nonNegativeNumberSchema,
        estimatedCostUsdPerHour: nullableCostSchema
      })
      .strict(),
    top: topLabelsSchema,
    budgets: z
      .object({
        status: z.enum(watchBudgetStatusValues),
        warningCount: positiveIntegerSchema,
        exceededCount: positiveIntegerSchema,
        unknownCount: positiveIntegerSchema,
        rows: z.array(budgetStatusRowSchema)
      })
      .strict(),
    privacy: privacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type WatchTickReport = z.infer<typeof watchTickReportSchema>;

const heatmapDaySchema = z
  .object({
    date: safeOutputLabelSchema,
    value: nonNegativeNumberSchema,
    level: z.number().int().min(0).max(5),
    events: positiveIntegerSchema,
    totalTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema
  })
  .strict();

const heatmapLegendItemSchema = z
  .object({
    level: z.number().int().min(0).max(5),
    label: safeOutputLabelSchema,
    symbol: safeOutputLabelSchema
  })
  .strict();

export const heatmapReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('heatmap'),
    generatedAt: isoDateTimeSchema,
    year: z.number().int().min(1970).max(9999),
    metric: z.enum(heatmapMetrics),
    range: z.object({ from: isoDateTimeSchema, to: isoDateTimeSchema }).strict(),
    totals: z
      .object({
        events: positiveIntegerSchema,
        totalTokens: positiveIntegerSchema,
        estimatedCostUsd: nullableCostSchema,
        unknownCostEvents: positiveIntegerSchema
      })
      .strict(),
    days: z.array(heatmapDaySchema),
    legend: z.array(heatmapLegendItemSchema),
    privacy: privacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type HeatmapReport = z.infer<typeof heatmapReportSchema>;
