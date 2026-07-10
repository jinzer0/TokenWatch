// allow: SIZE_OK - compatibility suite intentionally keeps legacy and preset statusline regressions together.
import { describe, expect, it } from 'vitest';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import {
  StatuslineService,
  renderStatuslinePresetText,
  renderStatuslineText
} from '../src/services/statusline.js';
import { statuslinePresetSchema, statuslineSchema } from '../src/services/statuslineContract.js';
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

  it('keeps the default DTO shape free of opt-in preset fields', () => {
    // Given: a default statusline request with no preset option.
    const now = new Date(2026, 4, 10, 12);
    const dto = service.build([event('default-compatible', now.toISOString())], {
      window: 'today',
      now
    });

    // When: consumers parse the legacy JSON-compatible DTO.
    const serialized = JSON.parse(JSON.stringify(dto)) as Record<string, unknown>;

    // Then: the existing strict statusline contract remains unchanged.
    expect(serialized).toMatchObject({ version: 1, kind: 'statusline', window: 'today' });
    expect(serialized).not.toHaveProperty('preset');
    expect(serialized).not.toHaveProperty('recent');
    expect(serialized).not.toHaveProperty('tokensPerMinute');
    expect(serialized).not.toHaveProperty('budgetPressure');
  });

  it('builds compact preset text with live fields and budget pressure', () => {
    // Given: compact statusline uses the existing month budget data but keeps output short.
    const now = new Date(2026, 4, 20, 12, 0, 0, 0);
    const budgets: BudgetEvaluation[] = [
      budgetEvaluation('monthly_total', null, 'over', ['budget_threshold_exceeded']),
      budgetEvaluation('sourceName', 'lab-a100', 'unknown-costs-present', [
        'budget_unknown_cost_present'
      ])
    ];
    const events = [
      event('recent-known', new Date(2026, 4, 20, 11, 55).toISOString(), {
        totalTokens: 200,
        estimatedCostUsd: 0.4,
        sourceName: 'lab-a100'
      }),
      unknownCostEvent('recent-unknown', new Date(2026, 4, 20, 11, 58).toISOString(), {
        totalTokens: 100,
        sourceName: 'lab-a100'
      }),
      event('older-known', new Date(2026, 4, 20, 11, 40).toISOString(), {
        totalTokens: 300,
        estimatedCostUsd: 0.6,
        sourceName: 'local'
      })
    ];

    // When: the compact preset DTO and text are produced.
    const dto = service.buildPreset(events, { preset: 'compact', window: 'today', now, budgets });
    const text = renderStatuslinePresetText(dto);

    // Then: the distinct preset contract includes recent metrics, budget pressure, and safe labels.
    expect(dto).toMatchObject({
      version: 1,
      kind: 'statusline-preset',
      preset: 'compact',
      window: 'today',
      recent: { minutes: 10, tokens: 300, tokensPerMinute: 30 },
      budgetPressure: {
        status: 'over',
        maxPercent: 200,
        warningCount: 2,
        unknownCostCount: 1,
        unknownCostEvents: 2,
        unknownCostTokens: 120
      },
      unknownCostEvents: 1,
      top: { sourceName: 'lab-a100' },
      privacy: { sanitized: true }
    });
    expect(statuslinePresetSchema.parse(dto)).toEqual(dto);
    expect(text).toContain('TokenWatch | compact | today');
    expect(text).toContain('600 tokens');
    expect(text).toContain('unknown 1');
    expect(text).toContain('budget 200% over');
    assertNoForbiddenOutput(text);
  });

  it('builds live preset JSON with zero rate when no recent events exist', () => {
    // Given: historical events are inside today's window but outside the recent 10-minute window.
    const now = new Date(2026, 4, 20, 12, 0, 0, 0);
    const events = [
      event('older-live', new Date(2026, 4, 20, 11, 30).toISOString(), {
        totalTokens: 600,
        estimatedCostUsd: 1.2
      })
    ];

    // When: a live preset DTO is built with injectable now.
    const dto = service.buildPreset(events, { preset: 'live', window: 'today', now });

    // Then: recent rate uses normalized timestamps only and stays zero for no recent events.
    expect(dto).toMatchObject({
      version: 1,
      kind: 'statusline-preset',
      preset: 'live',
      recent: {
        minutes: 10,
        tokens: 0,
        tokensPerMinute: 0,
        range: {
          from: new Date(2026, 4, 20, 11, 50, 0, 0).toISOString(),
          to: now.toISOString()
        }
      },
      totals: { tokens: 600 },
      privacy: { sanitized: true }
    });
    assertJsonOutputPrivacy(dto);
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

  it('throws a sanitized error for invalid presets', () => {
    // Given: preset is untrusted option input at the service boundary.
    const invalidPreset = 'wide';

    // When / Then: invalid values fail with the stable statusline preset code.
    expect(() =>
      service.buildPreset([], { preset: invalidPreset, window: 'today', now: new Date() })
    ).toThrow('invalid_statusline_preset');
  });

  it('rejects unsafe preset top labels through the strict schema', () => {
    // Given: preset JSON is a distinct schema and label fields are output-facing.
    const dto = service.buildPreset([], {
      preset: 'live',
      window: 'today',
      now: new Date(2026, 4, 20, 12)
    });

    // When / Then: unsafe labels are rejected instead of being passed through.
    expect(() =>
      statuslinePresetSchema.parse({
        ...dto,
        top: { ...dto.top, model: 'SELECT * FROM usage_events' }
      })
    ).toThrow('invalid_report_option');
  });

  it('rejects unsafe default top labels through the central output-label schema', () => {
    // Given: default statusline JSON is output-facing just like preset JSON.
    const dto = service.build([], { window: 'today', now: new Date(2026, 4, 20, 12) });

    // When / Then: SQL-like labels rejected by central report label validation cannot pass through.
    expect(() =>
      statuslineSchema.parse({
        ...dto,
        top: { ...dto.top, model: 'update usage_events set token = 1' }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      statuslineSchema.parse({
        ...dto,
        top: { ...dto.top, sourceName: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK' }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      statuslineSchema.parse({
        ...dto,
        top: { ...dto.top, project: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK' }
      })
    ).toThrow('invalid_report_option');
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

function unknownCostEvent(rawIdHash: string, timestamp: string, overrides: EventOverrides = {}) {
  return { ...event(rawIdHash, timestamp, overrides), estimatedCostUsd: null };
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
