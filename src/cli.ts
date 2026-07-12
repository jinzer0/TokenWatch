#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { APP_VERSION } from './app/constants.js';
import { sanitizeCliError } from './app/cliErrors.js';
import { TokenWatchError } from './app/errors.js';
import { containsUnsafeOutputPathShape } from './privacy.js';
import { HeatmapService, type HeatmapMetric } from './services/heatmapService.js';
import { renderHeatmapSvg } from './services/heatmapSvgRenderer.js';
import { renderHeatmapText } from './services/heatmapTextRenderer.js';
import { probeProviderUsage } from './services/providerUsage.js';
import { writeReportPng } from './services/pngRenderer.js';
import {
  buildInsightsCommandReport,
  planInsightsOutput,
  renderInsightsText,
  writeInsightsReportFile,
  type InsightsCommandOptions
} from './services/insightsCommandReport.js';
import {
  ReportService,
  type BuildGraphReportOptions,
  type BuildWrappedReportOptions
} from './services/reportService.js';
import {
  StatuslineError,
  renderStatuslinePresetText,
  renderStatuslineText
} from './services/statusline.js';
import { BudgetStatusError, BudgetStatusService } from './services/budgetStatusService.js';
import { WatchService, WatchServiceError, parseWatchInterval } from './services/watchService.js';
import { formatInteger, formatTable, formatUsd } from './utils/format.js';
import { defaultPrices } from './pricing/defaultPrices.js';
import {
  ensureExternalPricingCache,
  PRICING_LOOKUP_WARNING,
  refreshLiteLlmPricing,
  refreshOpenRouterPricing
} from './pricing/pricing.js';
import type {
  CustomPricingModel,
  CustomPricingModelInput,
  ExternalPricingModel,
  ExternalPricingSource
} from './db/repositories/pricingModels.js';
import type { ParserName } from './parsers/base.js';
import { isParserName, parserSourceHelp } from './parsers/registry.js';
import { validateSourceName } from './privacy.js';
import type { UsageEvent } from './models/usageEvent.js';
import type { BudgetScopeKind, BudgetThreshold } from './db/repositories/budgetThresholds.js';
import type { BudgetEvaluation } from './services/budgetService.js';
import { headlessCodexInputSchema } from './services/reportContracts.js';
import type { BudgetStatusReport } from './services/reportContracts.js';
import type {
  PricingDiagnosticGroup,
  SessionSummaryGroup,
  SessionTimeMetrics,
  SummaryGroup
} from './services/aggregator.js';

type PricingRefreshSource = ExternalPricingSource | 'all';
type GraphBucketOption = NonNullable<BuildGraphReportOptions['bucket']>;
type GraphMetricOption = NonNullable<BuildGraphReportOptions['metric']>;
type WatchCliOptions = {
  readonly once?: boolean;
  readonly json?: boolean;
  readonly interval?: string;
  readonly source?: readonly string[];
  readonly sourceName?: readonly string[];
};
type HeatmapCliOptions = {
  readonly json?: boolean;
  readonly out?: string;
  readonly year?: string;
  readonly metric?: string;
  readonly source?: readonly string[];
  readonly sourceName?: readonly string[];
};
type HeatmapOutputPlan =
  | { readonly kind: 'stdout-json' }
  | { readonly kind: 'stdout-text' }
  | { readonly kind: 'file'; readonly format: 'json' | 'txt' | 'svg'; readonly outputPath: string };

const GROUP_BY_VALUES = [
  'model',
  'agent',
  'source',
  'sourceName',
  'project',
  'day',
  'hour',
  'month',
  'session',
  'sessionInterval'
] as const;

