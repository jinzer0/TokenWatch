import type {
  BudgetScopeKind,
  BudgetThreshold,
  BudgetThresholdInput,
  BudgetThresholdsRepository
} from '../db/repositories/budgetThresholds.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import type { UsageEvent } from '../models/usageEvent.js';
import { localMonthBucket } from '../utils/time.js';

export type BudgetStatus = 'ok' | 'over' | 'unknown-costs-present';

export type BudgetWarningCode = 'budget_threshold_exceeded' | 'budget_unknown_cost_present';

export type BudgetWarningRow = {
  code: BudgetWarningCode;
  scopeKind: BudgetScopeKind;
  sourceName: string | null;
};

export type BudgetEvaluation = {
  scopeKind: BudgetScopeKind;
  sourceName: string | null;
  month: string;
  knownSpendUsd: number;
  thresholdUsd: number;
  status: BudgetStatus;
  unknownCostEventCount: number;
  unknownCostTokenCount: number;
  warningRows: BudgetWarningRow[];
};

export class BudgetService {
  constructor(
    private readonly thresholds: BudgetThresholdsRepository,
    private readonly usageEvents: UsageEventsRepository
  ) {}

  setThreshold(input: BudgetThresholdInput): BudgetThreshold {
    return this.thresholds.set(input);
  }

  listThresholds(): BudgetThreshold[] {
    return this.thresholds.list();
  }

  unsetThreshold(scopeKind: BudgetScopeKind, sourceName?: string | null): boolean {
    return this.thresholds.unset(scopeKind, sourceName);
  }

  evaluateCurrentMonth(now = new Date()): BudgetEvaluation[] {
    const month = localMonthBucket(now.toISOString());
    const events = this.usageEvents
      .listAll()
      .filter((event) => localMonthBucket(event.timestamp) === month);
    return this.thresholds.list().map((threshold) => evaluateThreshold(threshold, events, month));
  }
}

function evaluateThreshold(
  threshold: BudgetThreshold,
  events: UsageEvent[],
  month: string
): BudgetEvaluation {
  const scopedEvents =
    threshold.scopeKind === 'monthly_total'
      ? events
      : events.filter((event) => event.sourceName === threshold.sourceName);
  const knownSpendUsd = roundUsd(
    scopedEvents.reduce(
      (total, event) => total + (event.estimatedCostUsd === null ? 0 : event.estimatedCostUsd),
      0
    )
  );
  const unknownCostEvents = scopedEvents.filter((event) => event.estimatedCostUsd === null);
  const warningRows: BudgetWarningRow[] = [];
  if (knownSpendUsd >= threshold.thresholdUsd) {
    warningRows.push({
      code: 'budget_threshold_exceeded',
      scopeKind: threshold.scopeKind,
      sourceName: threshold.sourceName
    });
  }
  if (unknownCostEvents.length > 0) {
    warningRows.push({
      code: 'budget_unknown_cost_present',
      scopeKind: threshold.scopeKind,
      sourceName: threshold.sourceName
    });
  }
  return {
    scopeKind: threshold.scopeKind,
    sourceName: threshold.sourceName,
    month,
    knownSpendUsd,
    thresholdUsd: threshold.thresholdUsd,
    status: warningRows.some((warning) => warning.code === 'budget_threshold_exceeded')
      ? 'over'
      : unknownCostEvents.length > 0
        ? 'unknown-costs-present'
        : 'ok',
    unknownCostEventCount: unknownCostEvents.length,
    unknownCostTokenCount: unknownCostEvents.reduce((total, event) => total + event.totalTokens, 0),
    warningRows
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
