import type { BudgetEvaluation } from './budgetService.js';
import { budgetStatusReportSchema, type BudgetStatusReport } from './reportContracts.js';

export type BudgetStatusRow = BudgetStatusReport['rows'][number];

export type BudgetStatusServiceOptions = {
  readonly now?: Date;
  readonly progressWidth?: number;
};

export class BudgetStatusError extends Error {
  readonly name = 'BudgetStatusError';

  constructor(readonly code: 'invalid_budget_progress_width' | 'invalid_budget_threshold') {
    super(code);
  }
}

export class BudgetStatusService {
  buildRows(
    evaluations: readonly BudgetEvaluation[],
    options: BudgetStatusServiceOptions = {}
  ): BudgetStatusRow[] {
    return this.buildReport(evaluations, options).rows;
  }

  buildReport(
    evaluations: readonly BudgetEvaluation[],
    options: BudgetStatusServiceOptions = {}
  ): BudgetStatusReport {
    const width = progressWidth(options.progressWidth ?? 20);
    const rows = evaluations.map((evaluation) => buildRow(evaluation, width));
    const report = {
      version: 1,
      kind: 'budget_status',
      generatedAt: (options.now ?? new Date()).toISOString(),
      rows,
      summary: summarizeRows(rows),
      privacy: { sanitized: true }
    } satisfies BudgetStatusReport;
    return budgetStatusReportSchema.parse(report);
  }
}

function buildRow(evaluation: BudgetEvaluation, width: number): BudgetStatusRow {
  if (!Number.isFinite(evaluation.thresholdUsd) || evaluation.thresholdUsd <= 0) {
    throw new BudgetStatusError('invalid_budget_threshold');
  }
  const percent = roundPercent((evaluation.knownSpendUsd / evaluation.thresholdUsd) * 100);
  const status = canonicalStatus(evaluation, percent);
  return {
    scopeKind: evaluation.scopeKind,
    label: budgetLabel(evaluation),
    sourceName: evaluation.sourceName,
    month: evaluation.month,
    status,
    knownSpendUsd: evaluation.knownSpendUsd,
    thresholdUsd: evaluation.thresholdUsd,
    percent,
    progress: progress(percent, width, status),
    unknownCostEvents: evaluation.unknownCostEventCount,
    unknownCostTokens: evaluation.unknownCostTokenCount,
    warnings: evaluation.warningRows.map((warning) => warning.code)
  };
}

function canonicalStatus(evaluation: BudgetEvaluation, percent: number): BudgetStatusRow['status'] {
  if (evaluation.status === 'over' || evaluation.knownSpendUsd >= evaluation.thresholdUsd) {
    return 'exceeded';
  }
  if (evaluation.unknownCostEventCount > 0) {
    return 'unknown';
  }
  if (percent >= 80) {
    return 'warning';
  }
  return 'ok';
}

function progress(
  percent: number,
  width: number,
  status: BudgetStatusRow['status']
): BudgetStatusRow['progress'] {
  const filled = Math.min(width, Math.floor((Math.min(percent, 100) / 100) * width));
  return {
    width,
    filled,
    empty: width - filled,
    label:
      status === 'unknown' ? `${formatPercent(percent)} + unknown cost` : formatPercent(percent)
  };
}

function summarizeRows(rows: readonly BudgetStatusRow[]): BudgetStatusReport['summary'] {
  return {
    total: rows.length,
    ok: rows.filter((row) => row.status === 'ok').length,
    warning: rows.filter((row) => row.status === 'warning').length,
    exceeded: rows.filter((row) => row.status === 'exceeded').length,
    unknown: rows.filter((row) => row.status === 'unknown').length
  };
}

function budgetLabel(evaluation: BudgetEvaluation): string {
  if (evaluation.scopeKind === 'monthly_total') {
    return 'monthly total';
  }
  return evaluation.sourceName ?? 'sourceName';
}

function progressWidth(width: number): number {
  if (!Number.isInteger(width) || width < 0) {
    throw new BudgetStatusError('invalid_budget_progress_width');
  }
  return width;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
