import type { GraphReport, InsightsReport, TrendReport, WrappedReport } from './reportContracts.js';

const graphMarkdownRows = 12;
const wrappedMarkdownRows = 8;
const aggregateMarkdownRows = 12;

export type MarkdownShareReport = GraphReport | WrappedReport | InsightsReport | TrendReport;

export function renderMarkdownShareReport(report: MarkdownShareReport): string {
  switch (report.kind) {
    case 'graph':
      return renderGraphMarkdown(report);
    case 'wrapped':
      return renderWrappedMarkdown(report);
    case 'insights':
      return renderInsightsMarkdown(report);
    case 'trend':
      return renderTrendMarkdown(report);
    default:
      return assertNever(report);
  }
}

function renderGraphMarkdown(report: GraphReport): string {
  return [
    `# TokenWatch ${capitalize(report.metric)} Graph`,
    '',
    renderTotals(report.totals, report.unknownCostEvents),
    '',
    `Bucket: ${report.bucket}`,
    `Range: ${report.range.from ?? 'all'} to ${report.range.to ?? 'all'}`,
    '',
    '| Bucket | Events | Tokens | Estimated cost |',
    '| --- | ---: | ---: | ---: |',
    ...report.series.slice(0, graphMarkdownRows).map(renderReportPoint),
    '',
    privacyFooter()
  ].join('\n');
}

function renderWrappedMarkdown(report: WrappedReport): string {
  return [
    `# TokenWatch Wrapped ${report.year}`,
    '',
    renderTotals(report.totals, report.unknownCostEvents),
    '',
    '## Top Models',
    ...renderRankingRows(report.topModels),
    '',
    '## Top Projects',
    ...renderRankingRows(report.topProjects),
    '',
    '## Top Source Names',
    ...renderRankingRows(report.topSourceNames),
    '',
    privacyFooter()
  ].join('\n');
}

function renderInsightsMarkdown(report: InsightsReport): string {
  return [
    '# TokenWatch Insights',
    '',
    `Window: ${report.window}`,
    `Range: ${report.range.from} to ${report.range.to}`,
    '',
    renderStrictTotals(report.totals),
    '',
    '## Top Models',
    ...renderStrictRows(report.topRows.models),
    '',
    '## Top Sources',
    ...renderStrictRows(report.topRows.sources),
    '',
    '## Top Source Names',
    ...renderStrictRows(report.topRows.sourceNames),
    '',
    '## Top Projects',
    ...renderStrictRows(report.topRows.projects),
    '',
    privacyFooter()
  ].join('\n');
}

function renderTrendMarkdown(report: TrendReport): string {
  return [
    '# TokenWatch Trend',
    '',
    `Window: ${report.window}`,
    `Trend scope: ${report.trendScope}`,
    `Current range: ${report.range.current.from} to ${report.range.current.to}`,
    `Previous range: ${report.range.previous.from} to ${report.range.previous.to}`,
    '',
    '## Totals',
    renderTrendTotals(report),
    '',
    '## Rows',
    ...renderTrendRows(report.rows),
    '',
    privacyFooter()
  ].join('\n');
}

function renderTotals(
  totals: Pick<GraphReport['totals'], 'events' | 'tokens' | 'estimatedCostUsd'>,
  unknownCostEvents: number
): string {
  return [
    `Events: ${totals.events}`,
    `Tokens: ${totals.tokens}`,
    `Estimated cost: ${formatCost(totals.estimatedCostUsd)}`,
    `Unknown cost events: ${unknownCostEvents}`
  ].join('\n');
}

function renderStrictTotals(totals: InsightsReport['totals']): string {
  return [
    `Events: ${totals.events}`,
    `Tokens: ${totals.tokens}`,
    `Estimated cost: ${formatCost(totals.estimatedCostUsd)}`,
    `Known cost: ${formatCost(totals.knownEstimatedCostUsd)}`,
    `Unknown cost events: ${totals.unknownCostEvents}`,
    `Unknown cost tokens: ${totals.unknownCostTokens}`
  ].join('\n');
}

function renderRankingRows(rows: readonly GraphReport['series'][number][]): readonly string[] {
  if (rows.length === 0) return ['No aggregate rows.'];
  return [
    '| Label | Events | Tokens | Estimated cost |',
    '| --- | ---: | ---: | ---: |',
    ...rows.slice(0, wrappedMarkdownRows).map(renderReportPoint)
  ];
}

function renderStrictRows(
  rows: readonly InsightsReport['topRows']['models'][number][]
): readonly string[] {
  if (rows.length === 0) return ['No aggregate rows.'];
  return [
    '| Label | Events | Tokens | Estimated cost | Known cost | Unknown events | Unknown tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.slice(0, aggregateMarkdownRows).map(renderStrictRow)
  ];
}

function renderTrendRows(rows: readonly TrendReport['rows'][number][]): readonly string[] {
  if (rows.length === 0) return ['No aggregate rows.'];
  return [
    '| Category | Label | Metric | Current tokens | Previous tokens | Current cost | Current known cost | Current unknown events | Current unknown tokens | Direction | Delta percent |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
    ...rows.slice(0, aggregateMarkdownRows).map(renderTrendRow)
  ];
}

function renderReportPoint(point: GraphReport['series'][number]): string {
  return `| ${point.key} | ${point.events} | ${point.tokens} | ${formatCost(point.estimatedCostUsd)} |`;
}

function renderStrictRow(row: InsightsReport['topRows']['models'][number]): string {
  return `| ${row.label} | ${row.events} | ${row.tokens} | ${formatCost(row.estimatedCostUsd)} | ${formatCost(row.knownEstimatedCostUsd)} | ${row.unknownCostEvents} | ${row.unknownCostTokens} |`;
}

function renderTrendTotals(report: TrendReport): string {
  return `| Current tokens | Previous tokens | Current cost | Current known cost | Current unknown events | Current unknown tokens | Direction | Delta percent |\n| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |\n| ${report.totals.current.tokens} | ${report.totals.previous.tokens} | ${formatCost(report.totals.current.estimatedCostUsd)} | ${formatCost(report.totals.current.knownEstimatedCostUsd)} | ${report.totals.current.unknownCostEvents} | ${report.totals.current.unknownCostTokens} | ${report.totals.direction} | ${formatPercent(report.totals.deltaPercent)} |`;
}

function renderTrendRow(row: TrendReport['rows'][number]): string {
  return `| ${row.category} | ${row.label} | ${row.metric} | ${row.current.tokens} | ${row.previous.tokens} | ${formatCost(row.current.estimatedCostUsd)} | ${formatCost(row.current.knownEstimatedCostUsd)} | ${row.current.unknownCostEvents} | ${row.current.unknownCostTokens} | ${row.direction} | ${formatPercent(row.deltaPercent)} |`;
}

function formatCost(value: number | null): string {
  return value === null ? 'unknown' : `$${value.toFixed(2)}`;
}

function formatPercent(value: number | null): string {
  return value === null ? 'unknown' : `${value.toFixed(2)}%`;
}

function privacyFooter(): string {
  return 'Privacy: sanitized aggregate report. Aggregate fields only.';
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function assertNever(_value: never): never {
  throw new Error('invalid_report_option');
}
