import { z } from 'zod';
import type { UsageEvent } from '../models/usageEvent.js';
import { formatInteger, formatUsd } from '../utils/format.js';
import { AggregatorService } from './aggregator.js';
import type { BudgetEvaluation } from './budgetService.js';
import { groupEventsByPublicProject, UNKNOWN_PROJECT_KEY } from './projectAttribution.js';
import {
  statuslineSchema,
  statuslineWindows,
  type BuildStatuslineOptions,
  type StatuslineBudgets,
  type StatuslineDto,
  type StatuslineTopLabels,
  type StatuslineWindow
} from './statuslineContract.js';

export type {
  BuildStatuslineOptions,
  StatuslineDto,
  StatuslineWindow
} from './statuslineContract.js';

export class StatuslineError extends Error {
  constructor(readonly code: 'invalid_statusline_window') {
    super(code);
    this.name = 'StatuslineError';
  }
}

export class StatuslineService {
  private readonly aggregator = new AggregatorService();

  build(events: readonly UsageEvent[], options: BuildStatuslineOptions = {}): StatuslineDto {
    const window = parseStatuslineWindow(options.window ?? 'today');
    const now = options.now ?? new Date();
    const range = localRange(window, now);
    const includedEvents = events.filter((event) => isInRange(event, range));
    const totals = this.aggregator.summarize([...includedEvents]);
    const unknownCostEvents = includedEvents.filter((event) => event.estimatedCostUsd === null);
    const knownEstimatedCostUsd = knownCost(includedEvents);
    const dto = {
      version: 1,
      kind: 'statusline',
      generatedAt: now.toISOString(),
      window,
      range: { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        events: totals.totalEvents,
        tokens: totals.totalTokens,
        inputTokens: totals.totalInputTokens,
        outputTokens: totals.totalOutputTokens,
        cachedTokens: totals.totalCachedTokens,
        estimatedCostUsd: allKnownCost(includedEvents)
      },
      knownEstimatedCostUsd,
      unknownCostEvents: unknownCostEvents.length,
      unknownCostTokens: unknownCostEvents.reduce((total, event) => total + event.totalTokens, 0),
      budgets: buildBudgets(options.budgets ?? [], range),
      top: buildTopLabels(includedEvents, totals.topModel, totals.topSourceName),
      privacy: { sanitized: true }
    } satisfies StatuslineDto;
    return statuslineSchema.parse(dto);
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

function parseStatuslineWindow(value: unknown): StatuslineWindow {
  const parsed = z.enum(statuslineWindows).safeParse(value);
  if (!parsed.success) {
    throw new StatuslineError('invalid_statusline_window');
  }
  return parsed.data;
}

type LocalRange = {
  readonly label: string;
  readonly budgetMonth: string;
  readonly from: Date;
  readonly to: Date;
  readonly toExclusive: Date;
};

function localRange(window: StatuslineWindow, now: Date): LocalRange {
  switch (window) {
    case 'today': {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        label: localDayLabel(now),
        budgetMonth: localMonthLabel(now),
        from,
        to,
        toExclusive: new Date(to.getTime() + 1)
      };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      const budgetMonth = localMonthLabel(now);
      return { label: budgetMonth, budgetMonth, from, to, toExclusive: to };
    }
  }
}

function isInRange(event: UsageEvent, range: LocalRange): boolean {
  const time = Date.parse(event.timestamp);
  return time >= range.from.getTime() && time < range.toExclusive.getTime();
}

function allKnownCost(events: readonly UsageEvent[]): number | null {
  if (events.length === 0 || events.some((event) => event.estimatedCostUsd === null)) {
    return null;
  }
  return knownCost(events);
}

function knownCost(events: readonly UsageEvent[]): number | null {
  const known = events.filter((event) => event.estimatedCostUsd !== null);
  if (known.length === 0) {
    return null;
  }
  return roundUsd(known.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0));
}

function buildBudgets(budgets: readonly BudgetEvaluation[], range: LocalRange): StatuslineBudgets {
  const rows = budgets
    .filter((budget) => budget.month === range.budgetMonth && budget.warningRows.length > 0)
    .map((budget) => ({
      scopeKind: budget.scopeKind,
      sourceName: budget.sourceName,
      month: budget.month,
      status: budget.status,
      knownSpendUsd: budget.knownSpendUsd,
      thresholdUsd: budget.thresholdUsd,
      unknownCostEvents: budget.unknownCostEventCount,
      unknownCostTokens: budget.unknownCostTokenCount,
      warnings: budget.warningRows.map((warning) => warning.code)
    }));
  return {
    warningCount: rows.length,
    overCount: rows.filter((row) => row.status === 'over').length,
    unknownCostCount: rows.filter((row) => row.status === 'unknown-costs-present').length,
    rows
  };
}

function buildTopLabels(
  events: readonly UsageEvent[],
  topModel: string | null,
  topSourceName: string | null
): StatuslineTopLabels {
  return {
    model: topModel ?? 'unknown',
    sourceName: topSourceName ?? 'unknown',
    project: groupEventsByPublicProject(events)[0]?.projectKey ?? UNKNOWN_PROJECT_KEY
  };
}

function localDayLabel(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function localMonthLabel(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
