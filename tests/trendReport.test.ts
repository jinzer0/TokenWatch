import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { trendReportOptionsSchema, trendReportSchema } from '../src/services/reportContracts.js';
import { TrendService } from '../src/services/trendService.js';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

const emptyTrendReport = {
  version: 1,
  kind: 'trend',
  generatedAt: '2026-06-04T00:00:00.000Z',
  window: '30d',
  trendScope: 'all-events-rolling',
  range: {
    current: {
      from: '2026-05-05T00:00:00.000Z',
      to: '2026-06-04T00:00:00.000Z'
    },
    previous: {
      from: '2026-04-05T00:00:00.000Z',
      to: '2026-05-05T00:00:00.000Z'
    }
  },
  totals: {
    current: {
      events: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      estimatedCostUsd: null,
      knownEstimatedCostUsd: null,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    },
    previous: {
      events: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      estimatedCostUsd: null,
      knownEstimatedCostUsd: null,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    },
    deltaPercent: null,
    direction: 'flat'
  },
  cacheHitRatio: {
    current: { status: 'ok', value: 0 },
    previous: { status: 'ok', value: 0 },
    deltaPercent: null,
    direction: 'flat'
  },
  budgetPressure: {
    status: 'not_configured',
    ratio: null,
    knownSpendUsd: null,
    thresholdUsd: null,
    unknownCostEvents: 0,
    unknownCostTokens: 0
  },
  rows: [],
  warnings: [],
  confidence: { level: 'high', reasons: [] },
  privacy: { sanitized: true }
};

