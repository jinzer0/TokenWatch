import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { StatuslineService, renderStatuslineText } from '../src/services/statusline.js';
import { assertJsonOutputPrivacy, assertNoForbiddenOutput } from './privacyOutput.js';
import { createTestEvent } from './helpers.js';

const service = new StatuslineService();

describe('statusline service', () => {
  it('builds a today DTO using local day boundaries around UTC midnight', () => {
    // Given: statusline uses local day windows; desktop date filters keep their existing UTC behavior.
    const now = new Date(2026, 4, 10, 12);
    const start = new Date(2026, 4, 10, 0, 0).toISOString();
    const end = new Date(2026, 4, 10, 23, 59, 59, 999).toISOString();
    const outsideBefore = new Date(2026, 4, 9, 23, 59, 59, 999).toISOString();
    const outsideAfter = new Date(2026, 4, 11, 0, 0).toISOString();
    const events = [
      event('today-start', start, { totalTokens: 100, estimatedCostUsd: 0.2 }),
      event('today-end', end, { totalTokens: 80, estimatedCostUsd: 0.1 }),
      event('outside-before', outsideBefore, { totalTokens: 1, estimatedCostUsd: 9 }),
      event('outside-after', outsideAfter, { totalTokens: 1, estimatedCostUsd: 9 })
    ];

    // When: a today statusline DTO is built.
    const dto = service.build(events, { window: 'today', now });

    // Then: only local-day events are included and the range exposes local labels plus ISO bounds.
    expect(dto.window).toBe('today');
    expect(dto.range).toEqual({
      label: '2026-05-10',
      from: startOfLocalDay(now).toISOString(),
      to: endOfLocalDay(now).toISOString()
    });
    expect(dto.totals).toMatchObject({ events: 2, tokens: 180, estimatedCostUsd: 0.3 });
    expect(dto.unknownCostEvents).toBe(0);
    expect(dto.top).toMatchObject({
      model: 'gpt-5.5-fast',
      sourceName: 'local',
      project: 'unknown'
    });
    assertJsonOutputPrivacy(dto);
  });

  it('builds a month DTO with local month boundaries and mixed known unknown pricing', () => {
    // Given: month boundaries are also local and missing prices remain nullable unknowns.
    const now = new Date(2026, 4, 20, 12);
    const events = [
      event('known-lab', new Date(2026, 4, 1, 0, 0).toISOString(), {
        sourceName: 'lab-a100',
        totalTokens: 200,
        estimatedCostUsd: 1.25,
        workspaceLabel: 'client-alpha',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' }
      }),
      event('unknown-lab', new Date(2026, 4, 31, 23, 59, 59, 999).toISOString(), {
        sourceName: 'lab-a100',
        model: 'unknown-fixture-model',
        totalTokens: 300,
        estimatedCostUsd: null,
        workspaceLabel: 'client-alpha',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' }
      }),
      event('previous-month', new Date(2026, 3, 30, 23, 59).toISOString(), {
        totalTokens: 900,
        estimatedCostUsd: 9
      })
    ];

    // When: a month statusline DTO is built.
    const dto = service.build(events, { window: 'month', now });

    // Then: known spend is not converted to all-known cost, and unknown tokens are counted separately.
    expect(dto.range).toEqual({
      label: '2026-05',
      from: new Date(2026, 4, 1, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString()
    });
    expect(dto.totals).toMatchObject({ events: 2, tokens: 500, estimatedCostUsd: null });
    expect(dto.knownEstimatedCostUsd).toBe(1.25);
    expect(dto.unknownCostEvents).toBe(1);
    expect(dto.unknownCostTokens).toBe(300);
    expect(dto.top).toMatchObject({ sourceName: 'lab-a100', project: 'client-alpha' });
    expect(renderStatuslineText(dto)).toContain('cost unknown');
  });

  it('returns stable empty DTO fields when there are no events', () => {
    // Given: an empty local window.
    const now = new Date(2026, 0, 5, 8);

    // When: the statusline DTO is built.
    const dto = service.build([], { window: 'today', now });

    // Then: totals are zero, cost remains null, labels are unknown, and privacy is explicit.
    expect(dto).toMatchObject({
      version: 1,
      kind: 'statusline',
      window: 'today',
      totals: { events: 0, tokens: 0, estimatedCostUsd: null },
      knownEstimatedCostUsd: null,
      unknownCostEvents: 0,
      unknownCostTokens: 0,
      top: { model: 'unknown', sourceName: 'unknown', project: 'unknown' },
      privacy: { sanitized: true }
    });
    expect(renderStatuslineText(dto)).toContain('0 events');
  });

  it('includes over-budget and unknown-cost budget status rows and counts', () => {
    // Given: budget evaluations already computed by BudgetService for the same local month.
    const now = new Date(2026, 4, 20, 12);
    const budgets: BudgetEvaluation[] = [
      budgetEvaluation('monthly_total', null, 'over', ['budget_threshold_exceeded']),
      budgetEvaluation('sourceName', 'lab-a100', 'unknown-costs-present', [
        'budget_unknown_cost_present'
      ]),
      budgetEvaluation('sourceName', 'local', 'ok', [])
    ];

    // When: a statusline DTO is built with budget context.
    const dto = service.build([event('known', now.toISOString(), { estimatedCostUsd: 2 })], {
      window: 'month',
      now,
      budgets
    });

    // Then: warning rows are compact, counted, and safe for status-bar use.
    expect(dto.budgets).toEqual({
      warningCount: 2,
      overCount: 1,
      unknownCostCount: 1,
      rows: [
        {
          scopeKind: 'monthly_total',
          sourceName: null,
          month: '2026-05',
          status: 'over',
          knownSpendUsd: 2,
          thresholdUsd: 1,
          unknownCostEvents: 0,
          unknownCostTokens: 0,
          warnings: ['budget_threshold_exceeded']
        },
        {
          scopeKind: 'sourceName',
          sourceName: 'lab-a100',
          month: '2026-05',
          status: 'unknown-costs-present',
          knownSpendUsd: 0.25,
          thresholdUsd: 1,
          unknownCostEvents: 2,
          unknownCostTokens: 120,
          warnings: ['budget_unknown_cost_present']
        }
      ]
    });
    expect(renderStatuslineText(dto)).toContain('budgets 2 warn');
  });

  it('includes current-month budget status rows for today windows', () => {
    // Given: budget evaluations are monthly even when the statusline event window is one local day.
    const now = new Date(2026, 4, 20, 12);
    const budgets: BudgetEvaluation[] = [
      budgetEvaluation('monthly_total', null, 'over', ['budget_threshold_exceeded']),
      budgetEvaluation('sourceName', 'lab-a100', 'unknown-costs-present', [
        'budget_unknown_cost_present'
      ])
    ];

    // When: a today statusline DTO is built with current-month budget context.
    const dto = service.build([event('known-today', now.toISOString(), { estimatedCostUsd: 2 })], {
      window: 'today',
      now,
      budgets
    });

    // Then: the monthly budget warning rows are still surfaced for the current local month.
    expect(dto.range.label).toBe('2026-05-20');
    expect(dto.budgets.warningCount).toBe(2);
    expect(dto.budgets.overCount).toBe(1);
    expect(dto.budgets.unknownCostCount).toBe(1);
    expect(dto.budgets.rows.map((row) => row.month)).toEqual(['2026-05', '2026-05']);
  });

  it('throws a sanitized error for invalid windows', () => {
    // Given: untrusted statusline option input reaches the service boundary.
    const invalidWindow = 'week';

    // When / Then: invalid values fail without exposing raw records or stack-like output.
    expect(() => service.build([], { window: invalidWindow, now: new Date() })).toThrow(
      'invalid_statusline_window'
    );
  });

  it('rejects forbidden fixture values from DTO and rendered text outputs', () => {
    // Given: all forbidden fixture samples live only in fields the service must never render.
    const events = [
      event('safe', new Date(2026, 4, 10, 12).toISOString(), {
        metadata: { parser: 'test', schemaVariant: 'unit' },
        workspaceHash: 'workspace-hash-private',
        sessionIdHash: 'session-hash-private',
        rawIdHash: 'raw-id-private'
      })
    ];

    // When: the DTO and text are produced from normalized usage metadata.
    const dto = service.build(events, { window: 'today', now: new Date(2026, 4, 10, 12) });
    const text = renderStatuslineText(dto);

    // Then: privacy helper accepts both output surfaces and no private hash field appears.
    assertNoForbiddenOutput(dto);
    assertNoForbiddenOutput(text);
    expect(JSON.stringify(dto)).not.toContain('workspace-hash-private');
    expect(text).not.toContain('session-hash-private');
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
    totalTokens,
    estimatedCostUsd: 0.01,
    ...overrides
  });
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
    month: '2026-05',
    knownSpendUsd: status === 'over' ? 2 : 0.25,
    thresholdUsd: 1,
    status,
    unknownCostEventCount: status === 'unknown-costs-present' ? 2 : 0,
    unknownCostTokenCount: status === 'unknown-costs-present' ? 120 : 0,
    warningRows: warnings.map((code) => ({ code, scopeKind, sourceName }))
  };
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}
