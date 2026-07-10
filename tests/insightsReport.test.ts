import { describe, expect, it } from 'vitest';
import {
  insightsReportOptionsSchema,
  insightsReportSchema,
  safeOutputLabel,
  safeOutputLabelSchema
} from '../src/services/reportContracts.js';
import { InsightsService } from '../src/services/insightsService.js';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

const generatedAt = '2026-06-04T00:00:00.000Z';
const range = {
  from: '2026-05-28T00:00:00.000Z',
  to: '2026-06-04T00:00:00.000Z'
};

function emptyInsightsReport() {
  return {
    version: 1,
    kind: 'insights',
    generatedAt,
    window: '7d',
    range,
    totals: {
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
    cacheHitRatio: { status: 'ok', value: 0 },
    unknownPricingImpact: {
      unknownCostEvents: 0,
      unknownCostTokens: 0,
      unknownTokenShare: 0,
      knownEstimatedCostUsd: null
    },
    reasoningToOutputRatio: { status: 'insufficient-data', value: null },
    reworkRatio: { status: 'insufficient-data', value: null, proxies: [] },
    topRows: { models: [], sources: [], sourceNames: [], projects: [] },
    costDriverCandidates: [],
    budgetPressure: {
      status: 'not_configured',
      ratio: null,
      knownSpendUsd: null,
      thresholdUsd: null,
      unknownCostEvents: 0,
      unknownCostTokens: 0
    },
    warnings: [],
    confidence: { level: 'high', reasons: [] },
    privacy: { sanitized: true }
  };
}

describe('insights report contracts', () => {
  it('parses an empty safe insights report with sanitized privacy metadata', () => {
    const report = insightsReportSchema.parse(emptyInsightsReport());

    expect(report).toMatchObject({
      version: 1,
      kind: 'insights',
      window: '7d',
      reworkRatio: { status: 'insufficient-data', value: null },
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
  });

  it('parses supported 7d and 30d windows while rejecting unsupported windows', () => {
    expect(insightsReportOptionsSchema.parse({ window: '7d' })).toEqual({ window: '7d' });
    expect(insightsReportOptionsSchema.parse({ window: '30d' })).toEqual({ window: '30d' });
    expect(() => insightsReportOptionsSchema.parse({ window: '14d' })).toThrow(
      'invalid_report_option'
    );
  });

  it('parses top aggregate rows with strict unknown-cost semantics', () => {
    const report = insightsReportSchema.parse({
      ...emptyInsightsReport(),
      topRows: {
        models: [
          topRow('gpt-5.5-fast', {
            estimatedCostUsd: null,
            unknownCostEvents: 1,
            unknownCostTokens: 50
          })
        ],
        sources: [topRow('codex')],
        sourceNames: [topRow('lab-a100')],
        projects: [topRow('client-a')]
      }
    });

    expect(report.topRows.models[0]).toMatchObject({
      label: 'gpt-5.5-fast',
      estimatedCostUsd: null,
      knownEstimatedCostUsd: 0.25,
      unknownCostEvents: 1,
      unknownCostTokens: 50
    });
  });

  it('rejects unsafe output labels and forbidden DTO fields', () => {
    for (const label of [
      'RAW_PATH_SENTINEL_DO_NOT_LEAK',
      'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK',
      'STACK_TRACE_SENTINEL_DO_NOT_LEAK',
      'tokenwatch-secret-key',
      '/Users/example/private/project',
      'select token from usage_events',
      'Error: boom\n    at run (/app/src/index.ts:1:2)'
    ]) {
      expect(() => safeOutputLabelSchema.parse(label)).toThrow('invalid_report_option');
      expect(() => safeOutputLabel(label)).toThrow('invalid_report_option');
    }

    for (const field of [
      'metadata',
      'rawIdHash',
      'rawSessionId',
      'rawPath',
      'prompt',
      'response',
      'credential',
      'extra'
    ]) {
      expect(() =>
        insightsReportSchema.parse({ ...emptyInsightsReport(), [field]: 'unsafe' })
      ).toThrow();
    }

    expect(() =>
      insightsReportSchema.parse({
        ...emptyInsightsReport(),
        topRows: {
          models: [topRow('select token from usage_events')],
          sources: [],
          sourceNames: [],
          projects: []
        }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      insightsReportSchema.parse({
        ...emptyInsightsReport(),
        topRows: {
          models: [{ ...topRow('gpt-5.5-fast'), rawPath: 'unsafe' }],
          sources: [],
          sourceNames: [],
          projects: []
        }
      })
    ).toThrow();
  });
});

describe('InsightsService', () => {
  it('builds deterministic metadata-only insights when events include mixed pricing and sessions', () => {
    const service = new InsightsService(() => new Date(generatedAt));
    const budgetEvaluations: BudgetEvaluation[] = [
      {
        scopeKind: 'monthly_total',
        sourceName: null,
        month: '2026-06',
        knownSpendUsd: 2,
        thresholdUsd: 4,
        status: 'unknown-costs-present',
        unknownCostEventCount: 1,
        unknownCostTokenCount: 100,
        warningRows: [
          { code: 'budget_unknown_cost_present', scopeKind: 'monthly_total', sourceName: null }
        ]
      }
    ];
    // Given: known, unknown, multi-model, multi-session, and explicit project usage metadata.
    const events = [
      createTestEvent({
        timestamp: '2026-06-01T00:00:00.000Z',
        source: 'codex',
        sourceName: 'lab-server',
        model: 'gpt-5.5-fast',
        inputTokens: 400,
        outputTokens: 500,
        cachedTokens: 100,
        reasoningTokens: 50,
        totalTokens: 900,
        estimatedCostUsd: 1,
        sessionIdHash: 'session-a',
        workspaceLabel: 'client-a',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' }
      }),
      createTestEvent({
        timestamp: '2026-06-01T00:01:00.000Z',
        source: 'opencode',
        sourceName: 'lab-server',
        model: 'gpt-5.5',
        inputTokens: 40,
        outputTokens: 60,
        cachedTokens: 60,
        reasoningTokens: 10,
        totalTokens: 100,
        estimatedCostUsd: 1,
        sessionIdHash: 'session-a',
        workspaceLabel: 'client-a',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' }
      }),
      createTestEvent({
        timestamp: '2026-06-01T00:05:00.000Z',
        source: 'codex',
        sourceName: 'local',
        model: 'unpriced-model',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 40,
        reasoningTokens: 0,
        totalTokens: 100,
        estimatedCostUsd: null,
        sessionIdHash: 'session-b',
        workspaceLabel: 'raw-workspace-name',
        workspaceHash: 'workspace-hash-only',
        metadata: { parser: 'test', projectLabelSource: 'parser' }
      })
    ];
    // When: the insights report is built and parsed by the strict report schema.
    const report = insightsReportSchema.parse(
      service.build(events, { window: '7d' }, budgetEvaluations)
    );
    // Then: totals and ratios use strict unknown-cost semantics without privacy leaks.
    expect(report.range).toEqual(range);
    expect(report.totals).toMatchObject({
      estimatedCostUsd: null,
      knownEstimatedCostUsd: 2,
      unknownCostEvents: 1,
      unknownCostTokens: 100
    });
    expect(report.cacheHitRatio).toEqual({ status: 'ok', value: 200 / 740 });
    expect(report.unknownPricingImpact).toEqual({
      unknownCostEvents: 1,
      unknownCostTokens: 100,
      unknownTokenShare: 100 / 1100,
      knownEstimatedCostUsd: 2
    });
    expect(report.reasoningToOutputRatio).toEqual({ status: 'ok', value: 60 / 560 });
    expect(report.reworkRatio).toMatchObject({ status: 'insufficient-data', value: null });
    expect(report.reworkRatio.proxies).toEqual(
      expect.arrayContaining([{ label: 'repeated_session_bursts', value: 1 }])
    );
    expect(report.costDriverCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'gpt-5.5',
          expensiveRelativeToMedian: true,
          spendDriverCandidate: true
        }),
        expect.objectContaining({ label: 'unpriced-model', pricingStatus: 'unknown' })
      ])
    );
    expect(report.topRows.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'gpt-5.5-fast', estimatedCostUsd: 1 }),
        expect.objectContaining({ label: 'unpriced-model', estimatedCostUsd: null })
      ])
    );
    expect(report.topRows.sources).toEqual([
      expect.objectContaining({ label: 'codex', estimatedCostUsd: null, unknownCostEvents: 1 }),
      expect.objectContaining({ label: 'opencode', estimatedCostUsd: 1, unknownCostEvents: 0 })
    ]);
    expect(report.topRows.sourceNames).toEqual([
      expect.objectContaining({
        label: 'lab-server',
        estimatedCostUsd: 2,
        knownEstimatedCostUsd: 2
      }),
      expect.objectContaining({
        label: 'local',
        estimatedCostUsd: null,
        knownEstimatedCostUsd: null
      })
    ]);
    expect(report.topRows.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'client-a', estimatedCostUsd: 2, unknownCostEvents: 0 }),
        expect.objectContaining({ label: 'unknown', estimatedCostUsd: null, unknownCostEvents: 1 })
      ])
    );
    expect(report.budgetPressure).toMatchObject({ status: 'unknown-costs-present', ratio: 0.5 });
    expect(report.warnings).toEqual([
      'unknown_pricing_present',
      'rework_signal_unavailable',
      'partial_reasoning_signal'
    ]);
    expect(report.confidence.level).toBe('medium');
    expect(containsPrivacySentinel(report)).toBe(false);
    expect(JSON.stringify(report)).not.toContain('raw-workspace-name');
    expect(JSON.stringify(report.topRows.projects)).not.toContain('raw-workspace-name');
  });

  it('reports deterministic no-data, no-output, and all-unknown-cost states', () => {
    const service = new InsightsService(() => new Date(generatedAt));
    // Given: no events, zero output tokens, and all-unknown pricing scenarios.
    const noOutputEvent = createTestEvent({
      outputTokens: 0,
      reasoningTokens: 25,
      totalTokens: 100,
      estimatedCostUsd: 1
    });
    const unknownCostEvents = [100, 150].map((inputTokens, index) =>
      createTestEvent({
        model: `unpriced-${index}`,
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        estimatedCostUsd: null
      })
    );
    // When: reports are built through the service surface.
    const emptyReport = insightsReportSchema.parse(service.build([], { window: '7d' }));
    const noOutputReport = insightsReportSchema.parse(
      service.build([noOutputEvent], { window: '7d' })
    );
    const unknownCostReport = insightsReportSchema.parse(
      service.build(unknownCostEvents, { window: '7d' })
    );
    // Then: null and insufficient-data states are explicit and unknown costs are never treated as zero.
    expect(emptyReport).toMatchObject(emptyInsightsReport());
    expect(noOutputReport.reasoningToOutputRatio).toEqual({
      status: 'insufficient-data',
      value: null
    });
    expect(unknownCostReport.totals).toMatchObject({
      estimatedCostUsd: null,
      knownEstimatedCostUsd: null,
      unknownCostEvents: 2,
      unknownCostTokens: 250
    });
    expect(unknownCostReport.costDriverCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ pricingStatus: 'unknown' })])
    );
    expect(unknownCostReport.topRows.models).toEqual(
      expect.arrayContaining([expect.objectContaining({ estimatedCostUsd: null })])
    );
  });

  it('filters events to the requested rolling window before computing insights metrics', () => {
    const service = new InsightsService(() => new Date(generatedAt));
    // Given: one event in the current 7-day window and one older event that belongs only to 30-day reports.
    const events = [
      createTestEvent({
        timestamp: '2026-06-01T00:00:00.000Z',
        model: 'current-model',
        totalTokens: 100,
        inputTokens: 80,
        outputTokens: 20,
        estimatedCostUsd: 0.2
      }),
      createTestEvent({
        timestamp: '2026-05-20T00:00:00.000Z',
        model: 'older-model',
        totalTokens: 900,
        inputTokens: 700,
        outputTokens: 200,
        estimatedCostUsd: null
      })
    ];

    // When: the shorter rolling window report is built.
    const report = insightsReportSchema.parse(service.build(events, { window: '7d' }));

    // Then: metrics, rows, warnings, and unknown pricing impact only reflect the included event.
    expect(report.range).toEqual(range);
    expect(report.totals).toMatchObject({ events: 1, tokens: 100, estimatedCostUsd: 0.2 });
    expect(report.unknownPricingImpact).toEqual({
      unknownCostEvents: 0,
      unknownCostTokens: 0,
      unknownTokenShare: 0,
      knownEstimatedCostUsd: 0.2
    });
    expect(report.topRows.models.map((row) => row.label)).toEqual(['current-model']);
    expect(report.warnings).not.toContain('unknown_pricing_present');
  });

  it('rejects unsafe output labels through final schema validation', () => {
    const service = new InsightsService(() => new Date(generatedAt));
    // Given: an adversarial normalized-shaped event with an unsafe output label.
    const unsafeEvent = {
      ...createTestEvent(),
      model: 'select token from usage_events'
    };
    // When/Then: service output validation rejects it with the stable sanitized code.
    expect(() => service.build([unsafeEvent], { window: '7d' })).toThrow('invalid_report_option');
  });
});

function topRow(label: string, overrides = {}) {
  return {
    label,
    events: 1,
    tokens: 100,
    inputTokens: 40,
    outputTokens: 50,
    cachedTokens: 10,
    reasoningTokens: 5,
    estimatedCostUsd: 0.25,
    knownEstimatedCostUsd: 0.25,
    unknownCostEvents: 0,
    unknownCostTokens: 0,
    ...overrides
  };
}
