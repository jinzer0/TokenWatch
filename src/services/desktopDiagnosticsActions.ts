import type { DesktopDashboardDiagnosticsHub } from '../desktop/shared/contracts.js';

type DiagnosticsAction = DesktopDashboardDiagnosticsHub['recommendedActions'][number];

type DiagnosticsActionInput = {
  readonly sourceHealth: DesktopDashboardDiagnosticsHub['sourceHealth'];
  readonly pricingSummary: DesktopDashboardDiagnosticsHub['pricingSummary'];
  readonly budgetSummary: DesktopDashboardDiagnosticsHub['budgetSummary'];
  readonly sessionSummary: DesktopDashboardDiagnosticsHub['sessionSummary'];
  readonly projectSummary: DesktopDashboardDiagnosticsHub['projectSummary'];
};

export function recommendedDiagnosticsActions(input: DiagnosticsActionInput): DiagnosticsAction[] {
  const actions: DiagnosticsAction[] = [];
  if (input.sourceHealth.status === 'no-runs') actions.push(actionCatalog.runScan);
  if (input.sourceHealth.status === 'failing') actions.push(actionCatalog.reviewFailedScan);
  if (input.pricingSummary.status === 'unknown-costs') actions.push(actionCatalog.addCustomPrice);
  if (input.budgetSummary.status === 'over') actions.push(actionCatalog.reviewBudgetThreshold);
  if (input.budgetSummary.status === 'not-configured') {
    actions.push(actionCatalog.setBudgetThreshold);
  }
  if (input.sessionSummary.status === 'missing-session-metadata') {
    actions.push(actionCatalog.inspectSessions);
  }
  if (input.projectSummary.status === 'needs-labels') actions.push(actionCatalog.labelProjects);
  return actions;
}

const actionCatalog = {
  runScan: {
    code: 'run-scan',
    priority: 'high',
    copyKey: 'desktop.diagnostics.action.runScan',
    command: 'tokenwatch scan --source <source> --path <path>'
  },
  reviewFailedScan: {
    code: 'review-failed-scan',
    priority: 'high',
    copyKey: 'desktop.diagnostics.action.reviewFailedScan',
    command: 'tokenwatch doctor --sources'
  },
  addCustomPrice: {
    code: 'add-custom-price',
    priority: 'medium',
    copyKey: 'desktop.diagnostics.action.addCustomPrice',
    command:
      'tokenwatch pricing set --provider <provider> --model <model> --input <usd> --output <usd>'
  },
  reviewBudgetThreshold: {
    code: 'review-budget-threshold',
    priority: 'medium',
    copyKey: 'desktop.diagnostics.action.reviewBudgetThreshold',
    command: 'tokenwatch budget list'
  },
  setBudgetThreshold: {
    code: 'set-budget-threshold',
    priority: 'low',
    copyKey: 'desktop.diagnostics.action.setBudgetThreshold',
    command: 'tokenwatch budget set --scope monthly_total --threshold <usd>'
  },
  inspectSessions: {
    code: 'inspect-sessions',
    priority: 'low',
    copyKey: 'desktop.diagnostics.action.inspectSessions',
    command: 'tokenwatch summary --group-by session --json'
  },
  labelProjects: {
    code: 'label-projects',
    priority: 'medium',
    copyKey: 'desktop.diagnostics.action.labelProjects',
    command: 'tokenwatch config set project_label <label>'
  }
} as const satisfies Record<string, DiagnosticsAction>;
