import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { buildInsightsCommandReport } from '../src/services/insightsCommandReport.js';
import { InsightsService } from '../src/services/insightsService.js';
import { TrendService } from '../src/services/trendService.js';
import { containsPrivacySentinel } from './helpers.js';

const generatedAt = '2026-06-04T00:00:00.000Z';

describe('buildInsightsCommandReport', () => {
  it('passes budget evaluations into both insights and trend reports', () => {
    const overBudgetEvaluation: BudgetEvaluation = {
      scopeKind: 'monthly_total',
      sourceName: null,
      month: '2026-06',
      knownSpendUsd: 5,
      thresholdUsd: 4,
      status: 'over',
      unknownCostEventCount: 0,
      unknownCostTokenCount: 0,
      warningRows: [
        { code: 'budget_threshold_exceeded', scopeKind: 'monthly_total', sourceName: null }
      ]
    };

    const command = buildInsightsCommandReport({
      services: {
        insights: new InsightsService(() => new Date(generatedAt)),
        trend: new TrendService()
      },
      events: [],
      budgets: [overBudgetEvaluation],
      window: '7d'
    });

    expect(command).toMatchObject({
      kind: 'insights-command',
      insights: { kind: 'insights', budgetPressure: { status: 'over', ratio: 1.25 } },
      trend: { kind: 'trend', budgetPressure: { status: 'over', ratio: 1.25 } }
    });
    expect(containsPrivacySentinel(command)).toBe(false);
  });
});