export async function main(argv = process.argv): Promise<void> {
  const normalizedArgv = normalizeScriptRunnerArgv(argv);
  const program = new Command();
  program
    .name('tokenwatch')
    .description('Local-first AI coding token usage tracker')
    .version(APP_VERSION);
  program.exitOverride();
  program.configureOutput({ writeErr: () => undefined });

  program
    .command('watch')
    .description('Print rolling live usage ticks')
    .option('--once', 'print one tick and exit')
    .option('--json', 'output JSON')
    .option('--interval <value>', 'poll interval using milliseconds, s, or m grammar', '5s')
    .option(
      '--source <source>',
      `filter by source adapter: ${parserSourceHelp}`,
      collectRepeatedOption,
      []
    )
    .option('--source-name <name>', 'filter by sourceName label', collectRepeatedOption, [])
    .action(async (options: WatchCliOptions) => {
      await runWatchCommand(options);
    });

  program
    .command('heatmap')
    .description('Print or write a privacy-safe yearly usage heatmap')
    .option('--year <yyyy>', 'UTC year, 1970 through 9999')
    .option('--metric <metric>', 'metric: tokens, events, or cost', 'tokens')
    .option('--json', 'output JSON')
    .option('--out <path>', 'write .json, .txt, or .svg heatmap output')
    .option(
      '--source <source>',
      `filter by source adapter: ${parserSourceHelp}`,
      collectRepeatedOption,
      []
    )
    .option('--source-name <name>', 'filter by sourceName label', collectRepeatedOption, [])
    .action(async (options: HeatmapCliOptions) => {
      await runHeatmapCommand(options);
    });

  program
    .command('statusline')
    .description('Print a compact token usage status line')
    .option('--window <window>', 'statusline window: today or month', 'today')
    .option('--preset <preset>', 'statusline preset: default, compact, or live')
    .option('--json', 'output JSON')
    .action(async (options: { window?: string; preset?: string; json?: boolean }) => {
      const services = await createCliServices();
      const dto = buildCliStatusline(services, options.window, options.preset);
      if (dto.kind === 'statusline-preset') {
        console.log(options.json ? JSON.stringify(dto, null, 2) : renderStatuslinePresetText(dto));
        return;
      }
      console.log(options.json ? JSON.stringify(dto, null, 2) : renderStatuslineText(dto));
    });

  registerInsightsCommand(program, 'insights', 'Show privacy-safe local usage insights');
  registerInsightsCommand(program, 'optimize', 'Alias for insights');

  program
    .command('usage')
    .description('Probe live provider usage metadata from environment credentials')
    .requiredOption('--provider <provider>', 'provider: openai or anthropic')
    .option('--json', 'output JSON')
    .action(async (options: { provider: string; json?: boolean }) => {
      const result = await probeProviderUsage({ provider: options.provider });
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('scan')
    .description('Scan local supported usage artifacts')
    .option('--source <source>', `source adapter: ${parserSourceHelp}`)
    .option('--path <path>', 'custom artifact or directory path')
    .option('--source-name <name>', 'user attribution label for this machine/server')
    .option('--project-label <label>', 'explicit safe project label for this scan')
    .action(
      async (options: {
        source?: string;
        path?: string;
        sourceName?: string;
        projectLabel?: string;
      }) => {
        const services = await createCliServices();
        let source: ParserName | undefined;
        if (options.source) {
          if (!isParserName(options.source)) {
            throw new TokenWatchError('unsupported_source', 1, 'unsupported_source');
          }
          source = options.source;
        }
        const result = await services.scanner.scan({
          source,
          path: options.path,
          sourceName: options.sourceName,
          projectLabel: options.projectLabel
        });
        console.log(`Scan complete`);
        console.log(`Discovered files: ${result.discoveredFiles}`);
        console.log(`Parsed events: ${result.parsedEvents}`);
        console.log(`Inserted events: ${result.insertedEvents}`);
        console.log(`Duplicate events: ${result.duplicateEvents}`);
        console.log(`Conflict events: ${result.conflictEvents}`);
        console.log(`Skipped records: ${result.skippedRecords}`);
        console.log(`Rejected records: ${result.rejectedRecords}`);
        console.log(`Error records: ${result.errorRecords}`);
        for (const warning of result.warnings) console.error(`warning: ${warning}`);
      }
    );

  program
    .command('summary')
    .description('Show token usage summary')
    .option(
      '--group-by <group>',
      'group by model, agent, source, sourceName, project, day, hour, month, session, or sessionInterval'
    )
    .option('--json', 'output JSON')
    .action(async (options: { groupBy?: string; json?: boolean }) => {
      const services = await createCliServices();
      const pricingLookup = await ensureCliPricingLookup(services.pricingModels);
      const events = services.usageEvents.listAll();
      const pricingDiagnostics = services.aggregator.pricingDiagnostics(events, {
        lookupCache: services.pricingModels.listLookupCache(),
        lookupWarning: Boolean(pricingLookup.warning)
      });
      const groupBy = options.groupBy as (typeof GROUP_BY_VALUES)[number] | undefined;
      if (groupBy && !GROUP_BY_VALUES.includes(groupBy)) {
        throw new TokenWatchError('unsupported_group_by', 1, 'unsupported_group_by');
      }
      if (groupBy === 'session') {
        const sessionIdleGapMs = services.config.getSessionIdleGapMs();
        const sessions = services.aggregator.sessions(events, sessionIdleGapMs);
        const payload = {
          groupBy,
          groups: sessions,
          metrics: serializeSessionMetrics(
            services.aggregator.sessionTimeMetrics(events, sessionIdleGapMs)
          )
        };
        console.log(
          options.json ? JSON.stringify(payload, null, 2) : renderSessions(payload.groups)
        );
        return;
      }
      if (groupBy === 'sessionInterval') {
        const sessionIdleGapMs = services.config.getSessionIdleGapMs();
        const sessionIntervals = services.aggregator.sessions(events, sessionIdleGapMs);
        const payload = {
          groupBy,
          groups: sessionIntervals,
          sessionIntervals,
          metrics: serializeSessionMetrics(
            services.aggregator.sessionTimeMetrics(events, sessionIdleGapMs)
          )
        };
        console.log(
          options.json
            ? JSON.stringify(payload, null, 2)
            : renderSessionIntervals(payload.sessionIntervals)
        );
        return;
      }
      if (groupBy) {
        const payload = { groupBy, groups: services.aggregator.group(events, groupBy) };
        console.log(options.json ? JSON.stringify(payload, null, 2) : renderGroups(payload.groups));
        return;
      }
      const sessionIdleGapMs = services.config.getSessionIdleGapMs();
      const sessionIntervals = services.aggregator.sessions(events, sessionIdleGapMs);
      const sessionMetrics = serializeSessionMetrics(
        services.aggregator.sessionTimeMetrics(events, sessionIdleGapMs)
      );
      const payload = {
        ...services.aggregator.summarize(events),
        maxConcurrentSessions: sessionMetrics.maxConcurrentSessions,
        longestContinuousMs: sessionMetrics.longestContinuousMs,
        totalActiveDurationMs: sessionMetrics.totalActiveDurationMs,
        totalWallDurationMs: sessionMetrics.totalWallDurationMs,
        sessionIntervals,
        pricingDiagnostics,
        budgets: services.budget.evaluateCurrentMonth()
      };
      console.log(options.json ? JSON.stringify(payload, null, 2) : renderSummary(payload));
    });

  program
    .command('graph')
    .description('Build a graph report as JSON and optionally PNG')
    .option('--bucket <bucket>', 'bucket by day, hour, or month')
    .option('--metric <metric>', 'metric: tokens, cost, or events')
    .option('--from <iso>', 'inclusive ISO timestamp lower bound')
    .option('--to <iso>', 'inclusive ISO timestamp upper bound')
    .option('--json', 'output JSON')
    .option('--out <path>', 'output PNG path')
    .action(
      async (options: {
        bucket?: string;
        metric?: string;
        from?: string;
        to?: string;
        json?: boolean;
        out?: string;
      }) => {
        const services = await createCliServices();
        const events = services.usageEvents.listAll();
        const report = buildCliGraphReport(events, {
          bucket: parseGraphBucketOption(options.bucket),
          metric: parseGraphMetricOption(options.metric),
          from: options.from,
          to: options.to
        });

        if (options.out) {
          const outputPath = validateGraphOutputPath(options.out);
          await writeReportPng({ report, outputPath, width: 800, height: 600 });
        }

        if (options.json || !options.out) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }

        console.log(`Wrote graph PNG: ${basename(options.out)}`);
      }
    );

  program
    .command('wrapped')
    .description('Build a yearly wrapped report as JSON and optionally PNG')
    .requiredOption('--year <yyyy>', 'wrapped report year')
    .option('--json', 'output JSON')
    .option('--out <path>', 'output PNG path')
    .action(async (options: { year: string; json?: boolean; out?: string }) => {
      const services = await createCliServices();
      const events = services.usageEvents.listAll();
      const report = buildCliWrappedReport(events, { year: Number(options.year) });

      if (options.out) {
        const outputPath = validateGraphOutputPath(options.out);
        await writeReportPng({ report, outputPath, width: 800, height: 600 });
      }

      if (options.json || !options.out) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log(`Wrote wrapped PNG: ${basename(options.out)}`);
    });

  program
    .command('export')
    .description('Export usage events to TokenWatch JSON')
    .requiredOption('--out <path>', 'output JSON path')
    .action(async (options: { out: string }) => {
      const services = await createCliServices();
      const exportFile = services.exporter.write(
        services.usageEvents.listAll(),
        options.out,
        services.pricingModels.listLookupCache()
      );
      console.log(`Exported ${exportFile.eventCount} events`);
    });

  program
    .command('import')
    .description('Import TokenWatch JSON')
    .argument('<file>', 'TokenWatch export file')
    .action(async (file: string) => {
      const services = await createCliServices();
      const result = services.importer.importFile(file);
      console.log(`Inserted: ${result.inserted}`);
      console.log(`Duplicates: ${result.duplicates}`);
      console.log(`Conflicts: ${result.conflicts}`);
      console.log(`Rejected: ${result.rejected}`);
    });

  const headless = program.command('headless').description('Explicit headless usage ingest');
  headless
    .command('codex')
    .description('Ingest explicit sanitized Codex usage JSON')
    .requiredOption('--input <file|->', 'JSON input file, or - for stdin')
    .option('--source-name <name>', 'safe sourceName attribution label')
    .option('--json', 'output JSON')
    .action(async (options: { input: string; sourceName?: string; json?: boolean }) => {
      const services = await createCliServices();
      const payload = parseHeadlessCodexInput(readHeadlessInput(options.input));
      const result = services.headlessCodex.ingestJsonValue(payload, {
        sourceName: options.sourceName ?? services.config.getSourceName()
      });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Inserted: ${result.inserted}`);
      console.log(`Duplicates: ${result.duplicates}`);
      console.log(`Conflicts: ${result.conflicts}`);
      console.log(`Rejected: ${result.rejected}`);
    });

  program
    .command('doctor')
    .description('Show privacy-safe diagnostics')
    .option('--json', 'output JSON')
    .option('--sources', 'output source status report')
    .action(async (options: { json?: boolean; sources?: boolean }) => {
      const { createDoctorReport, createDoctorSourceReport } = await import('./services/doctor.js');
      if (options.sources) {
        const report = await createDoctorSourceReport();
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      const report = await createDoctorReport();
      console.log(JSON.stringify(report, null, 2));
      if (report.status === 'degraded') process.exitCode = 1;
    });

  const config = program.command('config').description('Manage TokenWatch config');
  config
    .command('get')
    .description('Show config')
    .action(async () => {
      const services = await createCliServices();
      console.log(JSON.stringify(services.config.getAll(), null, 2));
    });
  config
    .command('set')
    .argument('<key>', 'config key')
    .argument('<value>', 'config value')
    .description('Set config value')
    .action(async (key: string, value: string) => {
      const services = await createCliServices();
      if (key !== 'source_name' && key !== 'project_label')
        throw new TokenWatchError('unsupported_config_key', 1, 'unsupported_config_key');
      if (key === 'source_name') services.config.setSourceName(value);
      if (key === 'project_label') services.config.setProjectLabel(value);
      console.log(`Set ${key}`);
    });

  const pricing = program.command('pricing').description('Manage local pricing metadata');
  pricing
    .command('list')
    .description('List custom, cached external, and bundled pricing')
    .option('--json', 'output JSON')
    .action(async (options: { json?: boolean }) => {
      const services = await createCliServices();
      const payload = listPricingModels(
        services.pricingModels.listCustom(),
        services.pricingModels.listExternal()
      );
      console.log(options.json ? JSON.stringify(payload, null, 2) : renderPricingList(payload));
    });
  pricing
    .command('set')
    .description('Create or update a local custom USD per 1M token price')
    .requiredOption('--provider <provider>', 'pricing provider')
    .requiredOption('--model <model>', 'model name')
    .requiredOption('--input <price>', 'input USD per 1M tokens')
    .requiredOption('--output <price>', 'output USD per 1M tokens')
    .option('--cached-input <price>', 'cached input USD per 1M tokens')
    .action(
      async (options: {
        provider: string;
        model: string;
        input: string;
        output: string;
        cachedInput?: string;
      }) => {
        const services = await createCliServices();
        const model = services.pricingModels.createOrUpdateCustom({
          provider: options.provider,
          model: options.model,
          inputPricePerMillion: parsePriceOption(options.input),
          outputPricePerMillion: parsePriceOption(options.output),
          cachedInputPricePerMillion:
            options.cachedInput === undefined ? undefined : parsePriceOption(options.cachedInput)
        });
        console.log(`Set custom price for ${model.provider}/${model.model}`);
      }
    );
  pricing
    .command('import')
    .description('Import local custom USD per 1M token prices from JSON')
    .argument('<file>', 'pricing JSON file')
    .action(async (file: string) => {
      const services = await createCliServices();
      const inputs = parsePricingImport(readFileSync(file, 'utf8'));
      for (const input of inputs) services.pricingModels.createOrUpdateCustom(input);
      console.log(`Imported custom prices: ${inputs.length}`);
    });
  pricing
    .command('refresh')
    .description('Refresh cached external pricing from an explicit source')
    .requiredOption('--source <source>', 'litellm, openrouter, or all')
    .action(async (options: { source: string }) => {
      const source = parsePricingRefreshSource(options.source);
      const services = await createCliServices();
      const counts: Array<[string, number]> = [];
      if (source === 'litellm' || source === 'all') {
        counts.push(['litellm', (await refreshLiteLlmPricing(services.pricingModels)).length]);
      }
      if (source === 'openrouter' || source === 'all') {
        counts.push([
          'openrouter',
          (await refreshOpenRouterPricing(services.pricingModels)).length
        ]);
      }
      for (const [name, count] of counts) console.log(`Refreshed ${name}: ${count}`);
    });

  const budget = program.command('budget').description('Manage monthly budget thresholds');
  budget
    .command('set')
    .description('Create or update a monthly budget threshold')
    .requiredOption('--scope <scope>', 'monthly_total or sourceName')
    .requiredOption('--threshold <usd>', 'monthly threshold in USD')
    .option('--source-name <name>', 'sourceName threshold label')
    .action(async (options: { scope: string; threshold: string; sourceName?: string }) => {
      const services = await createCliServices();
      const scopeKind = parseBudgetScope(options.scope);
      validateBudgetSourceNameOption(scopeKind, options.sourceName);
      const threshold = services.budget.setThreshold({
        scopeKind,
        sourceName: options.sourceName,
        thresholdUsd: parseBudgetThreshold(options.threshold)
      });
      console.log(
        `Set budget ${formatBudgetScope(threshold.scopeKind, threshold.sourceName)} to ${formatUsd(
          threshold.thresholdUsd
        )}`
      );
    });
  budget
    .command('list')
    .description('List monthly budget thresholds')
    .option('--json', 'output JSON')
    .action(async (options: { json?: boolean }) => {
      const services = await createCliServices();
      const thresholds = services.budget.listThresholds();
      console.log(
        options.json ? JSON.stringify(thresholds, null, 2) : renderBudgetThresholds(thresholds)
      );
    });
  budget
    .command('status')
    .description('Show monthly budget threshold status')
    .option('--json', 'output JSON')
    .action(async (options: { json?: boolean }) => {
      const services = await createCliServices();
      const report = buildBudgetStatusReport(services.budget.evaluateCurrentMonth());
      console.log(options.json ? JSON.stringify(report, null, 2) : renderBudgetStatus(report));
    });
  budget
    .command('unset')
    .description('Remove a monthly budget threshold')
    .requiredOption('--scope <scope>', 'monthly_total or sourceName')
    .option('--source-name <name>', 'sourceName threshold label')
    .action(async (options: { scope: string; sourceName?: string }) => {
      const services = await createCliServices();
      const scopeKind = parseBudgetScope(options.scope);
      validateBudgetSourceNameOption(scopeKind, options.sourceName);
      const removed = services.budget.unsetThreshold(scopeKind, options.sourceName);
      console.log(
        `${removed ? 'Unset' : 'No budget set for'} ${formatBudgetScope(scopeKind, options.sourceName ?? null)}`
      );
    });

  program
    .command('seed')
    .description('Insert synthetic demo data')
    .action(async () => {
      const services = await createCliServices();
      const { createSeedEvents } = await import('./services/seed.js');
      const result = services.usageEvents.insertMany(createSeedEvents());
      console.log(`Inserted: ${result.inserted}`);
      console.log(`Duplicates: ${result.duplicates}`);
      console.log(`Conflicts: ${result.conflicts}`);
    });

  program
    .command('reset')
    .description('Reset TokenWatch-owned DB data')
    .option('--yes', 'confirm reset')
    .action(async (options: { yes?: boolean }) => {
      if (!options.yes)
        throw new TokenWatchError('reset_requires_confirmation', 1, 'validation_failed');
      const services = await createCliServices();
      services.usageEvents.reset();
      services.scanRuns.reset();
      console.log('Reset TokenWatch usage_events and scan_runs');
    });

  program
    .command('tui')
    .description('Launch Ink TUI')
    .option('--theme <theme>', 'TUI theme: blue, green, amber, or mono')
    .option('--refresh <ms|off>', 'TUI auto-refresh interval in milliseconds, or off')
    .action(async (options: { theme?: string; refresh?: string }) => {
      const services = await createCliServices();
      const settings = resolveCliTuiSettings(services.config, options);
      const pricingLookup = await ensureCliPricingLookup(services.pricingModels);
      const [
        { render },
        React,
        { App },
        { createFileTuiDataCache, tuiDataCachePathFromDbPath },
        { resolveDbPath }
      ] = await Promise.all([
        import('ink'),
        import('react'),
        import('./tui/App.js'),
        import('./tui/cache.js'),
        import('./app/paths.js')
      ]);
      const loadData = () =>
        services.aggregator.buildTuiData(
          services.usageEvents.listAll(),
          services.scanRuns.listRecent(),
          services.config.getSessionIdleGapMs(),
          services.budget.evaluateCurrentMonth(),
          {
            lookupCache: services.pricingModels.listLookupCache(),
            lookupWarning: Boolean(pricingLookup.warning)
          }
        );
      const loadStatusline = () =>
        services.statusline.build(services.usageEvents.listAll(), {
          window: 'today',
          budgets: services.budget.evaluateCurrentMonth()
        });
      render(
        React.default.createElement(App, {
          loadData,
          loadStatusline,
          settings,
          cache: createFileTuiDataCache(tuiDataCachePathFromDbPath(resolveDbPath())),
          onExportView: (viewKey: string, rows: unknown[]) => {
            const out = 'tokenwatch-current-view.json';
            writeFileSync(out, `${JSON.stringify({ viewKey, rows }, null, 2)}\n`, 'utf8');
            return out;
          }
        })
      );
    });

  try {
    await program.parseAsync(normalizedArgv);
  } catch (error) {
    const sanitized = sanitizeCliError(error);
    if (sanitized.message) console.error(sanitized.message);
    process.exitCode = sanitized.exitCode;
  }
}

function collectRepeatedOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function runHeatmapCommand(options: HeatmapCliOptions): Promise<void> {
  const plan = planHeatmapOutput(options);
  const year = parseHeatmapYearOption(options.year);
  const metric = parseHeatmapMetricOption(options.metric);
  const sources = parseWatchSources(options.source ?? []);
  const sourceNames = parseWatchSourceNames(options.sourceName ?? []);
  const services = await createCliServices();
  const report = buildCliHeatmapReport(
    filterUsageEvents(services.usageEvents.listAll(), {
      sources,
      sourceNames
    }),
    {
      year,
      metric,
      filters: { source: sources, sourceName: sourceNames }
    }
  );

  if (plan.kind === 'stdout-json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (plan.kind === 'stdout-text') {
    console.log(renderHeatmapText(report));
    return;
  }
  writeHeatmapOutputFile(plan, report);
  console.log(`Wrote heatmap ${heatmapFormatLabel(plan.format)}: ${basename(plan.outputPath)}`);
}

function planHeatmapOutput(options: HeatmapCliOptions): HeatmapOutputPlan {
  if (options.json && options.out) {
    throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
  }
  if (options.json) return { kind: 'stdout-json' };
  if (options.out === undefined) return { kind: 'stdout-text' };
  return validateHeatmapOutputPath(options.out);
}

function validateHeatmapOutputPath(outputPath: string): HeatmapOutputPlan {
  if (
    outputPath.length < 1 ||
    containsUnsafeOutputPathShape(outputPath) ||
    (existsSync(outputPath) && statSync(outputPath).isDirectory())
  ) {
    throw new TokenWatchError('invalid_output_path', 1, 'invalid_output_path');
  }
  const extension = extname(outputPath).toLowerCase();
  if (extension === '.json') return { kind: 'file', format: 'json', outputPath };
  if (extension === '.txt') return { kind: 'file', format: 'txt', outputPath };
  if (extension === '.svg') return { kind: 'file', format: 'svg', outputPath };
  throw new TokenWatchError('invalid_output_path', 1, 'invalid_output_path');
}

function parseHeatmapYearOption(value: string | undefined): number {
  if (value === undefined) return new Date().getUTCFullYear();
  if (!/^[0-9]{4}$/.test(value)) {
    throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
  }
  const year = Number(value);
  if (year < 1970 || year > 9999) {
    throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
  }
  return year;
}

function parseHeatmapMetricOption(value: string | undefined): HeatmapMetric {
  if (value === undefined || value === 'tokens') return 'tokens';
  if (value === 'events' || value === 'cost') return value;
  throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
}

function filterUsageEvents(
  events: readonly UsageEvent[],
  filters: { readonly sources: readonly ParserName[]; readonly sourceNames: readonly string[] }
): readonly UsageEvent[] {
  return events.filter((event) => {
    const sourceMatches = filters.sources.length === 0 || filters.sources.includes(event.source);
    const sourceNameMatches =
      filters.sourceNames.length === 0 || filters.sourceNames.includes(event.sourceName);
    return sourceMatches && sourceNameMatches;
  });
}

function buildCliHeatmapReport(
  events: readonly UsageEvent[],
  options: {
    readonly year: number;
    readonly metric: HeatmapMetric;
    readonly filters: {
      readonly source: readonly ParserName[];
      readonly sourceName: readonly string[];
    };
  }
) {
  try {
    return new HeatmapService().buildReport(events, options);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_report_option') {
      throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
    }
    throw error;
  }
}

function writeHeatmapOutputFile(
  plan: Extract<HeatmapOutputPlan, { readonly kind: 'file' }>,
  report: ReturnType<HeatmapService['buildReport']>
): void {
  switch (plan.format) {
    case 'json':
      writeFileSync(plan.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      return;
    case 'txt':
      writeFileSync(plan.outputPath, `${renderHeatmapText(report)}\n`, 'utf8');
      return;
    case 'svg':
      writeFileSync(plan.outputPath, `${renderHeatmapSvg(report)}\n`, 'utf8');
      return;
  }
}

function heatmapFormatLabel(
  format: Extract<HeatmapOutputPlan, { readonly kind: 'file' }>['format']
): string {
  switch (format) {
    case 'json':
      return 'JSON';
    case 'txt':
      return 'text';
    case 'svg':
      return 'SVG';
  }
}

async function runWatchCommand(options: WatchCliOptions): Promise<void> {
  const intervalMs = parseCliWatchInterval(options.interval);
  const sources = parseWatchSources(options.source ?? []);
  const sourceNames = parseWatchSourceNames(options.sourceName ?? []);
  const emitTick = await createWatchTickEmitter({
    intervalMs,
    sources,
    sourceNames,
    json: options.json
  });
  if (options.once) {
    emitTick();
    return;
  }
  await runContinuousWatch(intervalMs, emitTick);
}

type WatchEmitterOptions = {
  readonly intervalMs: number;
  readonly sources: readonly ParserName[];
  readonly sourceNames: readonly string[];
  readonly json?: boolean;
};

async function createWatchTickEmitter(options: WatchEmitterOptions): Promise<() => void> {
  const services = await createCliServices();
  const watch = new WatchService();
  return () => {
    const tick = watch.buildTick(services.usageEvents.listAll(), {
      intervalMs: options.intervalMs,
      source: options.sources.length === 0 ? undefined : options.sources,
      sourceName: options.sourceNames.length === 0 ? undefined : options.sourceNames,
      budgets: services.budget.evaluateCurrentMonth()
    });
    console.log(options.json ? JSON.stringify(tick, null, 2) : renderWatchTick(tick));
  };
}

function runContinuousWatch(intervalMs: number, emitTick: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearInterval(timer);
      process.off('SIGINT', handleSigint);
    };
    const runTick = () => {
      try {
        emitTick();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const handleSigint = () => {
      cleanup();
      resolve();
    };
    const timer = setInterval(runTick, intervalMs);
    process.once('SIGINT', handleSigint);
    runTick();
  });
}

function parseCliWatchInterval(value: string | undefined): number {
  try {
    return parseWatchInterval(value ?? '5s');
  } catch (error) {
    if (error instanceof WatchServiceError) {
      throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
    }
    throw error;
  }
}

function parseWatchSources(values: readonly string[]): readonly ParserName[] {
  return values.map((value) => {
    if (!isParserName(value)) {
      throw new TokenWatchError('unsupported_source', 1, 'unsupported_source');
    }
    return value;
  });
}

function parseWatchSourceNames(values: readonly string[]): readonly string[] {
  return values.map((value) => {
    try {
      return validateSourceName(value);
    } catch {
      throw new TokenWatchError('invalid_source_name', 1, 'invalid_source_name');
    }
  });
}

function renderWatchTick(tick: import('./services/reportContracts.js').WatchTickReport): string {
  return [
    `TokenWatch watch | last refresh ${tick.timestamp} | interval ${formatDuration(tick.intervalMs)}`,
    `delta ${tick.delta.events} events | ${formatInteger(tick.delta.totalTokens)} tokens | cost ${formatUsd(tick.delta.estimatedCostUsd)}`,
    `delta input ${formatInteger(tick.delta.inputTokens)} | output ${formatInteger(tick.delta.outputTokens)} | cached ${formatInteger(tick.delta.cachedTokens)} | reasoning ${formatInteger(tick.delta.reasoningTokens)}`,
    `velocity ${formatInteger(tick.velocity.tokensPerMinute)} tok/min | cost ${formatUsd(tick.velocity.estimatedCostUsdPerHour)}/h`,
    `top model ${tick.top.model} | source ${tick.top.source} | sourceName ${tick.top.sourceName} | agent ${tick.top.agent} | project ${tick.top.project}`,
    `budgets ${tick.budgets.status} | warnings ${tick.budgets.warningCount}`,
    'privacy: sanitized'
  ].join('\n');
}

function formatDuration(intervalMs: number): string {
  if (intervalMs % 60_000 === 0) return `${intervalMs / 60_000}m`;
  if (intervalMs % 1_000 === 0) return `${intervalMs / 1_000}s`;
  return `${intervalMs}ms`;
}

function normalizeScriptRunnerArgv(argv: string[]): string[] {
  if (argv[2] === '--') return [argv[0] ?? 'node', argv[1] ?? 'tokenwatch', ...argv.slice(3)];
  if (argv[3] === '--') {
    return [argv[0] ?? 'node', argv[1] ?? 'tokenwatch', argv[2] ?? 'tokenwatch', ...argv.slice(4)];
  }
  return argv;
}

function registerInsightsCommand(
  program: Command,
  name: 'insights' | 'optimize',
  description: string
): void {
  program
    .command(name)
    .description(description)
    .option('--window <window>', 'insights window: 7d or 30d', '7d')
    .option('--json', 'output JSON')
    .option('--out <path>', 'write JSON or Markdown report')
    .option('--format <format>', 'output format for --out: json or markdown')
    .action(async (options: InsightsCommandOptions) => {
      await runInsightsCommand(options);
    });
}

async function runInsightsCommand(options: InsightsCommandOptions): Promise<void> {
  try {
    const plan = planInsightsOutput(options);
    const services = await createCliServices();
    const events = services.usageEvents.listAll();
    const report = buildInsightsCommandReport({
      services,
      events,
      budgets: services.budget.evaluateCurrentMonth(),
      window: options.window
    });
    if (plan.kind === 'stdout-json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (plan.kind === 'stdout-text') {
      console.log(renderInsightsText(report));
      return;
    }
    const outputName = writeInsightsReportFile(report, plan);
    console.log(`Wrote insights ${plan.format === 'json' ? 'JSON' : 'Markdown'}: ${outputName}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid_report_option')) {
      throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
    }
    if (error instanceof Error && error.message === 'invalid_output_path') {
      throw new TokenWatchError('invalid_output_path', 1, 'invalid_output_path');
    }
    throw error;
  }
}

function resolveCliTuiSettings(
  config: Awaited<ReturnType<typeof createCliServices>>['config'],
  options: { theme?: string; refresh?: string }
) {
  try {
    return config.resolveTuiSettings(options);
  } catch {
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  }
}

function parseGraphBucketOption(value: string | undefined): GraphBucketOption | undefined {
  if (value === undefined) return undefined;
  if (value === 'day' || value === 'hour' || value === 'month') return value;
  throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
}

function parseGraphMetricOption(value: string | undefined): GraphMetricOption | undefined {
  if (value === undefined) return undefined;
  if (value === 'tokens' || value === 'cost' || value === 'events') return value;
  throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
}

function validateGraphOutputPath(outputPath: string): string {
  if (
    outputPath.length < 1 ||
    containsUnsafeOutputPathShape(outputPath) ||
    extname(outputPath).toLowerCase() !== '.png' ||
    (existsSync(outputPath) && statSync(outputPath).isDirectory())
  ) {
    throw new TokenWatchError('invalid_output_path', 1, 'invalid_output_path');
  }
  return outputPath;
}

function readHeadlessInput(input: string): string {
  if (input === '-') return readFileSync(0, 'utf8');
  return readFileSync(input, 'utf8');
}

function parseHeadlessCodexInput(input: string): unknown {
  try {
    return headlessCodexInputSchema.parse(JSON.parse(input));
  } catch {
    throw new TokenWatchError('headless_payload_rejected', 1, 'headless_payload_rejected');
  }
}

function buildCliGraphReport(
  events: ReturnType<Awaited<ReturnType<typeof createCliServices>>['usageEvents']['listAll']>,
  options: BuildGraphReportOptions
) {
  try {
    return new ReportService().buildGraphReport(events, options);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_report_option') {
      throw new TokenWatchError('invalid_report_option', 1, 'invalid_report_option');
    }
    throw error;
  }
}

