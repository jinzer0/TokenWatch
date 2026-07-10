import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareReportService } from '../src/services/shareReport.js';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { createTempDb, createTestEvent } from './helpers.js';
import { assertExportFilePrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';

const overBudgetEvaluation: BudgetEvaluation = {
  scopeKind: 'monthly_total',
  sourceName: null,
  month: '2026-01',
  knownSpendUsd: 0.25,
  thresholdUsd: 0.2,
  status: 'over',
  unknownCostEventCount: 1,
  unknownCostTokenCount: 400,
  warningRows: [
    { code: 'budget_threshold_exceeded', scopeKind: 'monthly_total', sourceName: null },
    { code: 'budget_unknown_cost_present', scopeKind: 'monthly_total', sourceName: null }
  ]
};

function createBudgetEvents() {
  return [
    createTestEvent({
      timestamp: '2026-01-02T00:00:00.000Z',
      rawIdHash: 'known-cost-budget',
      inputTokens: 120,
      outputTokens: 80,
      cachedTokens: 0,
      totalTokens: 200,
      estimatedCostUsd: 0.25
    }),
    {
      ...createTestEvent({
        timestamp: '2026-01-03T00:00:00.000Z',
        rawIdHash: 'unknown-cost-budget',
        inputTokens: 300,
        outputTokens: 100,
        cachedTokens: 0,
        totalTokens: 400
      }),
      estimatedCostUsd: null
    }
  ];
}

describe('safe share report budget pressure', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes budget evaluations into standalone insights JSON exports', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-09T00:00:00.000Z'));
    const temp = createTempDb();
    try {
      // Given: standalone insights export input and an over-budget monthly evaluation.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'insights-budget-share.json');

      // When: the share report is written with precomputed budget evaluations.
      await service.write({
        budgets: [overBudgetEvaluation],
        events: createBudgetEvents(),
        format: 'json',
        outputPath,
        report: { kind: 'insights', window: '7d' }
      });

      // Then: the exported aggregate report preserves budget pressure and privacy.
      const contents = await readFile(outputPath, 'utf8');
      const payload: unknown = JSON.parse(contents);
      expect(payload).toMatchObject({
        kind: 'insights',
        budgetPressure: {
          status: 'over',
          ratio: 1.25,
          knownSpendUsd: 0.25,
          thresholdUsd: 0.2,
          unknownCostEvents: 1,
          unknownCostTokens: 400
        }
      });
      expect(contents).not.toContain('$0.00');
      assertJsonOutputPrivacy(payload);
      assertExportFilePrivacy(contents);
    } finally {
      temp.cleanup();
    }
  });

  it('passes budget evaluations into standalone trend JSON exports', async () => {
    const temp = createTempDb();
    try {
      // Given: standalone trend export input and an over-budget monthly evaluation.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'trend-budget-share.json');

      // When: the share report is written with precomputed budget evaluations.
      await service.write({
        budgets: [overBudgetEvaluation],
        events: createBudgetEvents(),
        format: 'json',
        outputPath,
        report: { kind: 'trend', window: '30d' }
      });

      // Then: the exported aggregate report preserves budget pressure and privacy.
      const contents = await readFile(outputPath, 'utf8');
      const payload: unknown = JSON.parse(contents);
      expect(payload).toMatchObject({
        kind: 'trend',
        budgetPressure: {
          status: 'over',
          ratio: 1.25,
          knownSpendUsd: 0.25,
          thresholdUsd: 0.2,
          unknownCostEvents: 1,
          unknownCostTokens: 400
        }
      });
      expect(contents).not.toContain('$0.00');
      assertJsonOutputPrivacy(payload);
      assertExportFilePrivacy(contents);
    } finally {
      temp.cleanup();
    }
  });
});
