import { existsSync, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { UsageEvent } from '../models/usageEvent.js';
import { containsUnsafeOutputLabelShape, containsUnsafeOutputPathShape } from '../privacy.js';
import { formatInteger, formatTable, formatUsd } from '../utils/format.js';
import type { BudgetEvaluation } from './budgetService.js';
import {
  assertSafeOutputText,
  insightsCommandReportSchema,
  type InsightsCommandReport,
  type InsightsReport,
  type InsightsReportOptions,
  type TrendReport
} from './reportContracts.js';

type InsightsCommandServices = {
  readonly insights: {
    build(
      events: readonly UsageEvent[],
      options: InsightsReportOptions,
      budgetEvaluations?: readonly BudgetEvaluation[]
    ): InsightsReport;
  };
  readonly trend: {
    build(
      events: readonly UsageEvent[],
      options: { readonly budgets?: readonly BudgetEvaluation[]; readonly window?: unknown }
    ): TrendReport;
  };
};

export type InsightsOutputFormat = 'json' | 'markdown';

export type InsightsCommandOptions = {
  readonly window?: string;
  readonly json?: boolean;
  readonly out?: string;
  readonly format?: string;
};

export type InsightsCommandBuildOptions = {
  readonly services: InsightsCommandServices;
  readonly events: readonly UsageEvent[];
  readonly budgets: readonly BudgetEvaluation[];
  readonly window?: string;
};

export type InsightsOutputPlan =
  | { readonly kind: 'stdout-json' }
  | { readonly kind: 'stdout-text' }
  | {
      readonly kind: 'file';
      readonly format: InsightsOutputFormat;
      readonly outputPath: string;
    };

export function buildInsightsCommandReport(
  options: InsightsCommandBuildOptions
): InsightsCommandReport {
  const window = parseInsightsWindow(options.window);
  const insights = options.services.insights.build(options.events, { window }, options.budgets);
  const trend = options.services.trend.build(options.events, { budgets: options.budgets, window });
  return insightsCommandReportSchema.parse({
    version: 1,
    kind: 'insights-command',
    generatedAt: new Date().toISOString(),
    window,
    insights,
    trend,
    privacy: { sanitized: true }
  });
}

export function planInsightsOutput(options: InsightsCommandOptions): InsightsOutputPlan {
  if (options.json && options.out !== undefined) throw new Error('invalid_report_option');
  if (options.format !== undefined && options.out === undefined) {
    throw new Error('invalid_report_option');
  }
  if (options.out === undefined)
    return options.json ? { kind: 'stdout-json' } : { kind: 'stdout-text' };
  return {
    kind: 'file',
    format: parseInsightsOutputFormat(options.format),
    outputPath: validateInsightsOutputPath(options.out)
  };
}

export function renderInsightsText(report: InsightsCommandReport): string {
  const insights = report.insights;
  const trend = report.trend;
  return [
    `TokenWatch Insights (${report.window})`,
    formatTable([
      ['Metric', 'Value'],
      ['events', formatInteger(insights.totals.events)],
      ['tokens', formatInteger(insights.totals.tokens)],
      ['input tokens', formatInteger(insights.totals.inputTokens)],
      ['output tokens', formatInteger(insights.totals.outputTokens)],
      ['cached tokens', formatInteger(insights.totals.cachedTokens)],
      ['reasoning tokens', formatInteger(insights.totals.reasoningTokens)],
      ['estimated cost', formatUsd(insights.totals.estimatedCostUsd)],
      ['known cost', formatUsd(insights.totals.knownEstimatedCostUsd)],
      ['unknown pricing', `${insights.totals.unknownCostEvents} events`],
      ['cache hit ratio', formatRatio(insights.cacheHitRatio.value)]
    ]),
    renderCostDrivers(insights),
    renderTrendSummary(trend),
    renderWarnings(insights)
  ].join('\n\n');
}

export function renderInsightsMarkdown(report: InsightsCommandReport): string {
  const insights = report.insights;
  const trend = report.trend;
  const markdown = [
    '# TokenWatch Insights',
    '',
    `Window: ${report.window}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Totals',
    '',
    `- Events: ${formatInteger(insights.totals.events)}`,
    `- Tokens: ${formatInteger(insights.totals.tokens)}`,
    `- Estimated cost: ${formatUsd(insights.totals.estimatedCostUsd)}`,
    `- Known cost: ${formatUsd(insights.totals.knownEstimatedCostUsd)}`,
    `- Unknown pricing: ${insights.totals.unknownCostEvents} events, ${formatInteger(insights.totals.unknownCostTokens)} tokens`,
    `- Cache hit ratio: ${formatRatio(insights.cacheHitRatio.value)}`,
    '',
    '## Cost Driver Candidates',
    '',
    ...markdownCostDrivers(insights),
    '',
    '## Trend',
    '',
    `- Direction: ${trend.totals.direction}`,
    `- Current tokens: ${formatInteger(trend.totals.current.tokens)}`,
    `- Previous tokens: ${formatInteger(trend.totals.previous.tokens)}`,
    `- Delta percent: ${formatDeltaPercent(trend.totals.deltaPercent)}`,
    '',
    'Privacy: sanitized aggregate output only.',
    ''
  ].join('\n');
  assertSafeOutputText(markdown);
  return markdown;
}

export function writeInsightsReportFile(
  report: InsightsCommandReport,
  plan: InsightsOutputPlan
): string {
  if (plan.kind !== 'file') throw new Error('invalid_report_option');
  const contents =
    plan.format === 'json'
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderInsightsMarkdown(report);
  writeFileSync(plan.outputPath, contents, 'utf8');
  return basename(plan.outputPath);
}

function parseInsightsWindow(value: string | undefined): InsightsReportOptions['window'] {
  if (value === undefined || value === '7d') return '7d';
  if (value === '30d') return '30d';
  throw new Error('invalid_report_option');
}

function parseInsightsOutputFormat(value: string | undefined): InsightsOutputFormat {
  if (value === undefined || value === 'json') return 'json';
  if (value === 'markdown') return 'markdown';
  throw new Error('invalid_report_option');
}

function validateInsightsOutputPath(outputPath: string): string {
  const filename = basename(outputPath);
  if (
    outputPath.length < 1 ||
    filename.length < 1 ||
    filename === '.' ||
    filename === '..' ||
    containsUnsafeOutputPathShape(outputPath) ||
    containsUnsafeOutputLabelShape(filename) ||
    (existsSync(outputPath) && statSync(outputPath).isDirectory())
  ) {
    throw new Error('invalid_output_path');
  }
  return outputPath;
}

function renderCostDrivers(insights: InsightsReport): string {
  if (insights.costDriverCandidates.length === 0) return 'Cost drivers\nnone';
  return `Cost drivers\n${formatTable([
    ['model', 'pricing', 'known tokens', 'known cost', 'candidate'],
    ...insights.costDriverCandidates.map((candidate) => [
      candidate.label,
      candidate.pricingStatus,
      formatInteger(candidate.knownTokens),
      formatUsd(candidate.knownCostUsd),
      candidate.spendDriverCandidate || candidate.expensiveRelativeToMedian ? 'yes' : 'no'
    ])
  ])}`;
}

function markdownCostDrivers(insights: InsightsReport): string[] {
  if (insights.costDriverCandidates.length === 0) return ['No cost driver candidates.'];
  return insights.costDriverCandidates.map(
    (candidate) =>
      `- ${candidate.label}: ${candidate.pricingStatus}, known cost ${formatUsd(candidate.knownCostUsd)}, candidate ${candidate.spendDriverCandidate || candidate.expensiveRelativeToMedian ? 'yes' : 'no'}`
  );
}

function renderTrendSummary(trend: TrendReport): string {
  return formatTable([
    ['Trend metric', 'Value'],
    ['direction', trend.totals.direction],
    ['current tokens', formatInteger(trend.totals.current.tokens)],
    ['previous tokens', formatInteger(trend.totals.previous.tokens)],
    ['delta percent', formatDeltaPercent(trend.totals.deltaPercent)]
  ]);
}

function renderWarnings(insights: InsightsReport): string {
  return insights.warnings.length === 0
    ? 'Warnings\nnone'
    : `Warnings\n${insights.warnings.join('\n')}`;
}

function formatRatio(value: number | null): string {
  return value === null ? 'unknown' : `${(value * 100).toFixed(2)}%`;
}

function formatDeltaPercent(value: number | null): string {
  return value === null ? 'unknown' : `${value.toFixed(2)}%`;
}
