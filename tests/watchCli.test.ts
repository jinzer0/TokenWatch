import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import { watchTickReportSchema } from '../src/services/reportContracts.js';
import { createTempDb, createTestEvent } from './helpers.js';
import { assertCliOutputPrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';

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

describe('watch CLI', () => {
  it('shows the rolling window option in watch help', () => {
    const result = spawnSync('corepack', ['pnpm', 'exec', 'tsx', 'src/cli.ts', 'watch', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(result).toMatchObject({
      status: 0,
      stdout: expect.stringContaining('--window <window>')
    });
  });

  it('renders interval, rolling totals, DTO velocity, top labels, budgets, and privacy in text', async () => {
    await withTempDb(async (dbPath) => {
      insertEvents(dbPath, [
        event('watch-text-row', '2026-06-04T00:09:30.000Z', {
          source: 'opencode',
          sourceName: 'lab-server',
          model: 'watch-model',
          agent: 'opencode',
          workspaceLabel: 'watch-project',
          inputTokens: 40,
          outputTokens: 70,
          cachedTokens: 20,
          reasoningTokens: 10,
          totalTokens: 140,
          metadata: {
            projectLabelSource: 'scan-option',
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK'
          }
        })
      ]);

      const result = await runCli(
        ['watch', '--once', '--interval', '1m', '--window', '10m'],
        dbPath
      );

      expect(result).toMatchObject({ status: 0, stderr: '' });
      for (const expected of [
        'last refresh 2026-06-04T00:10:00.000Z | interval 1m | window 10m',
        'delta totals 1 events | 140 tokens | cost $0.010000',
        'delta tokens input 40 | output 70 | cached 20 | reasoning 10',
        'window totals 1 events | 140 tokens | cost $0.010000',
        'window tokens input 40 | output 70 | cached 20 | reasoning 10',
        'velocity 14 tok/min | cost $0.060000/h',
        'top model watch-model | source opencode | sourceName lab-server | agent opencode | project watch-project',
        'budgets not_configured | warnings 0 | exceeded 0 | unknown 0',
        'privacy: sanitized'
      ]) {
        expect(result.stdout).toContain(expected);
      }
      assertCliOutputPrivacy(result);
    });
  });

  it('emits one parseable canonical v2 document with numeric and nullable DTO values', async () => {
    await withTempDb(async (dbPath) => {
      insertEvents(dbPath, [
        event('watch-json-row', '2026-06-04T00:09:45.000Z', {
          provider: 'unpriced-provider',
          model: 'unpriced-watch-model',
          estimatedCostUsd: null
        })
      ]);

      const result = await runCli(
        ['watch', '--once', '--json', '--interval', '5s', '--window', '10m'],
        dbPath
      );
      const payload = watchTickReportSchema.parse(JSON.parse(result.stdout));

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        version: 2,
        kind: 'watch_tick',
        intervalMs: 5_000,
        windowMs: 600_000,
        filters: { source: [], sourceName: [] },
        delta: { events: 1, totalTokens: 140, estimatedCostUsd: null },
        window: { events: 1, totalTokens: 140, estimatedCostUsd: null },
        velocity: { tokensPerMinute: 14, estimatedCostUsdPerHour: null },
        privacy: { sanitized: true }
      });
      expect([typeof payload.delta.totalTokens, typeof payload.velocity.tokensPerMinute]).toEqual([
        'number',
        'number'
      ]);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    });
  });

  it.each([
    ['--interval', 'invalid_report_option'],
    ['--window', 'invalid_report_option'],
    ['--source', 'unsupported_source'],
    ['--source-name', 'invalid_source_name']
  ])('sanitizes invalid %s input without echoing raw values', async (option, errorCode) => {
    await withTempDb(async (dbPath) => {
      const result = await runCli(
        ['watch', '--once', option, 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        dbPath
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(`error: ${errorCode}\n`);
      expect(result.stderr).not.toContain('RAW_PATH_SENTINEL_DO_NOT_LEAK');
      assertCliOutputPrivacy(result);
    });
  });

  it('renders unknown once costs as unknown rather than zero', async () => {
    await withTempDb(async (dbPath) => {
      insertEvents(dbPath, [
        event('watch-unknown-cost', '2026-06-04T00:09:30.000Z', {
          provider: 'unpriced-provider',
          model: 'unpriced-watch-model',
          estimatedCostUsd: null
        })
      ]);

      const result = await runCli(['watch', '--once', '--window', '10m'], dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('delta totals 1 events | 140 tokens | cost unknown');
      expect(result.stdout).toContain('window totals 1 events | 140 tokens | cost unknown');
      expect(result.stdout).toContain('velocity 14 tok/min | cost unknown/h');
      expect(result.stdout).not.toContain('$0.00');
      assertCliOutputPrivacy(result);
    });
  });

  it('serializes repeated source and sourceName filters as arrays', async () => {
    await withTempDb(async (dbPath) => {
      insertEvents(dbPath, [
        event('codex-local', '2026-06-04T00:09:30.000Z', {
          source: 'codex',
          sourceName: 'local',
          totalTokens: 100
        }),
        event('opencode-lab', '2026-06-04T00:09:40.000Z', {
          source: 'opencode',
          sourceName: 'lab-server',
          totalTokens: 200
        })
      ]);

      const result = await runCli(
        [
          'watch',
          '--once',
          '--json',
          '--interval',
          '1m',
          '--source',
          'codex',
          '--source',
          'opencode',
          '--source-name',
          'local',
          '--source-name',
          'lab-server'
        ],
        dbPath
      );
      const payload = watchTickReportSchema.parse(JSON.parse(result.stdout));

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.filters).toEqual({
        source: ['codex', 'opencode'],
        sourceName: ['local', 'lab-server']
      });
      expect(payload.delta).toMatchObject({ events: 2, totalTokens: 300 });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    });
  });
});

async function withTempDb(run: (dbPath: string) => Promise<void>): Promise<void> {
  const temp = createTempDb();
  try {
    await run(temp.dbPath);
  } finally {
    temp.cleanup();
  }
}

async function runCli(args: readonly string[], dbPath: string): Promise<CliResult> {
  const previousDbPath = process.env.TOKENWATCH_DB_PATH;
  process.env.TOKENWATCH_DB_PATH = dbPath;
  process.exitCode = undefined;
  vi.setSystemTime(new Date('2026-06-04T00:10:00.000Z'));
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
    vi.useRealTimers();
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
  new UsageEventsRepository(db).insertMany(events);
  db.close();
  db = undefined;
}

function event(
  rawIdHash: string,
  timestamp: string,
  overrides: Parameters<typeof createTestEvent>[0] = {}
): UsageEvent {
  const totalTokens = overrides.totalTokens ?? 140;
  return createTestEvent({
    rawIdHash,
    timestamp,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens,
    estimatedCostUsd: 0.01,
    ...overrides
  });
}
