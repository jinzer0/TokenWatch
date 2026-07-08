import type { DesktopDashboardSnapshot } from '../../../src/desktop/shared/contracts.js';

type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;
type BudgetDiagnostic = Dashboard['budgetDiagnostics'][number];
type PricingDiagnostic = Dashboard['pricingDiagnostics'][number];

export const budgetDiagnosticFixture = (
  overrides: Partial<BudgetDiagnostic> = {}
): BudgetDiagnostic => ({
  periodLabel: 'current month',
  month: '2026-06',
  scopeKind: 'monthly_total',
  sourceName: null,
  knownSpendUsd: 12.34,
  thresholdUsd: 10,
  status: 'over',
  unknownCostEventCount: 1,
  unknownCostTokenCount: 140,
  warningCodes: ['budget_threshold_exceeded', 'budget_unknown_cost_present'],
  recommendedAction: 'review budget threshold',
  ...overrides
});

export const pricingDiagnosticFixture = (
  overrides: Partial<PricingDiagnostic> = {}
): PricingDiagnostic => ({
  provider: 'openai',
  model: 'safe-model-alpha',
  diagnosticStatus: 'exact-match',
  cacheStatus: 'matched-cache',
  pricingSource: 'litellm',
  pricingConfidence: 'exact',
  matchedKey: 'litellm:openai:safe-model-alpha',
  events: 24,
  totalTokens: 90000,
  estimatedCostUsd: 12.34,
  unknownCostEventCount: 0,
  unknownCostTokenCount: 0,
  recommendedAction: 'no action',
  ...overrides
});
