// allow: SIZE_OK - heatmap CLI contract regressions intentionally share one isolated harness.
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import { heatmapReportSchema, type HeatmapReport } from '../src/services/reportContracts.js';
import { renderHeatmapSvg } from '../src/services/heatmapSvgRenderer.js';
import { createTempDb, createTestEvent } from './helpers.js';
import {
  assertCliOutputPrivacy,
  assertExportFilePrivacy,
  assertJsonOutputPrivacy
} from './privacyOutput.js';

type CliResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('heatmap CLI', () => {
  it('prints privacy-safe text for the selected year and metric', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('heatmap-text-row', {
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        })
      ]);

      const result = await runCli(['heatmap', '--year', '2026', '--metric', 'events'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('TokenWatch Heatmap');
      expect(result.stdout).toContain('Year: 2026');
      expect(result.stdout).toContain('Metric: events');
      expect(result.stdout).toContain('Legend:');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('emits strict heatmap JSON to stdout', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('heatmap-json-row')]);

      const result = await runCli(['heatmap', '--year', '2026', '--json'], temp.dbPath);
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        kind: 'heatmap',
        year: 2026,
        metric: 'tokens',
        totals: { events: 1, totalTokens: 140 },
        privacy: { sanitized: true }
      });
      expect(payload.days).toHaveLength(365);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('projects repeated source and sourceName filters into stdout JSON', async () => {
    // Given: matching events for two repeated source and sourceName filters.
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('codex-local-filter', { source: 'codex', sourceName: 'local' }),
        event('opencode-lab-filter', { source: 'opencode', sourceName: 'lab-server' })
      ]);

      // When: JSON output is requested with repeated filters.
      const result = await runCli(
        [
          'heatmap',
          '--year',
          '2026',
          '--json',
          '--source',
          'codex',
          '--source',
          'opencode',
          '--source-name',
          'local',
          '--source-name',
          'lab-server'
        ],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      // Then: the strict report exposes only the selected safe aggregate labels.
      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        filters: {
          source: ['codex', 'opencode'],
          sourceName: ['local', 'lab-server']
        }
      });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('writes the same semantic filtered report to a JSON file as stdout JSON', async () => {
    // Given: a filtered event and an isolated JSON output path.
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('json-file-filter', { sourceName: 'lab-server' })]);
      const outputPath = join(temp.dir, 'filtered-heatmap.json');
      const filterArgs = [
        'heatmap',
        '--year',
        '2026',
        '--source',
        'codex',
        '--source-name',
        'lab-server'
      ] as const;

      // When: the same report is requested through stdout and file surfaces.
      const stdoutResult = await runCli([...filterArgs, '--json'], temp.dbPath);
      const fileResult = await runCli([...filterArgs, '--out', outputPath], temp.dbPath);
      const stdoutPayload = parseHeatmap(stdoutResult.stdout);
      const fileContents = readFileSync(outputPath, 'utf8');
      const filePayload = parseHeatmap(fileContents);

      // Then: generated time aside, both surfaces expose the same filtered report.
      expect(stdoutResult).toMatchObject({ status: 0, stderr: '' });
      expect(fileResult).toMatchObject({
        status: 0,
        stderr: '',
        stdout: `Wrote heatmap JSON: ${basename(outputPath)}\n`
      });
      expect(fileResult.stdout).not.toContain(temp.dir);
      expect.soft(filePayload).toMatchObject({
        filters: { source: ['codex'], sourceName: ['lab-server'] }
      });
      expect.soft(filePayload).toEqual({
        ...stdoutPayload,
        generatedAt: filePayload.generatedAt
      });
      assertJsonOutputPrivacy(stdoutPayload);
      assertJsonOutputPrivacy(filePayload);
      assertExportFilePrivacy(fileContents);
      assertCliOutputPrivacy(stdoutResult);
      assertCliOutputPrivacy(fileResult);
    } finally {
      temp.cleanup();
    }
  });

  it('renders exact density symbols, filters, and unknownCostEvents in text output', async () => {
    // Given: an unknown-cost event selected by safe aggregate filters.
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('text-visible-context', {
          source: 'codex',
          sourceName: 'lab-server',
          model: 'unknown-cost-model',
          estimatedCostUsd: null
        })
      ]);

      // When: filtered cost heatmap text is written to a file.
      const outputPath = join(temp.dir, 'filtered-heatmap.txt');
      const result = await runCli(
        [
          'heatmap',
          '--year',
          '2026',
          '--metric',
          'cost',
          '--source',
          'codex',
          '--source-name',
          'lab-server',
          '--out',
          outputPath
        ],
        temp.dbPath
      );
      const contents = readFileSync(outputPath, 'utf8');

      // Then: visible text carries the canonical legend and report context.
      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect.soft(contents).toContain('Year: 2026');
      expect.soft(contents).toContain('Metric: cost');
      expect.soft(contents).toContain('Range: 2026-01-01 to 2026-12-31');
      expect
        .soft(contents)
        .toContain('Summary: 1 events, 140 tokens, unknown cost, unknownCostEvents: 1');
      expect
        .soft(contents)
        .toContain(
          'Legend: ·=No usage ▁=Very low usage ▂=Low usage ▃=Medium usage ▅=High usage █=Peak usage'
        );
      expect.soft(contents).toMatch(/Filters:.*source.*codex/i);
      expect.soft(contents).toMatch(/Filters:.*sourceName.*lab-server/i);
      expect.soft(contents).toContain('unknownCostEvents: 1');
      expect(contents).not.toMatch(/\$0(?:\.0+)?|\bfree\b|\b(?:zero|no) cost\b/i);
      assertExportFilePrivacy(contents);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('writes accessible aggregate-only SVG without external resources', async () => {
    // Given: an unknown-cost event and isolated SVG and JSON report paths.
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('svg-visible-context', {
          sourceName: 'lab-server',
          model: 'unknown-cost-model',
          estimatedCostUsd: null
        })
      ]);
      const svgPath = join(temp.dir, 'filtered-heatmap.svg');
      const jsonPath = join(temp.dir, 'filtered-heatmap.json');

      // When: filtered SVG and its source report are written through the CLI.
      const svgResult = await runCli(
        [
          'heatmap',
          '--year',
          '2026',
          '--metric',
          'cost',
          '--source-name',
          'lab-server',
          '--out',
          svgPath
        ],
        temp.dbPath
      );
      await runCli(
        [
          'heatmap',
          '--year',
          '2026',
          '--metric',
          'cost',
          '--source-name',
          'lab-server',
          '--out',
          jsonPath
        ],
        temp.dbPath
      );
      const contents = readFileSync(svgPath, 'utf8');
      const report = parseHeatmap(readFileSync(jsonPath, 'utf8'));
      const escapedTitleSvg = renderHeatmapSvg(report, {
        title: 'TokenWatch <safe aggregate> & usage'
      });
      const dayCellDates = [
        ...contents.matchAll(/<rect\b[^>]*><title>(\d{4}-\d{2}-\d{2})\b[^<]*<\/title><\/rect>/g)
      ]
        .map((match) => match[1])
        .filter((date): date is string => date !== undefined);

      // Then: accessibility, visible unknown-cost context, escaping, and resource safety hold.
      expect(svgResult).toMatchObject({ status: 0, stderr: '' });
      expect.soft(contents).toMatch(/^<svg[^>]*><title>[^<]+<\/title>/);
      expect.soft(contents).toMatch(/^<svg[^>]*><title>[^<]+<\/title><desc>[^<]+<\/desc>/);
      expect
        .soft(contents)
        .toContain('Year 2026 | Metric cost | 1 events | 140 tokens | unknown cost');
      expect.soft(contents).toContain('Range 2026-01-01 to 2026-12-31');
      expect.soft(contents).toContain('Filters: sourceName=lab-server');
      expect.soft(contents).toContain('unknownCostEvents: 1');
      for (const symbol of ['·', '▁', '▂', '▃', '▅', '█'] as const) {
        expect.soft(contents).toContain(symbol);
      }
      expect(dayCellDates).toEqual(report.days.map(({ date }) => date));
      expect(new Set(dayCellDates)).toHaveLength(report.days.length);
      expect(escapedTitleSvg).toContain('TokenWatch &lt;safe aggregate&gt; &amp; usage');
      expect(contents).not.toMatch(
        /<script\b|<image\b|<link\b|\bhref\s*=|\bsrc\s*=|@import|url\s*\(/i
      );
      expect(contents).not.toMatch(/\$0(?:\.0+)?|\bfree\b|\b(?:zero|no) cost\b/i);
      assertExportFilePrivacy(contents);
      assertExportFilePrivacy(escapedTitleSvg);
      assertCliOutputPrivacy(svgResult);
    } finally {
      temp.cleanup();
    }
  });

  it('writes JSON, text, and SVG files while printing only safe basenames', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('heatmap-file-row')]);
      const jsonPath = join(temp.dir, 'usage-heatmap.json');
      const textPath = join(temp.dir, 'usage-heatmap.txt');
      const svgPath = join(temp.dir, 'usage-heatmap.svg');

      const json = await runCli(['heatmap', '--year', '2026', '--out', jsonPath], temp.dbPath);
      const text = await runCli(['heatmap', '--year', '2026', '--out', textPath], temp.dbPath);
      const svg = await runCli(['heatmap', '--year', '2026', '--out', svgPath], temp.dbPath);
      const jsonContents = readFileSync(jsonPath, 'utf8');
      const jsonPayload = parseHeatmap(jsonContents);
      const textContents = readFileSync(textPath, 'utf8');
      const svgContents = readFileSync(svgPath, 'utf8');

      expect(json).toMatchObject({ status: 0, stderr: '' });
      expect(text).toMatchObject({ status: 0, stderr: '' });
      expect(svg).toMatchObject({ status: 0, stderr: '' });
      expect(json.stdout).toBe(`Wrote heatmap JSON: ${basename(jsonPath)}\n`);
      expect(text.stdout).toBe(`Wrote heatmap text: ${basename(textPath)}\n`);
      expect(svg.stdout).toBe(`Wrote heatmap SVG: ${basename(svgPath)}\n`);
      expect(json.stdout).not.toContain(temp.dir);
      expect(jsonPayload.kind).toBe('heatmap');
      expect(textContents).toContain('TokenWatch Heatmap');
      expect(svgContents).toContain('<svg');
      assertJsonOutputPrivacy(jsonPayload);
      assertExportFilePrivacy(jsonContents);
      assertExportFilePrivacy(textContents);
      assertExportFilePrivacy(svgContents);
      assertCliOutputPrivacy(json);
      assertCliOutputPrivacy(text);
      assertCliOutputPrivacy(svg);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects --json with --out without creating a file', async () => {
    const temp = createTempDb();
    try {
      const jsonOutPath = join(temp.dir, 'json-out.json');

      const result = await runCli(['heatmap', '--json', '--out', jsonOutPath], temp.dbPath);

      expect(result).toEqual({
        status: 1,
        stdout: '',
        stderr: 'error: invalid_report_option\n'
      });
      expect(existsSync(jsonOutPath)).toBe(false);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects an unsupported output extension with a bounded path-safe error', async () => {
    const temp = createTempDb();
    try {
      const outputPath = join(temp.dir, 'RAW_PATH_SENTINEL_DO_NOT_LEAK.png');

      const result = await runCli(['heatmap', '--out', outputPath], temp.dbPath);

      expect(result).toEqual({
        status: 1,
        stdout: '',
        stderr: 'error: invalid_output_path\n'
      });
      expect(result.stderr).not.toContain(outputPath);
      expect(existsSync(outputPath)).toBe(false);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects unsupported sources instead of returning an empty report', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(
        ['heatmap', '--year', '2026', '--json', '--source', 'unsupported-adapter'],
        temp.dbPath
      );

      expect(result).toEqual({
        status: 1,
        stdout: '',
        stderr: 'error: unsupported_source\n'
      });
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects invalid metrics with bounded sanitized errors', async () => {
    const temp = createTempDb();
    try {
      for (const metric of ['sessions', 'PROMPT_SENTINEL_DO_NOT_LEAK']) {
        const result = await runCli(['heatmap', '--metric', metric], temp.dbPath);

        expect(result).toEqual({
          status: 1,
          stdout: '',
          stderr: 'error: invalid_report_option\n'
        });
        assertCliOutputPrivacy(result);
      }
    } finally {
      temp.cleanup();
    }
  });

  it('rejects malformed and out-of-range years with bounded sanitized errors', async () => {
    const temp = createTempDb();
    try {
      for (const year of ['abc', '0', '-1', '1969', '9999', '10000']) {
        const result = await runCli(['heatmap', '--year', year], temp.dbPath);

        expect(result).toEqual({
          status: 1,
          stdout: '',
          stderr: 'error: invalid_report_option\n'
        });
        assertCliOutputPrivacy(result);
      }
    } finally {
      temp.cleanup();
    }
  });

  it('does not echo rejected source or sourceName privacy sentinels', async () => {
    const temp = createTempDb();
    try {
      const invalidSource = await runCli(
        ['heatmap', '--source', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );
      const invalidSourceName = await runCli(
        ['heatmap', '--source-name', 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      expect(invalidSource).toEqual({
        status: 1,
        stdout: '',
        stderr: 'error: unsupported_source\n'
      });
      expect(invalidSourceName).toEqual({
        status: 1,
        stdout: '',
        stderr: 'error: invalid_source_name\n'
      });
      assertCliOutputPrivacy(invalidSource);
      assertCliOutputPrivacy(invalidSourceName);
    } finally {
      temp.cleanup();
    }
  });

  it('uses OR semantics for repeated source filters', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('codex-local', { source: 'codex', sourceName: 'local', totalTokens: 100 }),
        event('opencode-lab', { source: 'opencode', sourceName: 'lab-server', totalTokens: 200 }),
        event('claude-prod', { source: 'claude', sourceName: 'prod-server', totalTokens: 400 })
      ]);

      const result = await runCli(
        ['heatmap', '--year', '2026', '--json', '--source', 'codex', '--source', 'opencode'],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.totals).toMatchObject({ events: 2, totalTokens: 300 });
      expect(payload.filters).toEqual({
        source: ['codex', 'opencode'],
        sourceName: []
      });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('uses OR semantics for repeated sourceName filters', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('local', { sourceName: 'local', totalTokens: 100 }),
        event('lab', { sourceName: 'lab-server', totalTokens: 200 }),
        event('prod', { sourceName: 'prod-server', totalTokens: 400 })
      ]);

      const result = await runCli(
        [
          'heatmap',
          '--year',
          '2026',
          '--json',
          '--source-name',
          'local',
          '--source-name',
          'lab-server'
        ],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.totals).toMatchObject({ events: 2, totalTokens: 300 });
      expect(payload.filters).toEqual({
        source: [],
        sourceName: ['local', 'lab-server']
      });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('uses AND semantics across source and sourceName filters', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('codex-local', { source: 'codex', sourceName: 'local', totalTokens: 100 }),
        event('codex-prod', { source: 'codex', sourceName: 'prod-server', totalTokens: 200 }),
        event('opencode-local', { source: 'opencode', sourceName: 'local', totalTokens: 400 })
      ]);

      const result = await runCli(
        ['heatmap', '--year', '2026', '--json', '--source', 'codex', '--source-name', 'local'],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.totals).toMatchObject({ events: 1, totalTokens: 100 });
      expect(payload.filters).toEqual({ source: ['codex'], sourceName: ['local'] });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('returns an empty full-year report for an unknown valid sourceName', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('existing-label', { sourceName: 'local' })]);

      const result = await runCli(
        ['heatmap', '--year', '2026', '--json', '--source-name', 'unknown-safe-label'],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.filters).toEqual({ source: [], sourceName: ['unknown-safe-label'] });
      expect(payload.totals).toEqual({
        events: 0,
        totalTokens: 0,
        estimatedCostUsd: null,
        unknownCostEvents: 0
      });
      expect(payload.days).toHaveLength(365);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('returns an empty full-year report for a supported source with no rows', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('different-source', { source: 'codex' })]);

      const result = await runCli(
        ['heatmap', '--year', '2024', '--json', '--source', 'opencode'],
        temp.dbPath
      );
      const payload = parseHeatmap(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.filters).toEqual({ source: ['opencode'], sourceName: [] });
      expect(payload.totals).toEqual({
        events: 0,
        totalTokens: 0,
        estimatedCostUsd: null,
        unknownCostEvents: 0
      });
      expect(payload.days).toHaveLength(366);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });
});

