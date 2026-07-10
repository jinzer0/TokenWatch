import type {
  DesktopDashboardBudgetDiagnostic,
  DesktopDashboardDiagnosticsHub,
  DesktopDashboardProjectGroup,
  DesktopDashboardPricingDiagnostic
} from '../desktop/shared/contracts.js';
import { recommendedDiagnosticsActions } from './desktopDiagnosticsActions.js';
import type { ProjectAttributionDiagnostics } from './projectAttribution.js';

type BuildDesktopDiagnosticsHubInput = {
  readonly eventCount: number;
  readonly scanRunCount: number;
  readonly recentScanRuns: readonly DesktopDashboardDiagnosticsHubScanRun[];
  readonly budgetDiagnostics: readonly DesktopDashboardBudgetDiagnostic[];
  readonly pricingDiagnostics: readonly DesktopDashboardPricingDiagnostic[];
  readonly projectGroups: readonly DesktopDashboardProjectGroup[];
  readonly projectDiagnostics: ProjectAttributionDiagnostics;
  readonly sessionMetrics: DesktopDashboardDiagnosticsHubSessionMetrics;
};

type DesktopDashboardDiagnosticsHubScanRun = {
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly sourceName: string;
  readonly parserName: string | null;
  readonly status: 'running' | 'completed' | 'failed' | 'interrupted';
  readonly warningCodes: readonly string[];
  readonly errorCode: string | null;
};

type DesktopDashboardDiagnosticsHubSessionMetrics = {
  readonly sessionCount: number;
  readonly longestContinuousMs: number;
  readonly maxConcurrentSessions: number;
  readonly eventsWithoutSession: number;
};

export function buildDesktopDiagnosticsHub(
  input: BuildDesktopDiagnosticsHubInput
): DesktopDashboardDiagnosticsHub {
  const sourceHealth = summarizeSourceHealth(input.recentScanRuns);
  const pricingSummary = summarizePricing(input.eventCount, input.pricingDiagnostics);
  const budgetSummary = summarizeBudget(input.budgetDiagnostics);
  const sessionSummary = summarizeSessions(input.sessionMetrics);
  const projectSummary = summarizeProjects(
    input.eventCount,
    input.projectGroups,
    input.projectDiagnostics
  );
  return {
    database: {
      readiness: 'ready',
      eventCount: input.eventCount,
      scanRunCount: input.scanRunCount
    },
    latestScan: summarizeLatestScan(input.recentScanRuns[0] ?? null),
    sourceHealth,
    pricingSummary,
    budgetSummary,
    sessionSummary,
    projectSummary,
    privacy: {
      sanitized: true,
      boundaryCopyKey: 'desktop.diagnostics.privacyBoundary'
    },
    recommendedActions: recommendedDiagnosticsActions({
      sourceHealth,
      pricingSummary,
      budgetSummary,
      sessionSummary,
      projectSummary
    })
  };
}

function summarizeLatestScan(
  run: DesktopDashboardDiagnosticsHubScanRun | null
): DesktopDashboardDiagnosticsHub['latestScan'] {
  if (run === null) {
    return {
      status: 'none',
      startedAt: null,
      finishedAt: null,
      sourceName: null,
      parserName: null,
      warningCount: 0,
      errorCode: null
    };
  }
  return {
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    sourceName: run.sourceName,
    parserName: run.parserName,
    warningCount: run.warningCodes.length,
    errorCode: run.errorCode
  };
}

function summarizeSourceHealth(
  runs: readonly DesktopDashboardDiagnosticsHubScanRun[]
): DesktopDashboardDiagnosticsHub['sourceHealth'] {
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const interruptedRuns = runs.filter((run) => run.status === 'interrupted').length;
  const warningRuns = runs.filter((run) => run.warningCodes.length > 0).length;
  return {
    status: sourceHealthStatus(runs.length, failedRuns, interruptedRuns, warningRuns),
    sourcesWithRuns: new Set(runs.map((run) => run.sourceName)).size,
    failedRuns,
    warningRuns,
    interruptedRuns
  };
}

function sourceHealthStatus(
  runCount: number,
  failedRuns: number,
  interruptedRuns: number,
  warningRuns: number
): DesktopDashboardDiagnosticsHub['sourceHealth']['status'] {
  if (runCount === 0) return 'no-runs';
  if (failedRuns + interruptedRuns > 0) return 'failing';
  if (warningRuns > 0) return 'warnings';
  return 'healthy';
}

