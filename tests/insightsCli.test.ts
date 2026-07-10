import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import {
  insightsCommandReportSchema,
  type InsightsCommandReport
} from '../src/services/reportContracts.js';
import {
  assertCliOutputPrivacy,
  assertExportFilePrivacy,
  assertJsonOutputPrivacy
} from './privacyOutput.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

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

describe('insights CLI', () => {
  it('emits identical strict JSON for insights and optimize', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'insights-json-known',
          model: 'gpt-5.5-fast',
          inputTokens: 200,
          outputTokens: 100,
          cachedTokens: 50,
          reasoningTokens: 20,
          totalTokens: 350,
          estimatedCostUsd: 0.75
        }),
        unknownCostEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'insights-json-unknown',
          model: 'unknown-fixture-model',
          totalTokens: 90
        })
      ]);

      const insights = await runCli(['insights', '--window', '7d', '--json'], temp.dbPath);
      const optimize = await runCli(['optimize', '--window', '7d', '--json'], temp.dbPath);
      const insightsPayload = parseCommandReport(insights.stdout);
      const optimizePayload = parseCommandReport(optimize.stdout);

      expect(insights).toMatchObject({ status: 0, stderr: '' });
      expect(optimize).toMatchObject({ status: 0, stderr: '' });
      expect(normalizeGeneratedAt(insightsPayload)).toEqual(normalizeGeneratedAt(optimizePayload));
      expect(insightsPayload).toMatchObject({
        kind: 'insights-command',
        window: '7d',
        insights: { kind: 'insights', privacy: { sanitized: true } },
        trend: { kind: 'trend', privacy: { sanitized: true } },
        privacy: { sanitized: true }
      });
      expect(insightsPayload).not.toHaveProperty('command');
      expect(insightsPayload).not.toHaveProperty('alias');
      expect(insights.stdout).not.toContain('$0.00');
      expect(optimize.stdout).not.toContain('$0.00');
      assertJsonOutputPrivacy(insightsPayload);
      assertCliOutputPrivacy(insights);
      assertCliOutputPrivacy(optimize);
    } finally {
      temp.cleanup();
    }
  });

  it('renders aggregate-only text without treating unknown prices as zero', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        unknownCostEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'insights-text-unknown',
          metadata: {
            parser: 'test',
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
            rawRecord: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK',
            sql: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK',
            stack: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK at worker (/tmp/raw.ts:1:2)',
            credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK'
          }
        })
      ]);

      const result = await runCli(['insights', '--window', '30d'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('TokenWatch Insights');
      expect(result.stdout).toMatch(/estimated cost\s+unknown/);
      expect(result.stdout).toContain('unknown pricing');
      expect(result.stdout).not.toContain('$0.00');
      expect(result.stderr).not.toContain('$0.00');
      expect(containsPrivacySentinel(result.stdout)).toBe(false);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('writes JSON and Markdown reports while printing only a basename status line', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [createTestEvent({ timestamp: new Date().toISOString() })]);
      const jsonPath = join(temp.dir, 'report.json');
      const markdownPath = join(temp.dir, 'report.md');

      const json = await runCli(['insights', '--window', '7d', '--out', jsonPath], temp.dbPath);
      const markdown = await runCli(
        ['optimize', '--window', '7d', '--out', markdownPath, '--format', 'markdown'],
        temp.dbPath
      );
      const jsonPayload = parseCommandReport(readFileSync(jsonPath, 'utf8'));
      const markdownContents = readFileSync(markdownPath, 'utf8');

      expect(json).toMatchObject({ status: 0, stderr: '' });
      expect(json.stdout).toBe(`Wrote insights JSON: ${basename(jsonPath)}\n`);
      expect(markdown).toMatchObject({ status: 0, stderr: '' });
      expect(markdown.stdout).toBe(`Wrote insights Markdown: ${basename(markdownPath)}\n`);
      expect(markdown.stdout).not.toContain(temp.dir);
      expect(jsonPayload.kind).toBe('insights-command');
      expect(markdownContents).toContain('# TokenWatch Insights');
      expect(markdownContents).toContain('Privacy: sanitized aggregate output only.');
      assertJsonOutputPrivacy(jsonPayload);
      assertExportFilePrivacy(markdownContents);
      assertCliOutputPrivacy(json);
      assertCliOutputPrivacy(markdown);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects invalid options with sanitized errors and no file writes', async () => {
    const temp = createTempDb();
    try {
      const jsonOutPath = join(temp.dir, 'json-out.json');
      const markdownNoOutPath = join(temp.dir, 'markdown-no-out.md');
      const invalidWindow = await runCli(['insights', '--window', 'nope'], temp.dbPath);
      const jsonOut = await runCli(
        ['optimize', '--window', '7d', '--json', '--out', jsonOutPath],
        temp.dbPath
      );
      const unsafeOutputName = await runCli(
        [
          'insights',
          '--window',
          '7d',
          '--out',
          join(temp.dir, 'select token from usage_events.md')
        ],
        temp.dbPath
      );
      const markdownWithoutOut = await runCli(
        ['insights', '--window', '7d', '--format', 'markdown'],
        temp.dbPath
      );

      for (const result of [invalidWindow, jsonOut, markdownWithoutOut]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: invalid_report_option\n');
        assertCliOutputPrivacy(result);
      }
      expect(unsafeOutputName.status).not.toBe(0);
      expect(unsafeOutputName.stdout).toBe('');
      expect(unsafeOutputName.stderr).toBe('error: invalid_output_path\n');
      assertCliOutputPrivacy(unsafeOutputName);
      expect(existsSync(jsonOutPath)).toBe(false);
      expect(existsSync(markdownNoOutPath)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('shows insights and optimize help with the shared window option', async () => {
    const temp = createTempDb();
    try {
      const top = await runCli(['--help'], temp.dbPath);
      const insights = await runCli(['insights', '--help'], temp.dbPath);
      const optimize = await runCli(['optimize', '--help'], temp.dbPath);

      expect(top.status).toBe(0);
      expect(top.stdout).toContain('insights');
      expect(top.stdout).toContain('optimize');
      expect(insights.stdout).toContain('--window <window>');
      expect(optimize.stdout).toContain('--window <window>');
      assertCliOutputPrivacy(insights);
      assertCliOutputPrivacy(optimize);
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
  const writeOut = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
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
    writeOut.mockRestore();
    if (previousDbPath === undefined) {
      delete process.env.TOKENWATCH_DB_PATH;
    } else {
      process.env.TOKENWATCH_DB_PATH = previousDbPath;
    }
  }
}

function insertEvents(dbPath: string, events: readonly UsageEvent[]): void {
  db = openDatabase(dbPath);
  new UsageEventsRepository(db).insertMany(events);
  db.close();
  db = undefined;
}

function unknownCostEvent(overrides: Parameters<typeof createTestEvent>[0]): UsageEvent {
  const totalTokens = overrides.totalTokens ?? 140;
  return {
    ...createTestEvent({
      ...overrides,
      inputTokens: totalTokens,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens
    }),
    estimatedCostUsd: null
  };
}

function parseCommandReport(text: string): InsightsCommandReport {
  return insightsCommandReportSchema.parse(JSON.parse(text));
}

function normalizeGeneratedAt(report: InsightsCommandReport): InsightsCommandReport {
  return {
    ...report,
    generatedAt: '<generated>',
    insights: {
      ...report.insights,
      generatedAt: '<generated>',
      range: { from: '<from>', to: '<to>' }
    },
    trend: {
      ...report.trend,
      generatedAt: '<generated>',
      range: {
        current: { from: '<current-from>', to: '<current-to>' },
        previous: { from: '<previous-from>', to: '<previous-to>' }
      }
    }
  };
}
