import { z } from 'zod';

const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();

const unsafePrivacyPattern =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH|STACK_TRACE|SQL_PAYLOAD)_SENTINEL_DO_NOT_LEAK|api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|select\s+.+\s+from\s+|insert\s+into\s+|\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)|(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;

const safeLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (unsafePrivacyPattern.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'desktop_dashboard_payload_rejected' });
    }
  });

const budgetWarningCodeSchema = z.enum([
  'budget_threshold_exceeded',
  'budget_unknown_cost_present'
]);

export const dashboardBudgetDiagnosticSchema = z
  .object({
    periodLabel: z.literal('current month'),
    month: safeLabelSchema.max(16),
    scopeKind: z.enum(['monthly_total', 'sourceName']),
    sourceName: safeLabelSchema.nullable(),
    knownSpendUsd: nonNegativeNumberSchema,
    thresholdUsd: nonNegativeNumberSchema,
    status: z.enum(['ok', 'over', 'unknown-costs-present']),
    unknownCostEventCount: positiveIntegerSchema,
    unknownCostTokenCount: positiveIntegerSchema,
    warningCodes: z.array(budgetWarningCodeSchema),
    recommendedAction: z.enum(['review budget threshold', 'add custom price', 'no action'])
  })
  .strict();

export const dashboardPricingDiagnosticSchema = z
  .object({
    provider: safeLabelSchema.nullable(),
    model: safeLabelSchema,
    diagnosticStatus: z.enum([
      'exact-match',
      'alias-match',
      'provider-prefix-match',
      'cursor-override',
      'fuzzy-match',
      'unresolved',
      'negative-cache',
      'network-fallback'
    ]),
    cacheStatus: z.enum(['matched-cache', 'negative-cache', 'network-fallback', 'not-cached']),
    pricingSource: safeLabelSchema.nullable(),
    pricingConfidence: safeLabelSchema.nullable(),
    matchedKey: safeLabelSchema.nullable(),
    events: positiveIntegerSchema,
    totalTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    unknownCostEventCount: positiveIntegerSchema,
    unknownCostTokenCount: positiveIntegerSchema,
    recommendedAction: z.enum([
      'retry pricing lookup',
      'add custom price',
      'confirm fuzzy match',
      'verify mapped price',
      'no action'
    ])
  })
  .strict();

export type DesktopDashboardBudgetDiagnostic = z.infer<typeof dashboardBudgetDiagnosticSchema>;
export type DesktopDashboardPricingDiagnostic = z.infer<typeof dashboardPricingDiagnosticSchema>;