function summarizePricing(
  eventCount: number,
  diagnostics: readonly DesktopDashboardPricingDiagnostic[]
): DesktopDashboardDiagnosticsHub['pricingSummary'] {
  const unknownCostEventCount = sumDiagnostics(diagnostics, 'unknownCostEventCount');
  const unresolvedModelCount = diagnostics.filter((row) =>
    ['unresolved', 'negative-cache', 'network-fallback'].includes(row.diagnosticStatus)
  ).length;
  return {
    status: pricingStatus(eventCount, unknownCostEventCount, unresolvedModelCount),
    diagnosticCount: diagnostics.length,
    unknownCostEventCount,
    unknownCostTokenCount: sumDiagnostics(diagnostics, 'unknownCostTokenCount'),
    unresolvedModelCount
  };
}

function pricingStatus(
  eventCount: number,
  unknownCostEventCount: number,
  unresolvedModelCount: number
): DesktopDashboardDiagnosticsHub['pricingSummary']['status'] {
  if (eventCount === 0) return 'no-events';
  if (unknownCostEventCount > 0 || unresolvedModelCount > 0) return 'unknown-costs';
  return 'complete';
}

function summarizeBudget(
  diagnostics: readonly DesktopDashboardBudgetDiagnostic[]
): DesktopDashboardDiagnosticsHub['budgetSummary'] {
  const overBudgetCount = diagnostics.filter((row) => row.status === 'over').length;
  const unknownCostBudgetCount = diagnostics.filter(
    (row) => row.status === 'unknown-costs-present'
  ).length;
  return {
    status: budgetStatus(diagnostics.length, overBudgetCount, unknownCostBudgetCount),
    diagnosticCount: diagnostics.length,
    overBudgetCount,
    unknownCostBudgetCount
  };
}

function budgetStatus(
  diagnosticCount: number,
  overBudgetCount: number,
  unknownCostBudgetCount: number
): DesktopDashboardDiagnosticsHub['budgetSummary']['status'] {
  if (diagnosticCount === 0) return 'not-configured';
  if (overBudgetCount > 0) return 'over';
  if (unknownCostBudgetCount > 0) return 'unknown-costs-present';
  return 'ok';
}

function summarizeSessions(
  metrics: DesktopDashboardDiagnosticsHubSessionMetrics
): DesktopDashboardDiagnosticsHub['sessionSummary'] {
  return {
    status: sessionStatus(metrics),
    sessionCount: metrics.sessionCount,
    eventsWithoutSession: metrics.eventsWithoutSession,
    maxConcurrentSessions: metrics.maxConcurrentSessions,
    longestContinuousMs: metrics.longestContinuousMs
  };
}

function sessionStatus(
  metrics: DesktopDashboardDiagnosticsHubSessionMetrics
): DesktopDashboardDiagnosticsHub['sessionSummary']['status'] {
  if (metrics.sessionCount === 0) return 'no-sessions';
  if (metrics.eventsWithoutSession > 0) return 'missing-session-metadata';
  return 'active';
}

function summarizeProjects(
  eventCount: number,
  projectGroups: readonly DesktopDashboardProjectGroup[],
  diagnostics: ProjectAttributionDiagnostics
): DesktopDashboardDiagnosticsHub['projectSummary'] {
  const unknownProjectEventCount =
    projectGroups.find((group) => group.projectKey === 'unknown')?.events ?? 0;
  const publicProjectCount = projectGroups.filter((group) => group.projectKey !== 'unknown').length;
  return {
    status: projectStatus(eventCount, unknownProjectEventCount),
    publicProjectCount,
    labeledEventCount: eventCount - unknownProjectEventCount,
    unknownProjectEventCount,
    unlabeledWorkspaceHashCount: diagnostics.unlabeledWorkspaceHashCount
  };
}

function projectStatus(
  eventCount: number,
  unknownProjectEventCount: number
): DesktopDashboardDiagnosticsHub['projectSummary']['status'] {
  if (eventCount === 0) return 'no-events';
  if (unknownProjectEventCount > 0) return 'needs-labels';
  return 'labeled';
}

function sumDiagnostics(
  diagnostics: readonly DesktopDashboardPricingDiagnostic[],
  field: 'unknownCostEventCount' | 'unknownCostTokenCount'
): number {
  return diagnostics.reduce((total, row) => total + row[field], 0);
}
