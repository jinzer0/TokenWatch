import type { UsageEvent } from '../models/usageEvent.js';
import { formatInteger, formatUsd } from '../utils/format.js';
import { AggregatorService } from './aggregator.js';
import {
  allKnownCost,
  budgetPressure,
  buildBudgets,
  buildTopLabels,
  isInRange,
  knownCost,
  localRange,
  parseStatuslineMetricPreset,
  parseStatuslineWindow,
  rangeDto,
  recentMetrics,
  renderBudgetPressure,
  sumTokens,
  type LocalRange
} from './statuslineHelpers.js';
import {
  statuslinePresetSchema,
  statuslineSchema,
  type BuildStatuslineOptions,
  type StatuslineBudgets,
  type StatuslineDto,
  type StatuslinePresetDto,
  type StatuslineTopLabels,
  type StatuslineWindow
} from './statuslineContract.js';

export type {
  BuildStatuslineOptions,
  StatuslineDto,
  StatuslineMetricPreset,
  StatuslinePresetDto,
  StatuslineWindow
} from './statuslineContract.js';
export { StatuslineError } from './statuslineErrors.js';

export class StatuslineService {
  private readonly aggregator = new AggregatorService();

  build(events: readonly UsageEvent[], options: BuildStatuslineOptions = {}): StatuslineDto {
    const base = this.buildBase(events, options);
    const dto = {
      version: 1,
      kind: 'statusline',
      generatedAt: base.now.toISOString(),
      window: base.window,
      range: rangeDto(base.range),
      totals: base.totals,
      knownEstimatedCostUsd: base.knownEstimatedCostUsd,
      unknownCostEvents: base.unknownCostEvents.length,
      unknownCostTokens: sumTokens(base.unknownCostEvents),
      budgets: base.budgets,
      top: base.top,
      privacy: { sanitized: true }
    } satisfies StatuslineDto;
    return statuslineSchema.parse(dto);
  }

  buildPreset(events: readonly UsageEvent[], options: BuildStatuslineOptions): StatuslinePresetDto {
    const preset = parseStatuslineMetricPreset(options.preset);
    const base = this.buildBase(events, options);
    const recent = recentMetrics(base.includedEvents, base.now);
    const dto = {
      version: 1,
      kind: 'statusline-preset',
      preset,
      generatedAt: base.now.toISOString(),
      window: base.window,
      range: rangeDto(base.range),
      totals: base.totals,
      knownEstimatedCostUsd: base.knownEstimatedCostUsd,
      unknownCostEvents: base.unknownCostEvents.length,
      unknownCostTokens: sumTokens(base.unknownCostEvents),
      recent,
      budgetPressure: budgetPressure(base.budgets),
      top: base.top,
      privacy: { sanitized: true }
    } satisfies StatuslinePresetDto;
    return statuslinePresetSchema.parse(dto);
  }

  private buildBase(
    events: readonly UsageEvent[],
    options: BuildStatuslineOptions
  ): StatuslineBase {
    const window = parseStatuslineWindow(options.window ?? 'today');
    const now = options.now ?? new Date();
    const range = localRange(window, now);
    const includedEvents = events.filter((event) => isInRange(event, range));
    const totals = this.aggregator.summarize([...includedEvents]);
    const unknownCostEvents = includedEvents.filter((event) => event.estimatedCostUsd === null);
    const budgets = buildBudgets(options.budgets ?? [], range);
    return {
      now,
      window,
      range,
      includedEvents,
      totals: {
        events: totals.totalEvents,
        tokens: totals.totalTokens,
        inputTokens: totals.totalInputTokens,
        outputTokens: totals.totalOutputTokens,
        cachedTokens: totals.totalCachedTokens,
        estimatedCostUsd: allKnownCost(includedEvents)
      },
      knownEstimatedCostUsd: knownCost(includedEvents),
      unknownCostEvents,
      budgets,
      top: buildTopLabels(includedEvents, totals.topModel, totals.topSourceName)
    };
  }
}

export function renderStatuslineText(dto: StatuslineDto): string {
  const cost =
    dto.totals.estimatedCostUsd === null
      ? 'cost unknown'
      : `cost ${formatUsd(dto.totals.estimatedCostUsd)}`;
  const unknownCost =
    dto.unknownCostEvents === 0
      ? 'unknown 0'
      : `unknown ${dto.unknownCostEvents}/${formatInteger(dto.unknownCostTokens)} tok`;
  const budget =
    dto.budgets.warningCount === 0 ? 'budgets ok' : `budgets ${dto.budgets.warningCount} warn`;
  return [
    'TokenWatch',
    dto.window,
    dto.range.label,
    `${formatInteger(dto.totals.events)} events`,
    `${formatInteger(dto.totals.tokens)} tokens`,
    cost,
    unknownCost,
    budget,
    `model ${dto.top.model}`,
    `source ${dto.top.sourceName}`,
    `project ${dto.top.project}`
  ].join(' | ');
}

export function renderStatuslinePresetText(dto: StatuslinePresetDto): string {
  const cost =
    dto.totals.estimatedCostUsd === null
      ? 'cost unknown'
      : `cost ${formatUsd(dto.totals.estimatedCostUsd)}`;
  const budget = renderBudgetPressure(dto.budgetPressure);
  return [
    'TokenWatch',
    dto.preset,
    dto.window,
    `${formatInteger(dto.totals.tokens)} tokens`,
    `${formatInteger(dto.recent.tokensPerMinute)}/min`,
    cost,
    `unknown ${dto.unknownCostEvents}`,
    budget,
    `model ${dto.top.model}`,
    `source ${dto.top.sourceName}`,
    `project ${dto.top.project}`
  ].join(' | ');
}

type StatuslineBase = {
  readonly now: Date;
  readonly window: StatuslineWindow;
  readonly range: LocalRange;
  readonly includedEvents: readonly UsageEvent[];
  readonly totals: StatuslineDto['totals'];
  readonly knownEstimatedCostUsd: number | null;
  readonly unknownCostEvents: readonly UsageEvent[];
  readonly budgets: StatuslineBudgets;
  readonly top: StatuslineTopLabels;
};