function buildCliWrappedReport(
  events: ReturnType<Awaited<ReturnType<typeof createCliServices>>['usageEvents']['listAll']>,
  options: BuildWrappedReportOptions
) {
  try {
    return new ReportService().buildWrappedReport(events, options);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_wrapped_year') {
      throw new TokenWatchError('invalid_wrapped_year', 1, 'invalid_wrapped_year');
    }
    throw error;
  }
}

async function createCliServices() {
  const [{ openDatabase }, { createServices }] = await Promise.all([
    import('./db/client.js'),
    import('./services/container.js')
  ]);
  return createServices(openDatabase());
}

function buildCliStatusline(
  services: Awaited<ReturnType<typeof createCliServices>>,
  window: string | undefined,
  preset: string | undefined
) {
  try {
    const events = services.usageEvents.listAll();
    const options = {
      window: window ?? 'today',
      budgets: services.budget.evaluateCurrentMonth()
    };
    if (preset === undefined || preset === 'default') {
      return services.statusline.build(events, options);
    }
    return services.statusline.buildPreset(events, { ...options, preset });
  } catch (error) {
    if (error instanceof StatuslineError) {
      const code =
        error.code === 'invalid_statusline_preset' ? 'invalid_report_option' : error.code;
      throw new TokenWatchError(code, 1, code);
    }
    throw error;
  }
}

