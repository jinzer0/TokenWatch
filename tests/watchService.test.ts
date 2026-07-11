import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { watchTickReportSchema } from '../src/services/reportContracts.js';
import { WatchService, parseWatchInterval } from '../src/services/watchService.js';
import { createTestEvent } from './helpers.js';
import { assertNoForbiddenOutput } from './privacyOutput.js';

const service = new WatchService();

describe('watch service interval parser', () => {
  it('accepts integer milliseconds, seconds, and minutes when at least five seconds', () => {
    expect([
      parseWatchInterval('5000'),
      parseWatchInterval('5s'),
      parseWatchInterval('30s'),
      parseWatchInterval('1m')
    ]).toEqual([5_000, 5_000, 30_000, 60_000]);
  });

  it('rejects malformed, sub-five-second, and sentinel-shaped intervals', () => {
    for (const value of [
      '',
      '0',
      '4999',
      '4s',
      '-5s',
      '1.5s',
      '1m30s',
      'five seconds',
      'off',
      'RAW_PATH_SENTINEL_DO_NOT_LEAK'
    ]) {
      expect(() => parseWatchInterval(value)).toThrow('invalid_report_option');
    }
  });
});

describe('watch service tick builder', () => {
  it('builds an empty immediate tick for the rolling UTC interval', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');

    const tick = service.buildTick([], { now, intervalMs: 60_000 });

    expect(tick).toMatchObject({
      kind: 'watch_tick',
      timestamp: '2026-06-04T00:10:00.000Z',
      intervalMs: 60_000,
      delta: {
        events: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: null,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      velocity: { tokensPerMinute: 0, estimatedCostUsdPerHour: null },
      top: { model: 'unknown', sourceName: 'unknown', project: 'unknown' },
      budgets: {
        status: 'not_configured',
        warningCount: 0,
        exceededCount: 0,
        unknownCount: 0,
        rows: []
      },
      privacy: { sanitized: true }
    });
    expect(watchTickReportSchema.parse(tick)).toEqual(tick);
    assertNoForbiddenOutput(tick);
  });

  it('uses non-cumulative deltas from the half-open rolling window and exact velocity denominator', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('outside-start', '2026-06-04T00:09:00.000Z', { totalTokens: 1 }),
      event('inside-added', '2026-06-04T00:09:00.001Z', {
        inputTokens: 80,
        outputTokens: 20,
        cachedTokens: 5,
        reasoningTokens: 7,
        totalTokens: 100,
        estimatedCostUsd: 0.02
      }),
      event('inside-end', '2026-06-04T00:10:00.000Z', {
        inputTokens: 40,
        outputTokens: 10,
        cachedTokens: 3,
        reasoningTokens: 2,
        totalTokens: 50,
        estimatedCostUsd: 0.01
      }),
      event('future', '2026-06-04T00:10:00.001Z', { totalTokens: 999 })
    ];

    const tick = service.buildTick(events, { now, intervalMs: 60_000 });

    expect(tick.delta).toEqual({
      events: 2,
      tokens: 150,
      inputTokens: 120,
      outputTokens: 30,
      cachedTokens: 8,
      reasoningTokens: 9,
      estimatedCostUsd: 0.03,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    });
    expect(tick.velocity).toEqual({ tokensPerMinute: 150, estimatedCostUsdPerHour: 1.8 });
  });

  it('keeps cost deltas and cost velocity unknown when the tick contains unknown-cost events', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('known', '2026-06-04T00:09:30.001Z', { totalTokens: 100, estimatedCostUsd: 0.02 }),
      unknownCostEvent('unknown', '2026-06-04T00:09:45.000Z', { totalTokens: 200 })
    ];

    const tick = service.buildTick(events, { now, intervalMs: 30_000 });

    expect(tick.delta).toMatchObject({
      events: 2,
      tokens: 300,
      estimatedCostUsd: null,
      unknownCostEvents: 1,
      unknownCostTokens: 200
    });
    expect(tick.velocity).toEqual({ tokensPerMinute: 600, estimatedCostUsdPerHour: null });
  });

  it('applies source and sourceName filters before delta, top labels, and budgets', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('codex-local', '2026-06-04T00:09:30.000Z', {
        source: 'codex',
        sourceName: 'local',
        model: 'gpt-5.5-fast',
        workspaceLabel: 'client-alpha',
        metadata: { projectLabelSource: 'scan-option' },
        totalTokens: 100,
        estimatedCostUsd: 0.01
      }),
      event('opencode-local', '2026-06-04T00:09:40.000Z', {
        source: 'opencode',
        sourceName: 'local',
        model: 'claude-sonnet-4',
        totalTokens: 500,
        estimatedCostUsd: 0.05
      }),
      event('codex-lab', '2026-06-04T00:09:50.000Z', {
        source: 'codex',
        sourceName: 'lab-server',
        model: 'gpt-5.5-slow',
        totalTokens: 900,
        estimatedCostUsd: 0.09
      })
    ];

    const tick = service.buildTick(events, {
      now,
      intervalMs: 60_000,
      source: 'codex',
      sourceName: 'local',
      budgets: [
        budgetEvaluation('monthly_total', null, 'ok', []),
        budgetEvaluation('sourceName', 'local', 'over', ['budget_threshold_exceeded']),
        budgetEvaluation('sourceName', 'lab-server', 'unknown-costs-present', [
          'budget_unknown_cost_present'
        ])
      ]
    });

    expect(tick.delta).toMatchObject({ events: 1, tokens: 100, estimatedCostUsd: 0.01 });
    expect(tick.top).toEqual({
      model: 'gpt-5.5-fast',
      sourceName: 'local',
      project: 'client-alpha'
    });
    expect(tick.budgets).toMatchObject({
      status: 'exceeded',
      warningCount: 1,
      exceededCount: 1,
      unknownCount: 0,
      rows: expect.arrayContaining([
        expect.objectContaining({ status: 'ok', scopeKind: 'monthly_total' }),
        expect.objectContaining({
          status: 'exceeded',
          sourceName: 'local',
          warnings: ['budget_threshold_exceeded']
        })
      ])
    });
    expect(JSON.stringify(tick)).not.toContain('lab-server');
  });

  it('includes configured ok budget rows and reports ok when every matching budget is ok', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');

    const tick = service.buildTick([], {
      now,
      intervalMs: 60_000,
      sourceName: 'local',
      budgets: [
        budgetEvaluation('monthly_total', null, 'ok', []),
        budgetEvaluation('sourceName', 'local', 'ok', []),
        overBudget('lab-server')
      ]
    });

    expect(tick.budgets).toMatchObject({
      status: 'ok',
      warningCount: 0,
      exceededCount: 0,
      unknownCount: 0,
      rows: expect.arrayContaining([
        expect.objectContaining({ status: 'ok', scopeKind: 'monthly_total' }),
        expect.objectContaining({ status: 'ok', scopeKind: 'sourceName', sourceName: 'local' })
      ])
    });
    expect(tick.budgets.rows).toHaveLength(2);
    expect(JSON.stringify(tick)).not.toContain('lab-server');
  });

  it('summarizes canonical budget rows with unknown status when unknown rows are most severe', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');

    const tick = service.buildTick([], {
      now,
      intervalMs: 60_000,
      budgets: [budgetEvaluation('monthly_total', null, 'ok', []), unknownBudget('local')]
    });

    expect(tick.budgets).toMatchObject({
      status: 'unknown',
      warningCount: 1,
      exceededCount: 0,
      unknownCount: 1,
      rows: expect.arrayContaining([
        expect.objectContaining({ status: 'ok', scopeKind: 'monthly_total' }),
        expect.objectContaining({ label: 'local', status: 'unknown' })
      ])
    });
  });
});

