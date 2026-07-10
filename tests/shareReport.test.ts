import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareReportService, renderShareReportMarkdown } from '../src/services/shareReport.js';
import { validatePngSignatureAndIhdr } from '../src/services/reportContracts.js';
import { createTempDb, createTestEvent } from './helpers.js';
import {
  assertEvidencePrivacy,
  assertExportFilePrivacy,
  assertJsonOutputPrivacy,
  assertNoForbiddenOutput
} from './privacyOutput.js';

const pngSignatureHex = '89504e470d0a1a0a';

function createEvents() {
  return [
    createTestEvent({
      timestamp: '2026-01-02T00:00:00.000Z',
      rawIdHash: 'known-cost',
      model: 'gpt-5.5-fast',
      agent: 'codex',
      sourceName: 'lab-server',
      inputTokens: 120,
      outputTokens: 80,
      cachedTokens: 0,
      totalTokens: 200,
      estimatedCostUsd: 0.25,
      metadata: {
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
        apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
        oauth: 'FAKE_OAUTH_SENTINEL_DO_NOT_LEAK'
      }
    }),
    {
      ...createTestEvent({
        timestamp: '2026-01-03T00:00:00.000Z',
        rawIdHash: 'unknown-cost',
        model: 'claude-sonnet-4',
        agent: 'opencode',
        sourceName: 'lab-server',
        inputTokens: 300,
        outputTokens: 100,
        cachedTokens: 0,
        totalTokens: 400,
        metadata: {
          response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
          rawRecord: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK',
          credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK',
          sql: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK',
          stack: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK at share (/tmp/raw.ts:1:2)'
        }
      }),
      estimatedCostUsd: null
    }
  ];
}