async function ensureCliPricingLookup(
  pricingModels: import('./db/repositories/pricingModels.js').PricingModelsRepository
): Promise<import('./pricing/pricing.js').PricingLookupRefreshResult> {
  const result = await ensureExternalPricingCache(pricingModels, { fetch: pricingLookupFetch() });
  if (result.warning) console.error(`warning: ${PRICING_LOOKUP_WARNING}`);
  return result;
}

function pricingLookupFetch(): typeof fetch {
  if (process.env.TOKENWATCH_TEST_PRICING_LOOKUP === 'fail') {
    return (async () => {
      throw new Error('pricing_lookup_failed');
    }) as typeof fetch;
  }
  if (process.env.TOKENWATCH_TEST_PRICING_LOOKUP === 'mock' || process.env.NODE_ENV === 'test') {
    return (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      const payload = url.includes('openrouter.ai') ? { data: [] } : {};
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
  }
  return fetch;
}

function renderSummary(
  summary: ReturnType<import('./services/aggregator.js').AggregatorService['summarize']> & {
    budgets?: BudgetEvaluation[];
    pricingDiagnostics?: PricingDiagnosticGroup[];
  }
): string {
  const table = formatTable([
    ['Metric', 'Value'],
    ['total events', formatInteger(summary.totalEvents)],
    ['total tokens', formatInteger(summary.totalTokens)],
    ['input tokens', formatInteger(summary.totalInputTokens)],
    ['output tokens', formatInteger(summary.totalOutputTokens)],
    ['cached tokens', formatInteger(summary.totalCachedTokens)],
    ['estimated cost', formatUsd(summary.estimatedTotalCostUsd)],
    ['top source', summary.topSource ?? 'none'],
    ['top sourceName', summary.topSourceName ?? 'none'],
    ['top model', summary.topModel ?? 'none'],
    ['top agent', summary.topAgent ?? 'none'],
    ['date range', `${summary.dateRange.start ?? 'none'} to ${summary.dateRange.end ?? 'none'}`]
  ]);
  const pricingDiagnostics = summary.pricingDiagnostics ?? [];
  const budgetWarnings = (summary.budgets ?? []).filter((budget) => budget.warningRows.length > 0);
  const sections = [table];
  if (pricingDiagnostics.length > 0) {
    sections.push(`Pricing diagnostics\n${renderPricingDiagnostics(pricingDiagnostics)}`);
  }
  if (budgetWarnings.length > 0) {
    sections.push(`Budget warnings\n${renderBudgetEvaluations(budgetWarnings)}`);
  }
  return sections.join('\n\n');
}

function renderGroups(groups: SummaryGroup[]): string {
  return formatTable([
    ['key', 'events', 'tokens', 'cost', 'source', 'confidence', 'top model', 'top agent'],
    ...groups.map((group) => [
      group.key,
      String(group.events),
      formatInteger(group.totalTokens),
      formatUsd(group.estimatedCostUsd),
      group.pricingSource ?? 'unknown',
      group.pricingConfidence ?? 'none',
      group.topModel ?? 'none',
      group.topAgent ?? 'none'
    ])
  ]);
}

function renderPricingDiagnostics(groups: PricingDiagnosticGroup[]): string {
  return formatTable([
    ['provider', 'model', 'status', 'source', 'confidence', 'cache', 'matched key', 'action'],
    ...groups.map((group) => [
      group.provider ?? 'unknown',
      group.key,
      group.diagnosticStatus,
      group.pricingSource ?? 'unknown',
      group.pricingConfidence ?? 'none',
      group.cacheStatus,
      group.matchedKey ?? 'none',
      group.recommendedAction
    ])
  ]);
}

function renderSessions(groups: SessionSummaryGroup[]): string {
  return formatTable([
    ['session', 'events', 'tokens', 'cost', 'started', 'ended'],
    ...groups.map((group) => [
      group.key,
      String(group.events),
      formatInteger(group.totalTokens),
      formatUsd(group.estimatedCostUsd),
      group.startedAt,
      group.endedAt
    ])
  ]);
}

function renderSessionIntervals(groups: SessionSummaryGroup[]): string {
  return formatTable([
    [
      'source',
      'session',
      'events',
      'messages',
      'active ms',
      'wall ms',
      'tokens',
      'cost',
      'started',
      'ended'
    ],
    ...groups.map((group) => [
      group.source,
      group.sessionIdHash,
      String(group.events),
      String(group.messageCount),
      formatInteger(group.activeDurationMs),
      formatInteger(group.wallDurationMs),
      formatInteger(group.totalTokens),
      formatUsd(group.estimatedCostUsd),
      group.startedAt,
      group.endedAt
    ])
  ]);
}

function serializeSessionMetrics(metrics: SessionTimeMetrics): SessionTimeMetrics {
  return {
    sessionCount: metrics.sessionCount,
    totalWallDurationMs: metrics.totalWallDurationMs,
    totalActiveDurationMs: metrics.totalActiveDurationMs,
    longestSessionMs: metrics.longestSessionMs,
    longestContinuousMs: metrics.longestContinuousMs,
    maxConcurrentSessions: metrics.maxConcurrentSessions,
    eventsWithoutSession: metrics.eventsWithoutSession
  };
}

type PricingListRow = {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  source: 'custom' | ExternalPricingSource | 'bundled';
  confidence: 'exact';
  active: boolean;
  enabled: boolean;
  fetchedAt?: string;
};

function listPricingModels(
  custom: CustomPricingModel[],
  external: ExternalPricingModel[]
): PricingListRow[] {
  return [
    ...custom.map((model) => ({ ...model, confidence: 'exact' as const })),
    ...external.map((model) => ({ ...model, confidence: 'exact' as const })),
    ...defaultPrices.map((model) => ({
      provider: model.provider,
      model: model.model,
      inputPricePerMillion: model.inputPricePerMillion,
      outputPricePerMillion: model.outputPricePerMillion,
      cachedInputPricePerMillion: model.cachedInputPricePerMillion ?? null,
      source: 'bundled' as const,
      confidence: 'exact' as const,
      active: true,
      enabled: true
    }))
  ];
}

function renderPricingList(rows: PricingListRow[]): string {
  return formatTable([
    ['provider', 'model', 'input/1M', 'output/1M', 'cached input/1M', 'source', 'confidence'],
    ...rows.map((row) => [
      row.provider,
      row.model,
      formatUsd(row.inputPricePerMillion),
      formatUsd(row.outputPricePerMillion),
      row.cachedInputPricePerMillion === null ? 'none' : formatUsd(row.cachedInputPricePerMillion),
      row.source,
      row.confidence
    ])
  ]);
}

function renderBudgetThresholds(rows: BudgetThreshold[]): string {
  if (rows.length === 0) return 'No budget thresholds set';
  return formatTable([
    ['scope', 'sourceName', 'threshold'],
    ...rows.map((row) => [row.scopeKind, row.sourceName ?? 'all', formatUsd(row.thresholdUsd)])
  ]);
}

function buildBudgetStatusReport(evaluations: readonly BudgetEvaluation[]): BudgetStatusReport {
  try {
    return new BudgetStatusService().buildReport(evaluations);
  } catch (error) {
    if (error instanceof BudgetStatusError) {
      throw new TokenWatchError('validation_failed', 1, 'validation_failed');
    }
    throw error;
  }
}

function renderBudgetStatus(report: BudgetStatusReport): string {
  if (report.rows.length === 0) {
    return ['Budget status', 'No budget thresholds set', 'privacy: sanitized'].join('\n');
  }
  return [
    'Budget status',
    formatTable([
      [
        'scope',
        'sourceName',
        'month',
        'known spend',
        'threshold',
        'progress',
        'percent',
        'status',
        'unknown events'
      ],
      ...report.rows.map((row) => [
        row.scopeKind,
        row.sourceName ?? 'all',
        row.month,
        formatUsd(row.knownSpendUsd),
        formatUsd(row.thresholdUsd),
        renderProgressBar(row.progress.filled, row.progress.empty),
        row.percent === null ? 'unknown' : row.progress.label,
        row.status,
        String(row.unknownCostEvents)
      ])
    ]),
    'privacy: sanitized'
  ].join('\n');
}

function renderProgressBar(filled: number, empty: number): string {
  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
}

function renderBudgetEvaluations(rows: BudgetEvaluation[]): string {
  return formatTable([
    [
      'scope',
      'sourceName',
      'month',
      'known spend',
      'threshold',
      'status',
      'warnings',
      'unknown events'
    ],
    ...rows.map((row) => [
      row.scopeKind,
      row.sourceName ?? 'all',
      row.month,
      formatUsd(row.knownSpendUsd),
      formatUsd(row.thresholdUsd),
      row.status,
      row.warningRows.map((warning) => warning.code).join(','),
      String(row.unknownCostEventCount)
    ])
  ]);
}

function parseBudgetScope(value: string): BudgetScopeKind {
  if (value === 'monthly_total' || value === 'sourceName') return value;
  throw new TokenWatchError('validation_failed', 1, 'validation_failed');
}

function parseBudgetThreshold(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  }
  return parsed;
}

