import { describe, expect, it, vi } from 'vitest';
import { AggregatorService } from '../src/services/aggregator.js';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { TrendService } from '../src/services/trendService.js';
import { createTestEvent } from './helpers.js';

const overBudgetEvaluation: BudgetEvaluation = {
  scopeKind: 'monthly_total',
  sourceName: null,
  month: '2026-06',
  knownSpendUsd: 0.4,
  thresholdUsd: 0.2,
  status: 'over',
  unknownCostEventCount: 0,
  unknownCostTokenCount: 0,
  warningRows: [{ code: 'budget_threshold_exceeded', scopeKind: 'monthly_total', sourceName: null }]
};

describe('TUI trend budget pressure propagation', () => {
  it('passes budget evaluations into TUI trend report generation', () => {
    const budgets = [overBudgetEvaluation];
    const events = [
      createTestEvent({
        timestamp: new Date().toISOString(),
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        reasoningTokens: 0,
        totalTokens: 150,
        estimatedCostUsd: 0.4
      })
    ];
    const buildTrend = vi.spyOn(TrendService.prototype, 'build');

    // Given: TUI data has current budget evaluations available.
    const aggregator = new AggregatorService();

    // When: TUI analytics rows are built.
    const tuiData = aggregator.buildTuiData(events, [], undefined, budgets);

    // Then: trend report generation receives the same budget evaluations.
    expect(buildTrend).toHaveBeenCalledWith(
      events,
      expect.objectContaining({ budgets, window: '7d' })
    );

    const budgetPressureRow = tuiData.insightsRows.find(
      (row) => row.metric === 'budget_pressure'
    );

    expect(budgetPressureRow).toEqual(
      expect.objectContaining({
        metric: 'budget_pressure',
        status: 'over',
        current: '200.00%',
        knownEstimatedCostUsd: 0.4,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      })
    );
  });
});
