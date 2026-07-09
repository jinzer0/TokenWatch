import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { UsageEvent } from '../models/usageEvent.js';
import { containsUnsafeOutputPathShape, containsUnsafePrivacyShape } from '../privacy.js';
import { writeReportPng } from './pngRenderer.js';
import type { GraphReport, WrappedReport } from './reportContracts.js';
import {
  ReportService,
  type BuildGraphReportOptions,
  type BuildWrappedReportOptions
} from './reportService.js';

const graphMarkdownRows = 12;
const wrappedMarkdownRows = 8;
const sqlLikePattern = /\bselect\s+.+\s+from\s+|\binsert\s+into\s+/i;
const stackLikePattern = /\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)/i;

export type ShareReportFormat = 'json' | 'markdown' | 'png';
export type ShareReportStatus = 'written';
export type ShareReport = GraphReport | WrappedReport;

export type ShareReportOptions = {
  readonly events: readonly UsageEvent[];
  readonly format: ShareReportFormat;
  readonly outputPath: string;
  readonly report: ShareReportBuildOptions;
};

export type ShareReportBuildOptions =
  | ({ readonly kind: 'graph' } & BuildGraphReportOptions)
  | ({ readonly kind: 'wrapped' } & BuildWrappedReportOptions);

export type ShareReportResult = {
  readonly basename: string;
  readonly format: ShareReportFormat;
  readonly bytesWritten: number;
  readonly status: ShareReportStatus;
};

export class ShareReportError extends Error {
  readonly name = 'ShareReportError';

  constructor(readonly code: 'invalid_output_path' | 'invalid_report_option') {
    super(code);
  }
}

export class ShareReportService {
  private readonly reports = new ReportService();

  buildReport(events: readonly UsageEvent[], options: ShareReportBuildOptions): ShareReport {
    try {
      const report = buildReportWith(this.reports, events, options);
      validateShareSafeValue(report);
      return report;
    } catch (error) {
      if (error instanceof Error) throw new ShareReportError('invalid_report_option');
      throw error;
    }
  }

  async write(options: ShareReportOptions): Promise<ShareReportResult> {
    const filename = parseShareOutputBasename(options.outputPath);
    const report = this.buildReport(options.events, options.report);
    const bytesWritten = await writeShareFile(options.format, options.outputPath, report);
    return { basename: filename, format: options.format, bytesWritten, status: 'written' };
  }
}

export function renderShareReportMarkdown(report: ShareReport): string {
  validateShareSafeValue(report);
  const markdown =
    report.kind === 'graph' ? renderGraphMarkdown(report) : renderWrappedMarkdown(report);
  validateShareSafeString(markdown);
  return markdown;
}

function buildReportWith(
  service: ReportService,
  events: readonly UsageEvent[],
  options: ShareReportBuildOptions
): ShareReport {
  switch (options.kind) {
    case 'graph':
      return service.buildGraphReport([...events], options);
    case 'wrapped':
      return service.buildWrappedReport([...events], options);
    default:
      return assertNever(options);
  }
}

async function writeShareFile(
  format: ShareReportFormat,
  outputPath: string,
  report: ShareReport
): Promise<number> {
  switch (format) {
    case 'json':
      return writeTextFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    case 'markdown':
      return writeTextFile(outputPath, renderShareReportMarkdown(report));
    case 'png':
      return writePngFile(outputPath, report);
    default:
      return assertNever(format);
  }
}

async function writeTextFile(outputPath: string, contents: string): Promise<number> {
  try {
    await writeFile(outputPath, contents, 'utf8');
  } catch (error) {
    if (error instanceof Error) throw new ShareReportError('invalid_output_path');
    throw error;
  }
  return Buffer.byteLength(contents, 'utf8');
}

async function writePngFile(outputPath: string, report: ShareReport): Promise<number> {
  try {
    const bytes = await writeReportPng({ report, outputPath, width: 800, height: 600 });
    return bytes.length;
  } catch (error) {
    if (error instanceof Error) throw new ShareReportError('invalid_output_path');
    throw error;
  }
}

function parseShareOutputBasename(outputPath: string): string {
  const filename = basename(outputPath);
  if (
    outputPath.length < 1 ||
    filename.length < 1 ||
    filename === '.' ||
    filename === '..' ||
    containsUnsafeOutputPathShape(outputPath) ||
    containsUnsafePrivacyShape(filename)
  ) {
    throw new ShareReportError('invalid_output_path');
  }
  return filename;
}

function renderGraphMarkdown(report: GraphReport): string {
  return [
    `# TokenWatch ${capitalize(report.metric)} Graph`,
    '',
    renderTotals(report),
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
    renderTotals(report),
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

function renderTotals(report: ShareReport): string {
  return [
    `Events: ${report.totals.events}`,
    `Tokens: ${report.totals.tokens}`,
    `Estimated cost: ${formatCost(report.totals.estimatedCostUsd)}`,
    `Unknown cost events: ${report.unknownCostEvents}`
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

function renderReportPoint(point: GraphReport['series'][number]): string {
  return `| ${point.key} | ${point.events} | ${point.tokens} | ${formatCost(point.estimatedCostUsd)} |`;
}

function formatCost(value: number | null): string {
  return value === null ? 'unknown' : `$${value.toFixed(2)}`;
}

function privacyFooter(): string {
  return 'Privacy: sanitized aggregate report. Aggregate fields only.';
}

function validateShareSafeValue(value: unknown): void {
  if (typeof value === 'string') {
    validateShareSafeString(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(validateShareSafeValue);
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      validateShareSafeString(key);
      validateShareSafeValue(child);
    });
  }
}

function validateShareSafeString(value: string): void {
  if (
    containsUnsafePrivacyShape(value) ||
    sqlLikePattern.test(value) ||
    stackLikePattern.test(value)
  ) {
    throw new ShareReportError('invalid_report_option');
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function assertNever(_value: never): never {
  throw new ShareReportError('invalid_report_option');
}