describe('trend report contracts', () => {
  it('parses an empty safe trend report with sanitized privacy metadata', () => {
    const report = trendReportSchema.parse(emptyTrendReport);

    expect(report).toMatchObject({
      version: 1,
      kind: 'trend',
      window: '30d',
      trendScope: 'all-events-rolling',
      totals: { direction: 'flat', deltaPercent: null },
      cacheHitRatio: { direction: 'flat', deltaPercent: null },
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
  });

  it('parses trend metric rows with strict unknown pricing semantics', () => {
    const report = trendReportSchema.parse({
      ...emptyTrendReport,
      rows: [
        {
          category: 'model',
          label: 'gpt-5.5-fast',
          metric: 'tokens',
          current: {
            events: 2,
            tokens: 300,
            inputTokens: 240,
            outputTokens: 60,
            cachedTokens: 30,
            reasoningTokens: 10,
            estimatedCostUsd: null,
            knownEstimatedCostUsd: 0.12,
            unknownCostEvents: 1,
            unknownCostTokens: 100
          },
          previous: {
            events: 1,
            tokens: 100,
            inputTokens: 80,
            outputTokens: 20,
            cachedTokens: 10,
            reasoningTokens: 5,
            estimatedCostUsd: 0.04,
            knownEstimatedCostUsd: 0.04,
            unknownCostEvents: 0,
            unknownCostTokens: 0
          },
          deltaPercent: 200,
          direction: 'up'
        }
      ]
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        category: 'model',
        label: 'gpt-5.5-fast',
        current: expect.objectContaining({ estimatedCostUsd: null, unknownCostEvents: 1 })
      })
    ]);
  });

  it('parses supported windows while rejecting invalid windows and unsafe labels', () => {
    expect(trendReportOptionsSchema.parse({ window: '7d' })).toEqual({ window: '7d' });
    expect(trendReportOptionsSchema.parse({ window: '30d' })).toEqual({ window: '30d' });
    expect(() => trendReportOptionsSchema.parse({ window: 'month' })).toThrow(
      'invalid_report_option'
    );
    expect(() =>
      trendReportSchema.parse({
        ...emptyTrendReport,
        rows: [
          {
            category: 'model',
            label: 'select * from usage_events',
            metric: 'tokens',
            current: emptyTrendReport.totals.current,
            previous: emptyTrendReport.totals.previous,
            deltaPercent: null,
            direction: 'unknown'
          }
        ]
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      trendReportSchema.parse({ ...emptyTrendReport, rawSessionId: 'unsafe' })
    ).toThrow();
  });
});

describe('TrendService', () => {
  it('builds 7d UTC rolling trend ranges with included from and excluded to boundaries', () => {
    const service = new TrendService();
    const parsed = trendReportSchema.parse(
      service.build(
        [
          event('2026-06-25T00:00:00.000Z', 100, 0.1, {
            model: 'current-from-model',
            source: 'codex',
            sourceName: 'lab-current',
            workspaceLabel: 'client-a',
            inputTokens: 70,
            outputTokens: 20,
            cachedTokens: 10,
            reasoningTokens: 5,
            metadata: { parser: 'test', schemaVariant: 'unit', projectLabelSource: 'config' }
          }),
          event('2026-06-24T23:59:59.999Z', 50, 0.05, {
            model: 'previous-edge-model',
            sourceName: 'lab-previous'
          }),
          event('2026-07-02T00:00:00.000Z', 1000, 1, { model: 'excluded-to-model' })
        ],
        { window: '7d', now: new Date('2026-07-02T00:00:00.000Z') }
      )
    );

    expect(parsed).toMatchObject({
      generatedAt: '2026-07-02T00:00:00.000Z',
      window: '7d',
      trendScope: 'all-events-rolling',
      range: {
        current: {
          from: '2026-06-25T00:00:00.000Z',
          to: '2026-07-02T00:00:00.000Z'
        },
        previous: {
          from: '2026-06-18T00:00:00.000Z',
          to: '2026-06-25T00:00:00.000Z'
        }
      },
      totals: {
        current: {
          events: 1,
          tokens: 100,
          inputTokens: 70,
          outputTokens: 20,
          cachedTokens: 10,
          reasoningTokens: 5,
          estimatedCostUsd: 0.1,
          knownEstimatedCostUsd: 0.1
        },
        previous: {
          events: 1,
          tokens: 50,
          inputTokens: 50,
          outputTokens: 0,
          cachedTokens: 0,
          reasoningTokens: 0,
          estimatedCostUsd: 0.05,
          knownEstimatedCostUsd: 0.05
        },
        deltaPercent: 100,
        direction: 'up'
      },
      cacheHitRatio: {
        current: { status: 'ok', value: 10 / 80 },
        previous: { status: 'ok', value: 0 },
        deltaPercent: null,
        direction: 'new'
      },
      budgetPressure: { status: 'not_configured', ratio: null }
    });
    expect(parsed.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['current-from-model', 'codex', 'lab-current', 'client-a'])
    );
    expect(parsed.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'total', label: 'total events' }),
        expect.objectContaining({ category: 'total', label: 'total tokens' }),
        expect.objectContaining({ category: 'total', label: 'total cost' }),
        expect.objectContaining({ category: 'model', label: 'current-from-model' }),
        expect.objectContaining({ category: 'source', label: 'codex' }),
        expect.objectContaining({ category: 'sourceName', label: 'lab-current' }),
        expect.objectContaining({ category: 'project', label: 'client-a' })
      ])
    );
    expect(parsed.rows.map((row) => row.label)).not.toContain('excluded-to-model');
    expect(containsPrivacySentinel(parsed)).toBe(false);
  });

  it('builds 30d rolling trends with new direction for empty previous window', () => {
    const service = new TrendService();
    const parsed = trendReportSchema.parse(
      service.build([event('2026-06-15T12:00:00.000Z', 200, 0.2)], {
        window: '30d',
        now: '2026-07-02T00:00:00.000Z'
      })
    );

    expect(parsed.range).toEqual({
      current: { from: '2026-06-02T00:00:00.000Z', to: '2026-07-02T00:00:00.000Z' },
      previous: { from: '2026-05-03T00:00:00.000Z', to: '2026-06-02T00:00:00.000Z' }
    });
    expect(parsed.totals).toMatchObject({
      current: { events: 1, tokens: 200, estimatedCostUsd: 0.2 },
      previous: { events: 0, tokens: 0, estimatedCostUsd: null },
      deltaPercent: null,
      direction: 'new'
    });
    expect(Number.isFinite(parsed.totals.deltaPercent ?? 0)).toBe(true);
  });

  it('reports flat direction for zero current and zero previous trend totals', () => {
    const service = new TrendService();

    const parsed = trendReportSchema.parse(
      service.build([], { window: '7d', now: '2026-07-02T00:00:00.000Z' })
    );

    expect(parsed.totals).toMatchObject({
      current: { events: 0, tokens: 0, inputTokens: 0, cachedTokens: 0 },
      previous: { events: 0, tokens: 0, inputTokens: 0, cachedTokens: 0 },
      deltaPercent: null,
      direction: 'flat'
    });
    expect(parsed.cacheHitRatio).toMatchObject({
      current: { status: 'ok', value: 0 },
      previous: { status: 'ok', value: 0 },
      direction: 'flat'
    });
  });

  it('includes budget pressure when budget evaluations are supplied to trend options', () => {
    const service = new TrendService();
    const budgets: readonly BudgetEvaluation[] = [
      {
        scopeKind: 'monthly_total',
        sourceName: null,
        month: '2026-07',
        knownSpendUsd: 3,
        thresholdUsd: 6,
        status: 'unknown-costs-present',
        unknownCostEventCount: 2,
        unknownCostTokenCount: 120,
        warningRows: [
          { code: 'budget_unknown_cost_present', scopeKind: 'monthly_total', sourceName: null }
        ]
      }
    ];
    const options = { window: '7d', now: '2026-07-02T00:00:00.000Z', budgets };

    const parsed = trendReportSchema.parse(service.build([], options));

    expect(parsed.budgetPressure).toEqual({
      status: 'unknown-costs-present',
      ratio: 0.5,
      knownSpendUsd: 3,
      thresholdUsd: 6,
      unknownCostEvents: 2,
      unknownCostTokens: 120
    });
  });

  it('keeps unknown cost separate and marks cost deltas unknown', () => {
    const service = new TrendService();
    const parsed = trendReportSchema.parse(
      service.build(
        [
          event('2026-06-28T00:00:00.000Z', 100, null, { model: 'unknown-current' }),
          event('2026-06-22T00:00:00.000Z', 150, 0.15, { model: 'unknown-current' })
        ],
        { window: '7d', now: '2026-07-02T00:00:00.000Z' }
      )
    );
    const costRow = parsed.rows.find(
      (row) => row.category === 'total' && row.label === 'total cost'
    );

    expect(parsed.totals).toMatchObject({
      current: {
        events: 1,
        tokens: 100,
        estimatedCostUsd: null,
        unknownCostEvents: 1,
        unknownCostTokens: 100
      },
      previous: { events: 1, tokens: 150, estimatedCostUsd: 0.15, knownEstimatedCostUsd: 0.15 },
      deltaPercent: -33.333333,
      direction: 'down'
    });
    expect(costRow).toMatchObject({
      category: 'total',
      metric: 'cost',
      current: { estimatedCostUsd: null, unknownCostEvents: 1, unknownCostTokens: 100 },
      previous: { estimatedCostUsd: 0.15 },
      deltaPercent: null,
      direction: 'unknown'
    });
  });

  it('handles empty current windows and rejects invalid windows through the option parser', () => {
    const service = new TrendService();
    const parsed = trendReportSchema.parse(
      service.build([event('2026-06-21T00:00:00.000Z', 100, 0.1)], {
        window: '7d',
        now: '2026-07-02T00:00:00.000Z'
      })
    );

    expect(parsed.totals).toMatchObject({
      current: { events: 0, tokens: 0, estimatedCostUsd: null },
      previous: { events: 1, tokens: 100, estimatedCostUsd: 0.1 },
      deltaPercent: -100,
      direction: 'down'
    });
    expect(parsed.rows.find((row) => row.label === 'unknown')).toBeUndefined();
    expect(Number.isFinite(parsed.totals.deltaPercent ?? 0)).toBe(true);
    expect(() => service.build([], { window: 'month', now: '2026-07-02T00:00:00.000Z' })).toThrow(
      'invalid_report_option'
    );
  });
});

function event(
  timestamp: string,
  totalTokens: number,
  estimatedCostUsd: number | null,
  overrides: Parameters<typeof createTestEvent>[0] = {}
) {
  return createTestEvent({
    timestamp,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens,
    estimatedCostUsd,
    ...overrides
  });
}