describe('safe share report service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes aggregate-only JSON with a basename-only desktop result', async () => {
    const temp = createTempDb();
    try {
      // Given: sanitized aggregate events with private metadata on source rows.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'usage-share.json');

      // When: a local JSON share report is written.
      const result = await service.write({
        events: createEvents(),
        format: 'json',
        outputPath,
        report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
      });

      // Then: the renderer-facing result and file contain only safe aggregate fields.
      expect(result).toEqual({
        basename: 'usage-share.json',
        format: 'json',
        bytesWritten: expect.any(Number),
        status: 'written'
      });
      expect(JSON.stringify(result)).not.toContain(temp.dir);
      const contents = await readFile(outputPath, 'utf8');
      const payload = JSON.parse(contents) as Record<string, unknown>;
      expect(payload).toMatchObject({
        kind: 'graph',
        totals: { events: 2, tokens: 600, estimatedCostUsd: null },
        unknownCostEvents: 1,
        privacy: { sanitized: true }
      });
      expect(contents).not.toContain('metadata');
      expect(contents).not.toContain('rawIdHash');
      expect(contents).not.toContain('sessionIdHash');
      expect(contents).not.toContain('$0.00');
      expect(JSON.stringify(result)).not.toContain('$0.00');
      expect(result.bytesWritten).toBe(Buffer.byteLength(contents, 'utf8'));
      assertJsonOutputPrivacy(payload);
      assertExportFilePrivacy(contents);
      assertNoForbiddenOutput(result);
    } finally {
      temp.cleanup();
    }
  });

  it('renders Markdown with aggregate fields, privacy footer, and unknown cost wording', async () => {
    const temp = createTempDb();
    try {
      // Given: yearly aggregate data with one unknown-cost event.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'wrapped-share.md');

      // When: a Markdown share report is written.
      const result = await service.write({
        events: createEvents(),
        format: 'markdown',
        outputPath,
        report: { kind: 'wrapped', year: 2026 }
      });

      // Then: Markdown is aggregate-only and preserves unknown price semantics.
      const markdown = await readFile(outputPath, 'utf8');
      expect(result).toEqual({
        basename: 'wrapped-share.md',
        format: 'markdown',
        bytesWritten: Buffer.byteLength(markdown, 'utf8'),
        status: 'written'
      });
      expect(markdown).toContain('# TokenWatch Wrapped 2026');
      expect(markdown).toContain('Estimated cost: unknown');
      expect(markdown).toContain('Unknown cost events: 1');
      expect(markdown).toContain('Privacy: sanitized aggregate report');
      expect(markdown).not.toContain('$0.00');
      expect(markdown).not.toContain('metadata');
      expect(markdown).not.toContain('rawIdHash');
      expect(markdown).not.toContain('sessionIdHash');
      expect(JSON.stringify(result)).not.toContain('$0.00');
      assertExportFilePrivacy(markdown);
      assertNoForbiddenOutput(result);
    } finally {
      temp.cleanup();
    }
  });

  it('writes PNG reports with a valid PNG signature and no metadata result leakage', async () => {
    const temp = createTempDb();
    try {
      // Given: aggregate graph data and a nested output directory.
      const service = new ShareReportService();
      const outputDir = join(temp.dir, 'exports');
      await mkdir(outputDir);
      const outputPath = join(outputDir, 'usage-share.png');

      // When: a PNG share report is written.
      const result = await service.write({
        events: createEvents(),
        format: 'png',
        outputPath,
        report: { kind: 'graph', bucket: 'day', metric: 'events' }
      });

      // Then: the file is a PNG and the desktop result remains basename-only.
      const bytes = await readFile(outputPath);
      expect(bytes.subarray(0, 8).toString('hex')).toBe(pngSignatureHex);
      expect(validatePngSignatureAndIhdr(bytes)).toEqual({ width: 800, height: 600 });
      expect(result).toEqual({
        basename: 'usage-share.png',
        format: 'png',
        bytesWritten: bytes.length,
        status: 'written'
      });
      expect((await stat(outputPath)).size).toBe(result.bytesWritten);
      expect(JSON.stringify(result)).not.toContain(outputDir);
      assertNoForbiddenOutput(result);
      assertNoForbiddenOutput(bytes.toString('latin1'));
    } finally {
      temp.cleanup();
    }
  });

  it('writes strict insights JSON with aggregate cost fields only', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-09T00:00:00.000Z'));
    const temp = createTempDb();
    try {
      // Given: mixed known and unknown cost events with private metadata.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'insights-share.json');

      // When: a standalone insights JSON report is written.
      const result = await service.write({
        events: createEvents(),
        format: 'json',
        outputPath,
        report: { kind: 'insights', window: '7d' }
      });

      // Then: the file is a strict sanitized insights report with explicit aggregate cost fields.
      const contents = await readFile(outputPath, 'utf8');
      const payload = JSON.parse(contents) as Record<string, unknown>;
      expect(result).toEqual({
        basename: 'insights-share.json',
        format: 'json',
        bytesWritten: Buffer.byteLength(contents, 'utf8'),
        status: 'written'
      });
      expect(payload).toMatchObject({
        kind: 'insights',
        totals: {
          events: 2,
          tokens: 600,
          estimatedCostUsd: null,
          knownEstimatedCostUsd: 0.25,
          unknownCostEvents: 1,
          unknownCostTokens: 400
        },
        privacy: { sanitized: true }
      });
      expect(contents).toContain('"topRows"');
      expect(contents).toContain('"knownEstimatedCostUsd"');
      expect(contents).not.toContain('metadata');
      expect(contents).not.toContain('rawIdHash');
      expect(contents).not.toContain('$0.00');
      expect(JSON.stringify(result)).not.toContain('$0.00');
      assertJsonOutputPrivacy(payload);
      assertExportFilePrivacy(contents);
    } finally {
      temp.cleanup();
    }
  });

  it('writes trend Markdown with strict rolling aggregate rows and privacy footer', async () => {
    const temp = createTempDb();
    try {
      // Given: trend-safe aggregate events.
      const service = new ShareReportService();
      const outputPath = join(temp.dir, 'trend-share.md');

      // When: a standalone trend Markdown report is written.
      const result = await service.write({
        events: createEvents(),
        format: 'markdown',
        outputPath,
        report: { kind: 'trend', window: '30d' }
      });

      // Then: Markdown contains aggregate rows only and no PNG/raw export leakage.
      const markdown = await readFile(outputPath, 'utf8');
      expect(result).toEqual({
        basename: 'trend-share.md',
        format: 'markdown',
        bytesWritten: Buffer.byteLength(markdown, 'utf8'),
        status: 'written'
      });
      expect(markdown).toContain('# TokenWatch Trend');
      expect(markdown).toContain('Trend scope: all-events-rolling');
      expect(markdown).toContain(
        '| Category | Label | Metric | Current tokens | Previous tokens | Current cost | Current known cost | Current unknown events | Current unknown tokens | Direction | Delta percent |'
      );
      expect(markdown).toContain('Privacy: sanitized aggregate report');
      expect(markdown).not.toContain('$0.00');
      expect(markdown).not.toContain('metadata');
      expect(markdown).not.toContain('rawIdHash');
      expect(JSON.stringify(result)).not.toContain('$0.00');
      assertExportFilePrivacy(markdown);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects PNG for insights and trend with a sanitized option error', async () => {
    const temp = createTempDb();
    try {
      // Given: JSON/Markdown-only aggregate report kinds.
      const service = new ShareReportService();

      // When/Then: PNG is rejected at the service boundary before any renderer path is used.
      await expect(
        service.write({
          events: createEvents(),
          format: 'png',
          outputPath: join(temp.dir, 'insights.png'),
          report: { kind: 'insights', window: '7d' }
        })
      ).rejects.toThrow('invalid_report_option');
      await expect(
        service.write({
          events: createEvents(),
          format: 'png',
          outputPath: join(temp.dir, 'trend.png'),
          report: { kind: 'trend', window: '7d' }
        })
      ).rejects.toThrow('invalid_report_option');
      assertEvidencePrivacy('share insights trend png rejected: invalid_report_option');
    } finally {
      temp.cleanup();
    }
  });

  it('rejects invalid paths and unsafe labels with stable sanitized errors', async () => {
    const temp = createTempDb();
    try {
      // Given: share inputs with unsafe output and aggregate label shapes.
      const service = new ShareReportService();
      const unsafeCases = [
        {
          name: 'invalid output path',
          outputPath: '',
          events: createEvents(),
          report: { kind: 'graph', bucket: 'day', metric: 'tokens' } as const,
          error: 'invalid_output_path'
        },
        {
          name: 'raw path-like label',
          outputPath: join(temp.dir, 'raw-path.md'),
          events: [{ ...createTestEvent(), sourceName: '/Users/example/private-project' }],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        },
        {
          name: 'raw session-like value',
          outputPath: join(temp.dir, 'raw-session.md'),
          events: [{ ...createTestEvent(), sessionIdHash: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK' }],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        },
        {
          name: 'SQL-like aggregate text',
          outputPath: join(temp.dir, 'sql-like.md'),
          events: [createTestEvent({ model: 'select token from usage_events' })],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        },
        {
          name: 'SQL sentinel aggregate text',
          outputPath: join(temp.dir, 'sql-sentinel.md'),
          events: [{ ...createTestEvent(), model: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK' }],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        },
        {
          name: 'stack-like aggregate text',
          outputPath: join(temp.dir, 'stack-like.md'),
          events: [{ ...createTestEvent(), agent: 'at worker (/tmp/app.ts:1:2)' }],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        },
        {
          name: 'stack sentinel aggregate text',
          outputPath: join(temp.dir, 'stack-sentinel.md'),
          events: [{ ...createTestEvent(), agent: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK' }],
          report: { kind: 'wrapped', year: 2026 } as const,
          error: 'invalid_report_option'
        }
      ];

      // When/Then: every unsafe case fails with only a stable code.
      for (const unsafeCase of unsafeCases) {
        await expect(
          service.write({
            events: unsafeCase.events,
            format: 'markdown',
            outputPath: unsafeCase.outputPath,
            report: unsafeCase.report
          })
        ).rejects.toThrow(unsafeCase.error);
        expect(unsafeCase.name.length).toBeGreaterThan(0);
        assertEvidencePrivacy(`share case rejected: ${unsafeCase.error}`);
      }
    } finally {
      temp.cleanup();
    }
  });

  it('exposes Markdown rendering as a pure contract for sanitized reports', async () => {
    // Given: a graph report already built from aggregate events.
    const service = new ShareReportService();
    const report = service.buildReport(createEvents(), {
      kind: 'graph',
      bucket: 'month',
      metric: 'cost'
    });

    // When: Markdown is rendered without touching the filesystem.
    const markdown = renderShareReportMarkdown(report);

    // Then: consumers receive deterministic aggregate text only.
    expect(markdown).toContain('# TokenWatch Cost Graph');
    expect(markdown).toContain('| 2026-01 | 2 | 600 | unknown |');
    expect(markdown).toContain('Privacy: sanitized aggregate report');
    assertExportFilePrivacy(markdown);
  });
});
