import type {
  DesktopDashboardBudgetDiagnostic,
  DesktopDashboardPricingDiagnostic
} from '../desktop/shared/contracts.js';
import type { UsageEvent } from '../models/usageEvent.js';
import type { PricingDiagnosticGroup } from './aggregator.js';
import type { BudgetEvaluation } from './budgetService.js';

export function toDashboardBudgetDiagnostics(
  budgets: readonly BudgetEvaluation[]
): DesktopDashboardBudgetDiagnostic[] {
  return budgets.map((budget) => {
    const warningCodes = budget.warningRows.map((warning) => warning.code);
    return {
      periodLabel: 'current month',
      month: budget.month,
      scopeKind: budget.scopeKind,
      sourceName: budget.sourceName,
      knownSpendUsd: budget.knownSpendUsd,
      thresholdUsd: budget.thresholdUsd,
      status: budget.status,
      unknownCostEventCount: budget.unknownCostEventCount,
      unknownCostTokenCount: budget.unknownCostTokenCount,
      warningCodes,
      recommendedAction: recommendedBudgetAction(warningCodes)
    };
  });
}

export function toDashboardPricingDiagnostics(
  groups: readonly PricingDiagnosticGroup[],
  events: readonly UsageEvent[]
): DesktopDashboardPricingDiagnostic[] {
  const unknownStats = unknownCostStatsByModel(events);
  return groups.map((group) => {
    const stats = unknownStats.get(group.key) ?? { events: 0, tokens: 0 };
    return {
      provider: group.provider ?? null,
      model: group.key,
      diagnosticStatus: group.diagnosticStatus,
      cacheStatus: group.cacheStatus,
      pricingSource: group.pricingSource ?? null,
      pricingConfidence: group.pricingConfidence ?? null,
      matchedKey: group.matchedKey,
      events: group.events,
      totalTokens: group.totalTokens,
      estimatedCostUsd: group.estimatedCostUsd,
      unknownCostEventCount: stats.events,
      unknownCostTokenCount: stats.tokens,
      recommendedAction: toPricingRecommendedAction(group.recommendedAction)
    };
  });
}

function recommendedBudgetAction(
  warningCodes: readonly BudgetEvaluation['warningRows'][number]['code'][]
): DesktopDashboardBudgetDiagnostic['recommendedAction'] {
  if (warningCodes.includes('budget_threshold_exceeded')) return 'review budget threshold';
  if (warningCodes.includes('budget_unknown_cost_present')) return 'add custom price';
  return 'no action';
}

function unknownCostStatsByModel(
  events: readonly UsageEvent[]
): Map<string, { readonly events: number; readonly tokens: number }> {
  const stats = new Map<string, { readonly events: number; readonly tokens: number }>();
  for (const event of events) {
    if (event.estimatedCostUsd !== null) continue;
    const current = stats.get(event.model) ?? { events: 0, tokens: 0 };
    stats.set(event.model, {
      events: current.events + 1,
      tokens: current.tokens + event.totalTokens
    });
  }
  return stats;
}

function toPricingRecommendedAction(
  action: string
): DesktopDashboardPricingDiagnostic['recommendedAction'] {
  switch (action) {
    case 'retry pricing lookup':
    case 'add custom price':
    case 'confirm fuzzy match':
    case 'verify mapped price':
    case 'no action':
      return action;
    default:
      return 'add custom price';
  }
}
