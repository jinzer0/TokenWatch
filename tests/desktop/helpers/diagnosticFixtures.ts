import type { DesktopDashboardSnapshot } from '../../../src/desktop/shared/contracts.js';

type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;
type BudgetDiagnostic = Dashboard['budgetDiagnostics'][number];
type DiagnosticsHub = Dashboard['diagnosticsHub'];
type PricingDiagnostic = Dashboard['pricingDiagnostics'][number];

export const diagnosticsHubFixture = (overrides: Partial<DiagnosticsHub> = {}): DiagnosticsHub => ({
  database: { readiness: 'ready', eventCount: 42, scanRunCount: 1 },
  latestScan: {
    status: 'completed',
    startedAt: '2026-06-07T11:00:00.000Z',
    finishedAt: '2026-06-07T11:00:05.000Z',
    sourceName: 'safe-source-name',
    parserName: 'codex',
    warningCount: 0,
    errorCode: null
  },
  sourceHealth: {
    status: 'healthy',
    sourcesWithRuns: 1,
    failedRuns: 0,
    warningRuns: 0,
    interruptedRuns: 0
  },
  pricingSummary: {
    status: 'unknown-costs',
    diagnosticCount: 1,
    unknownCostEventCount: 1,
    unknownCostTokenCount: 140,
    unresolvedModelCount: 1
  },
  budgetSummary: {
    status: 'over',
    diagnosticCount: 1,
    overBudgetCount: 1,
    unknownCostBudgetCount: 0
  },
  sessionSummary: {
    status: 'missing-session-metadata',
    sessionCount: 2,
    eventsWithoutSession: 1,
    maxConcurrentSessions: 2,
    longestContinuousMs: 300_000
  },
  projectSummary: {
    status: 'needs-labels',
    publicProjectCount: 2,
    labeledEventCount: 38,
    unknownProjectEventCount: 4,
    unlabeledWorkspaceHashCount: 2
  },
  privacy: {
    sanitized: true,
    boundaryCopyKey: 'desktop.diagnostics.privacyBoundary'
  },
  recommendedActions: [
    {
      code: 'add-custom-price',
      priority: 'medium',
      copyKey: 'desktop.diagnostics.action.addCustomPrice',
      command:
        'tokenwatch pricing set --provider <provider> --model <model> --input <usd> --output <usd>'
    },
    {
      code: 'review-budget-threshold',
      priority: 'medium',
      copyKey: 'desktop.diagnostics.action.reviewBudgetThreshold',
      command: 'tokenwatch budget list'
    },
    {
      code: 'label-projects',
      priority: 'medium',
      copyKey: 'desktop.diagnostics.action.labelProjects',
      command: 'tokenwatch config set project_label <label>'
    }
  ],
  ...overrides
});

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
