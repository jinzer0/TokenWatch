import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { containsPrivacySentinel } from './helpers.js';

const expectedErrorCodes = [
  'invalid_report_option',
  'invalid_output_path',
  'invalid_wrapped_year',
  'invalid_provider',
  'headless_payload_rejected'
] as const;

async function loadReportContracts(): Promise<Record<string, unknown>> {
  return import('../src/services/reportContracts.js') as Promise<Record<string, unknown>>;
}

async function loadPngRenderer(): Promise<Record<string, unknown>> {
  return import('../src/services/pngRenderer.js') as Promise<Record<string, unknown>>;
}

function callable(value: unknown): (...args: unknown[]) => unknown {
  expect(value).toBeTypeOf('function');
  return value as (...args: unknown[]) => unknown;
}

function parser(schema: unknown): (value: unknown) => unknown {
  expect(schema).toMatchObject({ parse: expect.any(Function) });
  return (schema as { parse: (value: unknown) => unknown }).parse;
}

function decodePngRgba(png: Buffer): { width: number; height: number; data: Buffer } {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const source = y * (width * 4 + 1) + 1;
    inflated.copy(data, y * width * 4, source, source + width * 4);
  }
  return { width, height, data };
}

function countAccentPixels(png: Buffer, minX: number, maxX: number): number {
  const decoded = decodePngRgba(png);
  let count = 0;
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const offset = (y * decoded.width + x) * 4;
      if (
        decoded.data[offset] === 22 &&
        decoded.data[offset + 1] === 101 &&
        decoded.data[offset + 2] === 216 &&
        decoded.data[offset + 3] === 255
      ) {
        count += 1;
      }
    }
  }
  return count;
}