function validateBudgetSourceNameOption(
  scopeKind: BudgetScopeKind,
  sourceName: string | undefined
): void {
  if (scopeKind === 'monthly_total') {
    if (sourceName !== undefined && sourceName.trim().length > 0) {
      throw new TokenWatchError('validation_failed', 1, 'validation_failed');
    }
    return;
  }
  if (sourceName === undefined || sourceName.trim().length === 0) {
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  }
}

function formatBudgetScope(scopeKind: BudgetScopeKind, sourceName: string | null): string {
  return scopeKind === 'monthly_total' ? 'monthly_total' : `sourceName ${sourceName ?? 'unknown'}`;
}

function parsePriceOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  }
  return parsed;
}

function parsePricingRefreshSource(value: string): PricingRefreshSource {
  if (value === 'litellm' || value === 'openrouter' || value === 'all') return value;
  throw new TokenWatchError('validation_failed', 1, 'validation_failed');
}

function parsePricingImport(text: string): CustomPricingModelInput[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : isStrictPricingImportWrapper(parsed)
      ? parsed.prices
      : undefined;
  if (!Array.isArray(rows)) throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  return rows.map(parsePricingImportRow);
}

function isStrictPricingImportWrapper(value: unknown): value is { prices: unknown[] } {
  return isRecord(value) && Object.keys(value).length === 1 && Array.isArray(value.prices);
}

function parsePricingImportRow(row: unknown): CustomPricingModelInput {
  if (!isRecord(row)) throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  const allowedKeys = new Set(['provider', 'model', 'input', 'output', 'cachedInput']);
  for (const key of Object.keys(row)) {
    if (!allowedKeys.has(key))
      throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  }
  return {
    provider: parseStringField(row.provider),
    model: parseStringField(row.model),
    inputPricePerMillion: parseNumberField(row.input),
    outputPricePerMillion: parseNumberField(row.output),
    cachedInputPricePerMillion:
      row.cachedInput === undefined || row.cachedInput === null
        ? undefined
        : parseNumberField(row.cachedInput)
  };
}

function parseStringField(value: unknown): string {
  if (typeof value !== 'string')
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  return value;
}

function parseNumberField(value: unknown): number {
  if (typeof value !== 'number')
    throw new TokenWatchError('validation_failed', 1, 'validation_failed');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
