import { describe, expect, it } from 'vitest';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

async function loadReportService(): Promise<Record<string, unknown>> {
  return import('../src/services/reportService.js') as Promise<Record<string, unknown>>;
}

function createService(moduleExports: Record<string, unknown>): {
  buildGraphReport: (events: unknown[], options: Record<string, unknown>) => unknown;
} {
  expect(moduleExports.ReportService).toBeTypeOf('function');
  const service = new (moduleExports.ReportService as new () => unknown)();
  expect(service).toMatchObject({ buildGraphReport: expect.any(Function) });
  return service as {
    buildGraphReport: (events: unknown[], options: Record<string, unknown>) => unknown;
  };
}

describe('graph report service contract', () => {
  it('returns a deterministic empty report without leaking sentinels', async () => {
    const service = createService(await loadReportService());
    const report = service.buildGraphReport([], { bucket: 'day', metric: 'tokens' });

    expect(report).toMatchObject({
      kind: 'graph',
      bucket: 'day',
      metric: 'tokens',
      totals: { events: 0, tokens: 0, estimatedCostUsd: null },
      series: [],
      unknownCostEvents: 0,
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
  });

  it('aggregates day, hour, and month buckets in stable ascending order', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({ timestamp: '2026-05-02T03:00:00.000Z', rawIdHash: 'late' }),
      createTestEvent({ timestamp: '2026-05-01T23:00:00.000Z', rawIdHash: 'early' }),
      createTestEvent({ timestamp: '2026-06-01T00:00:00.000Z', rawIdHash: 'june' })
    ];

    expect(service.buildGraphReport(events, { bucket: 'day', metric: 'tokens' })).toMatchObject({
      series: [{ key: '2026-05-01' }, { key: '2026-05-02' }, { key: '2026-06-01' }]
    });
    expect(service.buildGraphReport(events, { bucket: 'hour', metric: 'events' })).toMatchObject({
      series: [{ key: '2026-05-01T23' }, { key: '2026-05-02T03' }, { key: '2026-06-01T00' }]
    });
    expect(service.buildGraphReport(events, { bucket: 'month', metric: 'cost' })).toMatchObject({
      series: [{ key: '2026-05' }, { key: '2026-06' }]
    });
  });

  it('supports tokens, cost, and events metrics with unknown-cost semantics', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({
        timestamp: '2026-05-01T00:00:00.000Z',
        rawIdHash: 'known-cost',
        inputTokens: 60,
        outputTokens: 40,
        totalTokens: 100,
        estimatedCostUsd: 0.05
      }),
      {
        ...createTestEvent({
          timestamp: '2026-05-01T01:00:00.000Z',
          rawIdHash: 'unknown-cost',
          inputTokens: 120,
          outputTokens: 80,
          totalTokens: 200
        }),
        estimatedCostUsd: null
      }
    ];

    expect(service.buildGraphReport(events, { bucket: 'day', metric: 'tokens' })).toMatchObject({
      totals: { events: 2, tokens: 300, estimatedCostUsd: null },
      series: [{ key: '2026-05-01', events: 2, tokens: 300, estimatedCostUsd: null }],
      unknownCostEvents: 1
    });
    expect(service.buildGraphReport(events, { bucket: 'day', metric: 'cost' })).toMatchObject({
      metric: 'cost',
      totals: { estimatedCostUsd: null },
      unknownCostEvents: 1
    });
    expect(service.buildGraphReport(events, { bucket: 'day', metric: 'events' })).toMatchObject({
      metric: 'events',
      totals: { events: 2 }
    });
  });

  it('applies inclusive from and to filters', async () => {
    const service = createService(await loadReportService());
    const events = [
      createTestEvent({ timestamp: '2026-04-30T23:59:59.999Z', rawIdHash: 'before' }),
      createTestEvent({ timestamp: '2026-05-01T00:00:00.000Z', rawIdHash: 'from' }),
      createTestEvent({ timestamp: '2026-05-31T23:59:59.999Z', rawIdHash: 'to' }),
      createTestEvent({ timestamp: '2026-06-01T00:00:00.000Z', rawIdHash: 'after' })
    ];

    expect(
      service.buildGraphReport(events, {
        bucket: 'month',
        metric: 'events',
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-31T23:59:59.999Z'
      })
    ).toMatchObject({
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      totals: { events: 2 },
      series: [{ key: '2026-05', events: 2 }]
    });
  });

  it('rejects invalid report options with a stable error code', async () => {
    const service = createService(await loadReportService());

    expect(() => service.buildGraphReport([], { bucket: 'week', metric: 'tokens' })).toThrow(
      'invalid_report_option'
    );
  });

  it('does not serialize prompts, responses, credentials, raw paths, or raw metadata', async () => {
    const service = createService(await loadReportService());
    const report = service.buildGraphReport(
      [
        {
          ...createTestEvent({
            sourceName: 'local',
            model: 'gpt-5.5-fast'
          }),
          rawSource: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        }
      ],
      { bucket: 'day', metric: 'tokens' }
    );

    expect(containsPrivacySentinel(report)).toBe(false);
    expect(JSON.stringify(report)).not.toContain('metadata');
  });
});
