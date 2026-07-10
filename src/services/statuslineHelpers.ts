import { z } from 'zod';
import type { UsageEvent } from '../models/usageEvent.js';
import type { BudgetEvaluation } from './budgetService.js';
import { groupEventsByPublicProject, UNKNOWN_PROJECT_KEY } from './projectAttribution.js';
import {
  statuslineMetricPresets,
  statuslineWindows,
  type StatuslineBudgets,
  type StatuslineDto,
  type StatuslineMetricPreset,
  type StatuslinePresetDto,
  type StatuslineTopLabels,
  type StatuslineWindow
} from './statuslineContract.js';
import { StatuslineError } from './statuslineErrors.js';

export type LocalRange = {
  readonly label: string;
  readonly budgetMonth: string;
  readonly from: Date;
  readonly to: Date;
  readonly toExclusive: Date;
};

export function parseStatuslineWindow(value: unknown): StatuslineWindow {
  const parsed = z.enum(statuslineWindows).safeParse(value);
  if (!parsed.success) {
    throw new StatuslineError('invalid_statusline_window');
  }
  return parsed.data;
}

export function parseStatuslineMetricPreset(value: unknown): StatuslineMetricPreset {
  const parsed = z.enum(statuslineMetricPresets).safeParse(value);
  if (!parsed.success) {
    throw new StatuslineError('invalid_statusline_preset');
  }
  return parsed.data;
}

export function localRange(window: StatuslineWindow, now: Date): LocalRange {
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

export function isInRange(event: UsageEvent, range: LocalRange): boolean {
  const time = Date.parse(event.timestamp);
  return time >= range.from.getTime() && time < range.toExclusive.getTime();
}

export function rangeDto(range: LocalRange): StatuslineDto['range'] {
  return { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() };
}

export function recentMetrics(
  events: readonly UsageEvent[],
  now: Date
): StatuslinePresetDto['recent'] {
  const minutes = 10;
  const from = new Date(now.getTime() - minutes * 60_000);
  const recentEvents = events.filter((event) => {
    const time = Date.parse(event.timestamp);
    return time >= from.getTime() && time <= now.getTime();
  });
  const tokens = sumTokens(recentEvents);
  return {
    minutes,
    range: { label: `${minutes}m`, from: from.toISOString(), to: now.toISOString() },
    tokens,
    tokensPerMinute: tokens / minutes
  };
}

export function allKnownCost(events: readonly UsageEvent[]): number | null {
  if (events.length === 0 || events.some((event) => event.estimatedCostUsd === null)) {
    return null;
  }
  return knownCost(events);
}

export function knownCost(events: readonly UsageEvent[]): number | null {
  const known = events.filter((event) => event.estimatedCostUsd !== null);
  if (known.length === 0) {
    return null;
  }
  return roundUsd(known.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0));
}

export function buildBudgets(
  budgets: readonly BudgetEvaluation[],
  range: LocalRange
): StatuslineBudgets {
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

export function budgetPressure(budgets: StatuslineBudgets): StatuslinePresetDto['budgetPressure'] {
  const maxPercent = budgets.rows.reduce<number | null>((current, row) => {
    const percent = Math.round((row.knownSpendUsd / row.thresholdUsd) * 100);
    return current === null ? percent : Math.max(current, percent);
  }, null);
  return {
    status: budgetPressureStatus(budgets),
    maxPercent,
    warningCount: budgets.warningCount,
    overCount: budgets.overCount,
    unknownCostCount: budgets.unknownCostCount,
    unknownCostEvents: budgets.rows.reduce((total, row) => total + row.unknownCostEvents, 0),
    unknownCostTokens: budgets.rows.reduce((total, row) => total + row.unknownCostTokens, 0)
  };
}

export function renderBudgetPressure(pressure: StatuslinePresetDto['budgetPressure']): string {
  switch (pressure.status) {
    case 'not_configured':
      return 'budget ok';
    case 'ok':
      return 'budget ok';
    case 'over':
      return `budget ${pressure.maxPercent ?? 0}% over`;
    case 'unknown-costs-present':
      return `budget ${pressure.maxPercent ?? 0}% unknown`;
  }
}

export function buildTopLabels(
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

export function sumTokens(events: readonly UsageEvent[]): number {
  return events.reduce((total, event) => total + event.totalTokens, 0);
}

function budgetPressureStatus(
  budgets: StatuslineBudgets
): StatuslinePresetDto['budgetPressure']['status'] {
  if (budgets.rows.length === 0) return 'not_configured';
  if (budgets.overCount > 0) return 'over';
  if (budgets.unknownCostCount > 0) return 'unknown-costs-present';
  return 'ok';
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