describe('report contract schemas', () => {
  it('exports the report error code contract', async () => {
    const contracts = await loadReportContracts();

    expect(contracts.reportErrorCodes).toEqual(expectedErrorCodes);
  });

  it('validates graph report JSON fields and rejects private metadata', async () => {
    const contracts = await loadReportContracts();
    const parse = parser(contracts.graphReportSchema);
    const report = parse({
      version: 1,
      kind: 'graph',
      generatedAt: '2026-06-04T00:00:00.000Z',
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      bucket: 'day',
      metric: 'tokens',
      totals: { events: 2, tokens: 300, estimatedCostUsd: 0.12 },
      series: [
        { key: '2026-05-01', events: 1, tokens: 100, estimatedCostUsd: 0.04 },
        { key: '2026-05-02', events: 1, tokens: 200, estimatedCostUsd: null }
      ],
      unknownCostEvents: 1,
      privacy: { sanitized: true }
    });

    expect(report).toMatchObject({
      kind: 'graph',
      bucket: 'day',
      metric: 'tokens',
      totals: { events: 2, tokens: 300, estimatedCostUsd: 0.12 },
      series: expect.any(Array),
      unknownCostEvents: 1,
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
    expect(() =>
      parse({
        version: 1,
        kind: 'graph',
        generatedAt: '2026-06-04T00:00:00.000Z',
        range: { from: null, to: null },
        bucket: 'day',
        metric: 'tokens',
        totals: { events: 1, tokens: 1, estimatedCostUsd: null },
        series: [
          {
            key: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
            events: 1,
            tokens: 1,
            estimatedCostUsd: null
          }
        ],
        unknownCostEvents: 0,
        privacy: { sanitized: true }
      })
    ).toThrow();
  });

  it('validates wrapped report JSON fields and ranking structures', async () => {
    const contracts = await loadReportContracts();
    const parse = parser(contracts.wrappedReportSchema);
    const payload = {
      version: 1,
      kind: 'wrapped',
      year: 2026,
      generatedAt: '2026-06-04T00:00:00.000Z',
      totals: { events: 3, tokens: 900, estimatedCostUsd: 0.45 },
      highlights: {
        busiestMonth: { key: '2026-05', events: 3, tokens: 900 },
        busiestDay: { key: '2026-05-02', events: 2, tokens: 600 },
        topModel: { key: 'gpt-5.5-fast', events: 2, tokens: 500 },
        topAgent: { key: 'codex', events: 3, tokens: 900 },
        topSourceName: { key: 'local', events: 3, tokens: 900 },
        longestSessionMs: 120000,
        maxConcurrentSessions: 2
      },
      topModels: [{ key: 'gpt-5.5-fast', events: 2, tokens: 500, estimatedCostUsd: 0.25 }],
      topAgents: [{ key: 'codex', events: 3, tokens: 900, estimatedCostUsd: 0.45 }],
      topSources: [{ key: 'codex', events: 3, tokens: 900, estimatedCostUsd: 0.45 }],
      topSourceNames: [{ key: 'local', events: 3, tokens: 900, estimatedCostUsd: 0.45 }],
      monthly: [{ key: '2026-05', events: 3, tokens: 900, estimatedCostUsd: 0.45 }],
      sessionMetrics: {
        sessionCount: 2,
        eventsWithoutSession: 0,
        totalActiveDurationMs: 180000,
        averageActiveDurationMs: 90000,
        longestSession: { key: 'session-a', events: 2, tokens: 700, activeDurationMs: 120000 }
      },
      unknownCostEvents: 0,
      privacy: { sanitized: true }
    };
    const report = parse(payload);

    expect(report).toMatchObject({
      kind: 'wrapped',
      year: 2026,
      topModels: [{ key: 'gpt-5.5-fast' }],
      topAgents: [{ key: 'codex' }],
      topSources: [{ key: 'codex' }],
      topSourceNames: [{ key: 'local' }],
      monthly: [{ key: '2026-05' }],
      sessionMetrics: { sessionCount: 2 },
      unknownCostEvents: 0,
      privacy: { sanitized: true }
    });
    expect(containsPrivacySentinel(report)).toBe(false);
    expect(() => parse({ ...payload, year: 1999 })).toThrow('invalid_wrapped_year');
    expect(() => parse({ ...payload, year: 2101 })).toThrow('invalid_wrapped_year');
  });

  it('validates report options and preserves exact validation error codes', async () => {
    const contracts = await loadReportContracts();
    const graphOptions = parser(contracts.graphReportOptionsSchema);
    const wrappedOptions = parser(contracts.wrappedReportOptionsSchema);
    const outputOptions = parser(contracts.reportOutputOptionsSchema);

    expect(graphOptions({ bucket: 'month', metric: 'events' })).toEqual({
      bucket: 'month',
      metric: 'events'
    });
    expect(() => graphOptions({ bucket: 'minute', metric: 'tokens' })).toThrow(
      'invalid_report_option'
    );
    expect(() => wrappedOptions({ year: 'not-a-year' })).toThrow('invalid_wrapped_year');
    expect(() => wrappedOptions({ year: 1999 })).toThrow('invalid_wrapped_year');
    expect(() => wrappedOptions({ year: 2101 })).toThrow('invalid_wrapped_year');
    expect(() => outputOptions({ outputPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' })).toThrow(
      'invalid_output_path'
    );
  });

  it('validates headless Codex input as fixed sanitized object or array contracts', async () => {
    const contracts = await loadReportContracts();
    const parse = parser(contracts.headlessCodexInputSchema);
    const payload = {
      id: 'codex-object-1',
      timestamp: '2026-06-04T00:00:00.000Z',
      provider: 'openai',
      model: 'gpt-5.5-fast',
      inputTokens: 100,
      outputTokens: 50,
      cachedTokens: 10,
      reasoningTokens: 5,
      sessionId: 'synthetic-session',
      agent: 'codex'
    };

    expect(parse(payload)).toMatchObject(payload);
    expect(
      parse([payload, { ...payload, id: 'codex-object-2', provider: 'anthropic' }])
    ).toHaveLength(2);
    expect(() => parse({ ...payload, source: 'codex' })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, sourceName: 'local' })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, events: [] })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, cacheReadTokens: 1 })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, cacheWriteTokens: 1 })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, metadata: {} })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, prompt: 'hello' })).toThrow('headless_payload_rejected');
    expect(() => parse({ ...payload, sessionId: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' })).toThrow(
      'headless_payload_rejected'
    );
  });

  it('validates provider usage reports for supported live providers only', async () => {
    const contracts = await loadReportContracts();
    const parse = parser(contracts.providerUsageReportSchema);

    expect(
      parse({
        provider: 'openai',
        status: 'not_configured',
        httpStatus: null,
        quota: 'unknown',
        rateLimit: 'unknown',
        resetAt: null,
        checkedAt: '2026-06-04T00:00:00.000Z',
        source: 'env-only-live',
        warnings: []
      })
    ).toMatchObject({ provider: 'openai', source: 'env-only-live' });
    expect(
      parse({
        provider: 'anthropic',
        status: 'ok',
        httpStatus: 200,
        quota: { limit: null, used: null, remaining: null },
        rateLimit: { limit: 1000, remaining: 999 },
        resetAt: null,
        checkedAt: '2026-06-04T00:00:00.000Z',
        source: 'env-only-live',
        warnings: []
      })
    ).toMatchObject({ provider: 'anthropic' });
    expect(() =>
      parse({
        provider: 'unsupported-provider',
        status: 'ok',
        httpStatus: 200,
        quota: 'unknown',
        rateLimit: 'unknown',
        resetAt: null,
        checkedAt: '2026-06-04T00:00:00.000Z',
        source: 'env-only-live',
        warnings: []
      })
    ).toThrow('invalid_provider');
  });

  it('allows normal output paths while rejecting unsafe output path values', async () => {
    const contracts = await loadReportContracts();
    const parse = parser(contracts.reportOutputOptionsSchema);

    expect(parse({ outputPath: '/tmp/tokenwatch-task-4-graph.png', format: 'png' })).toEqual({
      outputPath: '/tmp/tokenwatch-task-4-graph.png',
      format: 'png'
    });
    expect(parse({ outputPath: 'relative-tokenwatch-graph.png', format: 'png' })).toEqual({
      outputPath: 'relative-tokenwatch-graph.png',
      format: 'png'
    });
    expect(parse({ outputPath: 'tokenwatch-task-4-debug.png', format: 'png' })).toEqual({
      outputPath: 'tokenwatch-task-4-debug.png',
      format: 'png'
    });
    for (const outputPath of [
      'RAW_PATH_SENTINEL_DO_NOT_LEAK.png',
      'PROMPT_SENTINEL_DO_NOT_LEAK.png',
      'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK.png',
      'tokenwatch-secret-key.png'
    ]) {
      expect(() => parse({ outputPath, format: 'png' })).toThrow('invalid_output_path');
    }
  });

  it('checks PNG signature and IHDR dimensions before accepting rendered reports', async () => {
    const contracts = await loadReportContracts();
    const validatePngSignatureAndIhdr = callable(contracts.validatePngSignatureAndIhdr);
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x03, 0x20, 0x00, 0x00, 0x02, 0x58, 0x08, 0x06, 0x00, 0x00, 0x00
    ]);

    expect(validatePngSignatureAndIhdr(png)).toEqual({ width: 800, height: 600 });
    expect(() => validatePngSignatureAndIhdr(Buffer.from('not a png'))).toThrow(
      'invalid_report_option'
    );
  });

  it('renders deterministic dependency-free PNG bytes for sanitized report input', async () => {
    const contracts = await loadReportContracts();
    const renderer = await loadPngRenderer();
    const renderReportPng = callable(renderer.renderReportPng);
    const validatePngSignatureAndIhdr = callable(contracts.validatePngSignatureAndIhdr);
    const report = parser(contracts.graphReportSchema)({
      version: 1,
      kind: 'graph',
      generatedAt: '2026-06-04T00:00:00.000Z',
      range: { from: null, to: null },
      bucket: 'day',
      metric: 'tokens',
      totals: { events: 1, tokens: 100, estimatedCostUsd: null },
      series: [{ key: '2026-06-04', events: 1, tokens: 100, estimatedCostUsd: null }],
      unknownCostEvents: 1,
      privacy: { sanitized: true }
    });

    const png = renderReportPng({ report, width: 320, height: 180 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect((png as Buffer).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(validatePngSignatureAndIhdr(png as Buffer)).toEqual({ width: 320, height: 180 });
    expect(renderReportPng({ report, width: 320, height: 180 })).toEqual(png);
  });

  it('renders graph PNG bars from the selected events and cost metrics', async () => {
    const contracts = await loadReportContracts();
    const renderer = await loadPngRenderer();
    const renderReportPng = callable(renderer.renderReportPng);
    const parseGraph = parser(contracts.graphReportSchema);
    const baseReport = {
      version: 1,
      kind: 'graph',
      generatedAt: '2026-06-04T00:00:00.000Z',
      range: { from: null, to: null },
      bucket: 'day',
      totals: { events: 11, tokens: 101, estimatedCostUsd: 0.25 },
      series: [
        { key: '2026-06-04', events: 1, tokens: 100, estimatedCostUsd: null },
        { key: '2026-06-05', events: 10, tokens: 1, estimatedCostUsd: 0.25 }
      ],
      unknownCostEvents: 1,
      privacy: { sanitized: true }
    };
    const eventsReport = parseGraph({ ...baseReport, metric: 'events' });
    const costReport = parseGraph({ ...baseReport, metric: 'cost' });

    const eventsPng = renderReportPng({ report: eventsReport, width: 320, height: 240 }) as Buffer;
    const costPng = renderReportPng({ report: costReport, width: 320, height: 240 }) as Buffer;

    expect(countAccentPixels(eventsPng, 160, 260)).toBeGreaterThan(
      countAccentPixels(eventsPng, 50, 150) * 4
    );
    expect(countAccentPixels(costPng, 160, 260)).toBeGreaterThan(
      countAccentPixels(costPng, 50, 150) * 4
    );
  });
});
