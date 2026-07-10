import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { UsageEvent } from '../models/usageEvent.js';
import { containsUnsafeOutputPathShape, containsUnsafePrivacyShape } from '../privacy.js';
import type { BudgetEvaluation } from './budgetService.js';
import { InsightsService } from './insightsService.js';
import { writeReportPng } from './pngRenderer.js';
import {
  assertSafeOutputText,
  type GraphReport,
  type InsightsReport,
  type InsightsReportOptions,
  type TrendReport,
  type TrendReportOptions,
  type WrappedReport
} from './reportContracts.js';
import {
  ReportService,
  type BuildGraphReportOptions,
  type BuildWrappedReportOptions
} from './reportService.js';
import { renderMarkdownShareReport } from './shareReportMarkdown.js';
import { TrendService } from './trendService.js';

export type ShareReportFormat = 'json' | 'markdown' | 'png';
export type ShareReportStatus = 'written';
export type ShareReport = GraphReport | WrappedReport | InsightsReport | TrendReport;

export type ShareReportOptions = {
  readonly budgets?: readonly BudgetEvaluation[];
  readonly events: readonly UsageEvent[];
  readonly format: ShareReportFormat;
  readonly outputPath: string;
  readonly report: ShareReportBuildOptions;
};

type BuildReportContext = {
  readonly budgets: readonly BudgetEvaluation[];
  readonly events: readonly UsageEvent[];
  readonly options: ShareReportBuildOptions;
};

export type ShareReportBuildOptions =
  | ({ readonly kind: 'graph' } & BuildGraphReportOptions)
  | ({ readonly kind: 'wrapped' } & BuildWrappedReportOptions)
  | { readonly kind: 'insights'; readonly window?: InsightsReportOptions['window'] }
  | { readonly kind: 'trend'; readonly window?: TrendReportOptions['window'] };

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
  private readonly insights = new InsightsService();
  private readonly reports = new ReportService();
  private readonly trend = new TrendService();

  buildReport(
    events: readonly UsageEvent[],
    options: ShareReportBuildOptions,
    budgets: readonly BudgetEvaluation[] = []
  ): ShareReport {
    try {
      const report = buildReportWith(
        { insights: this.insights, reports: this.reports, trend: this.trend },
        { budgets, events, options }
      );
      validateShareSafeValue(report);
      return report;
    } catch (error) {
      if (error instanceof Error) throw new ShareReportError('invalid_report_option');
      throw error;
    }
  }

  async write(options: ShareReportOptions): Promise<ShareReportResult> {
    const filename = parseShareOutputBasename(options.outputPath);
    const report = this.buildReport(options.events, options.report, options.budgets ?? []);
    const bytesWritten = await writeShareFile(options.format, options.outputPath, report);
    return { basename: filename, format: options.format, bytesWritten, status: 'written' };
  }
}

export function renderShareReportMarkdown(report: ShareReport): string {
  validateShareSafeValue(report);
  const markdown = renderMarkdownShareReport(report);
  validateShareSafeString(markdown);
  return markdown;
}

function buildReportWith(
  services: {
    readonly insights: InsightsService;
    readonly reports: ReportService;
    readonly trend: TrendService;
  },
  context: BuildReportContext
): ShareReport {
  const { budgets, events, options } = context;
  switch (options.kind) {
    case 'graph':
      return services.reports.buildGraphReport([...events], options);
    case 'wrapped':
      return services.reports.buildWrappedReport([...events], options);
    case 'insights':
      return services.insights.build(events, { window: options.window ?? '7d' }, budgets);
    case 'trend':
      return services.trend.build(events, { budgets, window: options.window });
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
  if (report.kind === 'insights' || report.kind === 'trend') {
    throw new ShareReportError('invalid_report_option');
  }
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
  try {
    assertSafeOutputText(value);
  } catch (error) {
    if (error instanceof Error) throw new ShareReportError('invalid_report_option');
    throw error;
  }
}

function assertNever(_value: never): never {
  throw new ShareReportError('invalid_report_option');
}