async function runCli(args: readonly string[], dbPath: string): Promise<CliResult> {
  const previousDbPath = process.env.TOKENWATCH_DB_PATH;
  process.env.TOKENWATCH_DB_PATH = dbPath;
  process.exitCode = undefined;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((message = '') => {
    stdout.push(String(message));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((message = '') => {
    stderr.push(String(message));
  });

  try {
    await main(['node', 'tokenwatch', ...args]);
    return {
      status: typeof process.exitCode === 'number' ? process.exitCode : 0,
      stdout: stdout.length ? `${stdout.join('\n')}\n` : '',
      stderr: stderr.length ? `${stderr.join('\n')}\n` : ''
    };
  } finally {
    log.mockRestore();
    error.mockRestore();
    if (previousDbPath === undefined) {
      delete process.env.TOKENWATCH_DB_PATH;
    } else {
      process.env.TOKENWATCH_DB_PATH = previousDbPath;
    }
  }
}

function insertEvents(dbPath: string, events: readonly UsageEvent[]): void {
  db = openDatabase(dbPath);
  new UsageEventsRepository(db).insertMany([...events]);
  db.close();
  db = undefined;
}

function event(
  rawIdHash: string,
  overrides: Parameters<typeof createTestEvent>[0] = {}
): UsageEvent {
  const totalTokens = overrides.totalTokens ?? 140;
  return createTestEvent({
    rawIdHash,
    timestamp: '2026-05-30T00:00:00.000Z',
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens,
    estimatedCostUsd: 0.01,
    ...overrides
  });
}

function parseHeatmap(text: string): HeatmapReport {
  return heatmapReportSchema.parse(JSON.parse(text));
}
