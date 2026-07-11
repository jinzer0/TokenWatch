import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import { heatmapReportSchema, type HeatmapReport } from '../src/services/reportContracts.js';
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
        totals: { events: 1, tokens: 140 },
        privacy: { sanitized: true }
      });
      expect(payload.days).toHaveLength(365);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
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

  it('rejects invalid heatmap options with bounded sanitized errors', async () => {
    const temp = createTempDb();
    try {
      const jsonOutPath = join(temp.dir, 'json-out.json');
      const pngPath = join(temp.dir, 'usage-heatmap.png');
      const jsonOut = await runCli(['heatmap', '--json', '--out', jsonOutPath], temp.dbPath);
      const png = await runCli(['heatmap', '--out', pngPath], temp.dbPath);
      const invalidYears: CliResult[] = [];
      for (const year of ['99', '10000', '2026.5', 'last-year', 'RAW_PATH_SENTINEL_DO_NOT_LEAK']) {
        invalidYears.push(await runCli(['heatmap', '--year', year], temp.dbPath));
      }
      const invalidMetrics: CliResult[] = [];
      for (const metric of ['sessions', 'PROMPT_SENTINEL_DO_NOT_LEAK']) {
        invalidMetrics.push(await runCli(['heatmap', '--metric', metric], temp.dbPath));
      }
      const invalidSource = await runCli(
        ['heatmap', '--source', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );
      const invalidSourceName = await runCli(
        ['heatmap', '--source-name', 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      for (const result of [jsonOut, ...invalidYears, ...invalidMetrics]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: invalid_report_option\n');
        assertCliOutputPrivacy(result);
      }
      for (const result of [png, invalidSource, invalidSourceName]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        assertCliOutputPrivacy(result);
      }
      expect(png.stderr).toBe('error: invalid_output_path\n');
      expect(invalidSource.stderr).toBe('error: unsupported_source\n');
      expect(invalidSourceName.stderr).toBe('error: invalid_source_name\n');
      expect(existsSync(jsonOutPath)).toBe(false);
      expect(existsSync(pngPath)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('applies repeated source and sourceName filters and returns empty safe reports for no matches', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('codex-local', { source: 'codex', sourceName: 'local', totalTokens: 100 }),
        event('opencode-lab', { source: 'opencode', sourceName: 'lab-server', totalTokens: 200 }),
        event('claude-prod', { source: 'claude', sourceName: 'prod-server', totalTokens: 400 })
      ]);

      const selected = await runCli(
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
      const empty = await runCli(
        ['heatmap', '--year', '2026', '--json', '--source-name', 'unknown-safe-label'],
        temp.dbPath
      );
      const selectedPayload = parseHeatmap(selected.stdout);
      const emptyPayload = parseHeatmap(empty.stdout);

      expect(selected).toMatchObject({ status: 0, stderr: '' });
      expect(selectedPayload.totals).toMatchObject({ events: 2, tokens: 300 });
      expect(JSON.stringify(selectedPayload)).not.toContain('prod-server');
      expect(empty).toMatchObject({ status: 0, stderr: '' });
      expect(emptyPayload.totals).toMatchObject({ events: 0, tokens: 0, estimatedCostUsd: null });
      expect(emptyPayload.days).toHaveLength(365);
      assertJsonOutputPrivacy(selectedPayload);
      assertJsonOutputPrivacy(emptyPayload);
      assertCliOutputPrivacy(selected);
      assertCliOutputPrivacy(empty);
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
