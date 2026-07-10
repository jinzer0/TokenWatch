import { z } from 'zod';
import type { BudgetStatus, BudgetWarningCode } from './budgetService.js';
import { safeOutputLabelSchema } from './reportContracts.js';

export const statuslineWindows = ['today', 'month'] as const;
export const statuslinePresets = ['default', 'compact', 'live'] as const;
export const statuslineMetricPresets = ['compact', 'live'] as const;
const budgetStatuses = ['ok', 'over', 'unknown-costs-present'] as const;
const presetBudgetStatuses = ['not_configured', 'ok', 'over', 'unknown-costs-present'] as const;
const budgetWarningCodes = ['budget_threshold_exceeded', 'budget_unknown_cost_present'] as const;
const budgetScopeKinds = ['monthly_total', 'sourceName'] as const;

export type StatuslineWindow = (typeof statuslineWindows)[number];
export type StatuslinePreset = (typeof statuslinePresets)[number];
export type StatuslineMetricPreset = (typeof statuslineMetricPresets)[number];

export type BuildStatuslineOptions = {
  readonly window?: unknown;
  readonly preset?: unknown;
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

type StatuslinePresetRecent = {
  readonly minutes: 10;
  readonly range: StatuslineRange;
  readonly tokens: number;
  readonly tokensPerMinute: number;
};

type StatuslinePresetBudgetPressure = {
  readonly status: (typeof presetBudgetStatuses)[number];
  readonly maxPercent: number | null;
  readonly warningCount: number;
  readonly overCount: number;
  readonly unknownCostCount: number;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
};

export type StatuslinePresetDto = {
  readonly version: 1;
  readonly kind: 'statusline-preset';
  readonly preset: StatuslineMetricPreset;
  readonly generatedAt: string;
  readonly window: StatuslineWindow;
  readonly range: StatuslineRange;
  readonly totals: StatuslineTotals;
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: number;
  readonly unknownCostTokens: number;
  readonly recent: StatuslinePresetRecent;
  readonly budgetPressure: StatuslinePresetBudgetPressure;
  readonly top: StatuslineTopLabels;
  readonly privacy: { readonly sanitized: true };
};

const outputLabelSchema = safeOutputLabelSchema;

const rangeSchema = z
  .object({ label: outputLabelSchema, from: z.string().datetime(), to: z.string().datetime() })
  .strict();

const totalsSchema = z
  .object({
    events: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cachedTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative().nullable()
  })
  .strict();

export const statuslineSchema: z.ZodType<StatuslineDto> = z
  .object({
    version: z.literal(1),
    kind: z.literal('statusline'),
    generatedAt: z.string().datetime({ offset: true }),
    window: z.enum(statuslineWindows),
    range: rangeSchema,
    totals: totalsSchema,
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
              sourceName: outputLabelSchema.nullable(),
              month: outputLabelSchema,
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
      .object({
        model: outputLabelSchema,
        sourceName: outputLabelSchema,
        project: outputLabelSchema
      })
      .strict(),
    privacy: z.object({ sanitized: z.literal(true) }).strict()
  })
  .strict();

export const statuslinePresetSchema: z.ZodType<StatuslinePresetDto> = z
  .object({
    version: z.literal(1),
    kind: z.literal('statusline-preset'),
    preset: z.enum(statuslineMetricPresets),
    generatedAt: z.string().datetime({ offset: true }),
    window: z.enum(statuslineWindows),
    range: rangeSchema,
    totals: totalsSchema,
    knownEstimatedCostUsd: z.number().nonnegative().nullable(),
    unknownCostEvents: z.number().int().nonnegative(),
    unknownCostTokens: z.number().int().nonnegative(),
    recent: z
      .object({
        minutes: z.literal(10),
        range: rangeSchema,
        tokens: z.number().int().nonnegative(),
        tokensPerMinute: z.number().nonnegative()
      })
      .strict(),
    budgetPressure: z
      .object({
        status: z.enum(presetBudgetStatuses),
        maxPercent: z.number().nonnegative().nullable(),
        warningCount: z.number().int().nonnegative(),
        overCount: z.number().int().nonnegative(),
        unknownCostCount: z.number().int().nonnegative(),
        unknownCostEvents: z.number().int().nonnegative(),
        unknownCostTokens: z.number().int().nonnegative()
      })
      .strict(),
    top: z
      .object({
        model: outputLabelSchema,
        sourceName: outputLabelSchema,
        project: outputLabelSchema
      })
      .strict(),
    privacy: z.object({ sanitized: z.literal(true) }).strict()
  })
  .strict();
