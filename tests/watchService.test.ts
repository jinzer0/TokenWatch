import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { watchTickReportSchema } from '../src/services/reportContracts.js';
import {
  WatchService,
  WatchServiceError,
  parseWatchInterval,
  parseWatchWindow
} from '../src/services/watchService.js';
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

describe('watch service window parser', () => {
  it('accepts positive integer milliseconds, seconds, and minutes', () => {
    expect([parseWatchWindow('600000'), parseWatchWindow('10m'), parseWatchWindow('30s')]).toEqual([
      600_000, 600_000, 30_000
    ]);
  });

  it('defaults to ten minutes', () => {
    expect(parseWatchWindow()).toBe(600_000);
  });

  it('rejects malformed and non-positive values with a sanitized service error', () => {
    for (const value of [
      '',
      '0',
      '-1s',
      '1.5s',
      '1m30s',
      'ten minutes',
      'RAW_PATH_SENTINEL_DO_NOT_LEAK'
    ]) {
      expect(() => parseWatchWindow(value)).toThrowError(
        new WatchServiceError('invalid_report_option')
      );
    }
  });
});

describe('watch service tick builder', () => {
  it('builds an empty first tick with the canonical v2 rolling window shape', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');

    const tick = service.buildTick([], { now, intervalMs: 5_000, windowMs: 60_000 });

    expect(tick).toMatchObject({
      version: 2,
      kind: 'watch_tick',
      timestamp: '2026-06-04T00:10:00.000Z',
      intervalMs: 5_000,
      windowMs: 60_000,
      filters: { source: [], sourceName: [] },
      delta: {
        events: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: null,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      window: {
        events: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: null,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      velocity: { tokensPerMinute: 0, estimatedCostUsdPerHour: null },
      top: {
        model: 'unknown',
        source: 'unknown',
        sourceName: 'unknown',
        agent: 'unknown',
        project: 'unknown'
      },
      budgets: {
        status: 'not_configured',
        warningCount: 0,
        exceededCount: 0,
        unknownCount: 0,
        rows: []
      },
      privacy: { sanitized: true }
    });
    expect(tick.delta).toEqual(tick.window);
    expect(watchTickReportSchema.parse(tick)).toEqual(tick);
    assertNoForbiddenOutput(tick);
  });

  it('sets a non-empty once or first continuous delta equal to its rolling window', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('inside-window', '2026-06-04T00:09:30.000Z', {
        inputTokens: 80,
        outputTokens: 20,
        cachedTokens: 5,
        reasoningTokens: 7,
        totalTokens: 100,
        estimatedCostUsd: 0.02
      })
    ];

    const tick = service.buildTick(events, { now, intervalMs: 5_000, windowMs: 60_000 });

    expect(tick.window).toEqual({
      events: 1,
      totalTokens: 100,
      inputTokens: 80,
      outputTokens: 20,
      cachedTokens: 5,
      reasoningTokens: 7,
      estimatedCostUsd: 0.02,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    });
    expect(tick.delta).toEqual(tick.window);
    expect(tick.velocity).toEqual({ tokensPerMinute: 100, estimatedCostUsdPerHour: 1.2 });
  });

  it('uses exclusive starts, inclusive now, and ignores future events on later ticks', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const previousTickAt = new Date('2026-06-04T00:09:30.000Z');
    const events = [
      event('window-start', '2026-06-04T00:09:00.000Z', { totalTokens: 10 }),
      event('backfilled', '2026-06-04T00:09:20.000Z', { totalTokens: 20 }),
      event('delta-start', '2026-06-04T00:09:30.000Z', { totalTokens: 30 }),
      event('after-delta-start', '2026-06-04T00:09:30.001Z', { totalTokens: 40 }),
      event('at-now', '2026-06-04T00:10:00.000Z', { totalTokens: 50 }),
      event('future', '2026-06-04T00:10:00.001Z', { totalTokens: 1_000 })
    ];

    const tick = service.buildTick(events, {
      now,
      previousTickAt,
      intervalMs: 5_000,
      windowMs: 60_000
    });

    expect(tick.delta).toMatchObject({ events: 2, totalTokens: 90 });
    expect(tick.window).toMatchObject({ events: 4, totalTokens: 140 });
    expect(tick.velocity.tokensPerMinute).toBe(140);
  });

  it('combines OR-within filters with AND-across source and sourceName', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('codex-local', '2026-06-04T00:09:30.000Z', {
        source: 'codex',
        sourceName: 'local',
        totalTokens: 100,
        estimatedCostUsd: 0.01
      }),
      event('opencode-lab', '2026-06-04T00:09:40.000Z', {
        source: 'opencode',
        sourceName: 'lab-server',
        totalTokens: 200,
        estimatedCostUsd: 0.02
      }),
      event('claude-local', '2026-06-04T00:09:45.000Z', {
        source: 'claude',
        sourceName: 'local',
        totalTokens: 400
      }),
      event('codex-remote', '2026-06-04T00:09:50.000Z', {
        source: 'codex',
        sourceName: 'remote',
        totalTokens: 800
      })
    ];

    const tick = service.buildTick(events, {
      now,
      intervalMs: 5_000,
      windowMs: 60_000,
      source: ['codex', 'opencode'],
      sourceName: ['local', 'lab-server']
    });

    expect(tick.filters).toEqual({
      source: ['codex', 'opencode'],
      sourceName: ['local', 'lab-server']
    });
    expect(tick.window).toMatchObject({ events: 2, totalTokens: 300, estimatedCostUsd: 0.03 });
  });

  it('computes later-tick top labels and velocity from window rather than delta', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      event('backfilled-window-leader', '2026-06-04T00:09:20.000Z', {
        source: 'opencode',
        sourceName: 'lab-server',
        agent: 'opencode',
        model: 'window-model',
        workspaceLabel: 'window-project',
        metadata: { projectLabelSource: 'scan-option' },
        totalTokens: 900,
        estimatedCostUsd: 0.09
      }),
      event('delta-event', '2026-06-04T00:09:45.000Z', {
        source: 'codex',
        sourceName: 'local',
        agent: 'codex',
        model: 'delta-model',
        totalTokens: 100,
        estimatedCostUsd: 0.01
      })
    ];

    const tick = service.buildTick(events, {
      now,
      previousTickAt: new Date('2026-06-04T00:09:30.000Z'),
      intervalMs: 5_000,
      windowMs: 60_000
    });

    expect(tick.delta).toMatchObject({ events: 1, totalTokens: 100 });
    expect(tick.window).toMatchObject({ events: 2, totalTokens: 1_000 });
    expect(tick.velocity).toEqual({ tokensPerMinute: 1_000, estimatedCostUsdPerHour: 6 });
    expect(tick.top).toEqual({
      model: 'window-model',
      source: 'opencode',
      sourceName: 'lab-server',
      agent: 'opencode',
      project: 'window-project'
    });
  });

  it('preserves unknown cost independently on delta, window, and window velocity', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');
    const events = [
      unknownCostEvent('backfilled-unknown', '2026-06-04T00:09:20.000Z', { totalTokens: 200 }),
      event('known-delta', '2026-06-04T00:09:45.000Z', {
        totalTokens: 100,
        estimatedCostUsd: 0.02
      })
    ];

    const laterTick = service.buildTick(events, {
      now,
      previousTickAt: new Date('2026-06-04T00:09:30.000Z'),
      intervalMs: 5_000,
      windowMs: 60_000
    });
    const firstTick = service.buildTick(events, { now, intervalMs: 5_000, windowMs: 60_000 });

    expect(laterTick.delta).toMatchObject({ estimatedCostUsd: 0.02, unknownCostEvents: 0 });
    expect(laterTick.window).toMatchObject({
      estimatedCostUsd: null,
      unknownCostEvents: 1,
      unknownCostTokens: 200
    });
    expect(laterTick.velocity.estimatedCostUsdPerHour).toBeNull();
    expect(firstTick.delta).toMatchObject({ estimatedCostUsd: null, unknownCostEvents: 1 });
    expect(firstTick.window.estimatedCostUsd).toBeNull();
  });

  it('summarizes canonical current-month budgets while retaining monthly total rows', () => {
    const now = new Date('2026-06-04T00:10:00.000Z');

    const tick = service.buildTick([], {
      now,
      intervalMs: 5_000,
      windowMs: 60_000,
      sourceName: ['local'],
      budgets: [
        budgetEvaluation('monthly_total', null, 'ok', []),
        budgetEvaluation('sourceName', 'local', 'unknown-costs-present', [
          'budget_unknown_cost_present'
        ]),
        overBudget('lab-server')
      ]
    });

    expect(tick.budgets).toMatchObject({
      status: 'unknown',
      warningCount: 1,
      exceededCount: 0,
      unknownCount: 1,
      rows: expect.arrayContaining([
        expect.objectContaining({ scopeKind: 'monthly_total', month: '2026-06', status: 'ok' }),
        expect.objectContaining({ scopeKind: 'sourceName', sourceName: 'local', status: 'unknown' })
      ])
    });
    expect(tick.budgets.rows).toHaveLength(2);
    expect(JSON.stringify(tick)).not.toContain('lab-server');
    expect(tick.privacy).toEqual({ sanitized: true });
    assertNoForbiddenOutput(tick);
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