type EventOverrides = Parameters<typeof createTestEvent>[0];

function event(rawIdHash: string, timestamp: string, overrides: EventOverrides = {}) {
  const totalTokens = overrides.totalTokens ?? 140;
  return createTestEvent({
    rawIdHash,
    timestamp,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens,
    estimatedCostUsd: 0.01,
    ...overrides
  });
}

function unknownCostEvent(rawIdHash: string, timestamp: string, overrides: EventOverrides = {}) {
  return { ...event(rawIdHash, timestamp, overrides), estimatedCostUsd: null };
}

function overBudget(sourceName: string): BudgetEvaluation {
  return budgetEvaluation('sourceName', sourceName, 'over', ['budget_threshold_exceeded']);
}

function unknownBudget(sourceName: string): BudgetEvaluation {
  return budgetEvaluation('sourceName', sourceName, 'unknown-costs-present', [
    'budget_unknown_cost_present'
  ]);
}

function budgetEvaluation(
  scopeKind: BudgetEvaluation['scopeKind'],
  sourceName: string | null,
  status: BudgetEvaluation['status'],
  warnings: BudgetEvaluation['warningRows'][number]['code'][]
): BudgetEvaluation {
  return {
    scopeKind,
    sourceName,
    month: '2026-06',
    knownSpendUsd: status === 'over' ? 12 : 4,
    thresholdUsd: 10,
    status,
    unknownCostEventCount: status === 'unknown-costs-present' ? 1 : 0,
    unknownCostTokenCount: status === 'unknown-costs-present' ? 100 : 0,
    warningRows: warnings.map((code) => ({ code, scopeKind, sourceName }))
  };
}
