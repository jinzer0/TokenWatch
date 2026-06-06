import { describe, expect, it } from 'vitest';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

async function loadReportService(): Promise<Record<string, unknown>> {
  return import('../src/services/reportService.js') as Promise<Record<string, unknown>>;
}

function createService(moduleExports: Record<string, unknown>): {
  buildWrappedReport: (events: unknown[], options: Record<string, unknown>) => unknown;
} {
  expect(moduleExports.ReportService).toBeTypeOf('function');
  const service = new (moduleExports.ReportService as new () => unknown)();
  expect(service).toMatchObject({ buildWrappedReport: expect.any(Function) });
  return service as {
    buildWrappedReport: (events: unknown[], options: Record<string, unknown>) => unknown;
  };
}

describe('wrapped report service contract', () => {
  it('requires a valid explicit year', async () => {
    const service = createService(await loadReportService());

    expect(() => service.buildWrappedReport([], {})).toThrow('invalid_wrapped_year');
    expect(() => service.buildWrappedReport([], { year: 1999 })).toThrow('invalid_wrapped_year');
    expect(() => service.buildWrappedReport([], { year: 2101 })).toThrow('invalid_wrapped_year');
    expect(() => service.buildWrappedReport([], { year: 'abcd' })).toThrow('invalid_wrapped_year');
    expect(() => service.buildWrappedReport([], { year: 2026 })).not.toThrow();
  });

  it('returns deterministic empty matching-year output', async () => {
    const service = createService(await loadReportService());
    const report = service.buildWrappedReport(
      [createTestEvent({ timestamp: '2025-12-31T23:59:59.999Z', rawIdHash: 'outside-year' })],
      { year: 2026 }
    );

    expect(report).toMatchObject({
      kind: 'wrapped',
      year: 2026,
      totals: { events: 0, tokens: 0, estimatedCostUsd: null },
      highlights: {
        busiestMonth: null,
        busiestDay: null,
        topModel: null,
        topAgent: null,
        topSourceName: null,
        longestSessionMs: 0,
        maxConcurrentSessions: 0
      },
      topModels: [],
      topAgents: [],
      topSources: [],
      topSourceNames: [],
      monthly: [],
      sessionMetrics: {
        sessionCount: 0,
        eventsWithoutSession: 0,
        totalActiveDurationMs: 0,
        averageActiveDurationMs: 0,
        longestSession: null
      },
      unknownCostEvents: 0,
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
  });

  it('builds deterministic highlights and top-level rankings', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({
        timestamp: '2026-01-01T00:00:00.000Z',
        rawIdHash: 'alpha-1',
        model: 'model-b',
        agent: 'codex',
        sourceName: 'server-b',
        inputTokens: 300,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 300,
        estimatedCostUsd: 0.3
      }),
      createTestEvent({
        timestamp: '2026-01-02T00:00:00.000Z',
        rawIdHash: 'alpha-2',
        model: 'model-a',
        agent: 'opencode',
        sourceName: 'server-a',
        inputTokens: 500,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 500,
        estimatedCostUsd: 0.5
      }),
      createTestEvent({
        timestamp: '2026-01-02T01:00:00.000Z',
        rawIdHash: 'alpha-3',
        model: 'model-a',
        agent: 'opencode',
        sourceName: 'server-a',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 100,
        estimatedCostUsd: 0.1
      })
    ];

    expect(service.buildWrappedReport(events, { year: 2026 })).toMatchObject({
      highlights: {
        busiestDay: { key: '2026-01-02', events: 2, tokens: 600 },
        topModel: { key: 'model-a', events: 2, tokens: 600 },
        topAgent: { key: 'opencode', events: 2, tokens: 600 },
        topSourceName: { key: 'server-a', events: 2, tokens: 600 }
      },
      topModels: [
        { key: 'model-a', events: 2, tokens: 600, estimatedCostUsd: 0.6 },
        { key: 'model-b', events: 1, tokens: 300, estimatedCostUsd: 0.3 }
      ],
      topAgents: [
        { key: 'opencode', events: 2, tokens: 600, estimatedCostUsd: 0.6 },
        { key: 'codex', events: 1, tokens: 300, estimatedCostUsd: 0.3 }
      ],
      topSources: [{ key: 'codex', events: 3, tokens: 900, estimatedCostUsd: 0.9 }],
      topSourceNames: [
        { key: 'server-a', events: 2, tokens: 600, estimatedCostUsd: 0.6 },
        { key: 'server-b', events: 1, tokens: 300, estimatedCostUsd: 0.3 }
      ],
      monthly: [{ key: '2026-01', events: 3, tokens: 900, estimatedCostUsd: 0.9 }]
    });
  });

  it('uses lexical tie-breakers after descending tokens and events', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({
        rawIdHash: 'tie-z',
        model: 'zeta',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 100
      }),
      createTestEvent({
        rawIdHash: 'tie-a',
        model: 'alpha',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 100
      })
    ];

    expect(service.buildWrappedReport(events, { year: 2026 })).toMatchObject({
      topModels: [{ key: 'alpha' }, { key: 'zeta' }]
    });
  });

  it('includes session metrics and reuses session aggregation expectations', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        rawIdHash: 'session-a-1',
        sessionIdHash: 'session-a',
        inputTokens: 100,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 100
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:02:00.000Z',
        rawIdHash: 'session-a-2',
        sessionIdHash: 'session-a',
        inputTokens: 200,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 200
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:03:00.000Z',
        rawIdHash: 'missing-session',
        sessionIdHash: null,
        inputTokens: 300,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 300
      })
    ];

    expect(service.buildWrappedReport(events, { year: 2026 })).toMatchObject({
      sessionMetrics: {
        sessionCount: 1,
        eventsWithoutSession: 1,
        totalActiveDurationMs: 120000,
        longestSession: { key: 'session-a', events: 2, tokens: 300, activeDurationMs: 120000 }
      }
    });
  });

  it('does not leak private sentinels in serialized wrapped output', async () => {
    const service = createService(await loadReportService());
    const event = createTestEvent();
    const report = service.buildWrappedReport(
      [
        {
          ...event,
          rawSource: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            token: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK'
          }
        }
      ],
      { year: 2026 }
    );

    expect(containsPrivacySentinel(report)).toBe(false);
  });
});
