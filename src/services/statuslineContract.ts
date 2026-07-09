import { z } from 'zod';
import { containsUnsafePrivacyShape } from '../privacy.js';
import type { BudgetStatus, BudgetWarningCode } from './budgetService.js';

export const statuslineWindows = ['today', 'month'] as const;
const budgetStatuses = ['ok', 'over', 'unknown-costs-present'] as const;
const budgetWarningCodes = ['budget_threshold_exceeded', 'budget_unknown_cost_present'] as const;
const budgetScopeKinds = ['monthly_total', 'sourceName'] as const;

export type StatuslineWindow = (typeof statuslineWindows)[number];

export type BuildStatuslineOptions = {
  readonly window?: unknown;
  readonly now?: Date;
  readonly budgets?: readonly import('./budgetService.js').BudgetEvaluation[];
};

type StatuslineRange = {
  readonly label: string;
  readonly from: string;
  readonly to: string;
};

type StatuslineTotals = {
  readonly events: number;
  readonly tokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly estimatedCostUsd: number | null;
};

export type StatuslineBudgetRow = {
  readonly scopeKind: 'monthly_total' | 'sourceName';
  readonly sourceName: string | null;
  readonly month: string;
  readonly status: BudgetStatus;
  readonly knownSpendUsd: number;
  readonly thresholdUsd: number;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
  readonly warnings: readonly BudgetWarningCode[];
};

export type StatuslineBudgets = {
  readonly warningCount: number;
  readonly overCount: number;
  readonly unknownCostCount: number;
  readonly rows: readonly StatuslineBudgetRow[];
};

export type StatuslineTopLabels = {
  readonly model: string;
  readonly sourceName: string;
  readonly project: string;
};

export type StatuslineDto = {
  readonly version: 1;
  readonly kind: 'statusline';
  readonly generatedAt: string;
  readonly window: StatuslineWindow;
  readonly range: StatuslineRange;
  readonly totals: StatuslineTotals;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
  readonly budgets: StatuslineBudgets;
  readonly top: StatuslineTopLabels;
  readonly privacy: { readonly sanitized: true };
};

const safeLabelSchema = z.string().superRefine((value, ctx) => {
  if (containsUnsafePrivacyShape(value)) {
    ctx.addIssue({ code: 'custom', message: 'unsafe_statusline_label' });
  }
});

export const statuslineSchema: z.ZodType<StatuslineDto> = z
  .object({
    version: z.literal(1),
    kind: z.literal('statusline'),
    generatedAt: z.string().datetime({ offset: true }),
    window: z.enum(statuslineWindows),
    range: z
      .object({ label: safeLabelSchema, from: z.string().datetime(), to: z.string().datetime() })
      .strict(),
    totals: z
      .object({
        events: z.number().int().nonnegative(),
        tokens: z.number().int().nonnegative(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        cachedTokens: z.number().int().nonnegative(),
        estimatedCostUsd: z.number().nonnegative().nullable()
      })
      .strict(),
    knownEstimatedCostUsd: z.number().nonnegative().nullable(),
    unknownCostEvents: z.number().int().nonnegative(),
    unknownCostTokens: z.number().int().nonnegative(),
    budgets: z
      .object({
        warningCount: z.number().int().nonnegative(),
        overCount: z.number().int().nonnegative(),
        unknownCostCount: z.number().int().nonnegative(),
        rows: z.array(
          z
            .object({
              scopeKind: z.enum(budgetScopeKinds),
              sourceName: safeLabelSchema.nullable(),
              month: safeLabelSchema,
              status: z.enum(budgetStatuses),
              knownSpendUsd: z.number().nonnegative(),
              thresholdUsd: z.number().nonnegative(),
              unknownCostEvents: z.number().int().nonnegative(),
              unknownCostTokens: z.number().int().nonnegative(),
              warnings: z.array(z.enum(budgetWarningCodes))
            })
            .strict()
        )
      })
      .strict(),
    top: z
      .object({ model: safeLabelSchema, sourceName: safeLabelSchema, project: safeLabelSchema })
      .strict(),
    privacy: z.object({ sanitized: z.literal(true) }).strict()
  })
  .strict();
