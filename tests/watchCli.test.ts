import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import type { WatchTickReport } from '../src/services/reportContracts.js';
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
  it('prints one sanitized text tick with --once', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('watch-text-row', '2026-06-04T00:09:30.000Z', {
          inputTokens: 40,
          outputTokens: 70,
          cachedTokens: 20,
          reasoningTokens: 10,
          totalTokens: 140,
          metadata: { prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
        })
      ]);

      const result = await runCli(['watch', '--once', '--interval', '1m'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('TokenWatch watch');
      expect(result.stdout).toContain('last refresh 2026-06-04T00:10:00.000Z');
      expect(result.stdout).toContain('1 events');
      expect(result.stdout).toContain('140 tokens');
      expect(result.stdout).toContain('delta input 40 | output 70 | cached 20 | reasoning 10');
      expect(result.stdout).toContain('privacy: sanitized');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('emits one strict watch_tick JSON object with --once --json', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [event('watch-json-row', '2026-06-04T00:09:45.000Z')]);

      const result = await runCli(['watch', '--once', '--json', '--interval', '1m'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as WatchTickReport;

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        version: 1,
        kind: 'watch_tick',
        intervalMs: 60_000,
        delta: { events: 1, tokens: 140 },
        privacy: { sanitized: true }
      });
      expect(payload.delta.estimatedCostUsd).not.toBe(0);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid interval input without echoing raw values', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(
        ['watch', '--once', '--interval', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_report_option\n');
      expect(result.stderr).not.toContain('RAW_PATH_SENTINEL_DO_NOT_LEAK');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('applies repeated source and sourceName filters to aggregate selection only', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        event('codex-local', '2026-06-04T00:09:30.000Z', {
          source: 'codex',
          sourceName: 'local',
          totalTokens: 100
        }),
        event('opencode-lab', '2026-06-04T00:09:40.000Z', {
          source: 'opencode',
          sourceName: 'lab-server',
          totalTokens: 200
        }),
        event('claude-local', '2026-06-04T00:09:50.000Z', {
          source: 'claude',
          sourceName: 'local',
          totalTokens: 400
        }),
        event('codex-prod', '2026-06-04T00:09:55.000Z', {
          source: 'codex',
          sourceName: 'prod-server',
          totalTokens: 800
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
        temp.dbPath
      );
      const payload = JSON.parse(result.stdout) as WatchTickReport;

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.delta).toMatchObject({ events: 2, tokens: 300 });
      expect(JSON.stringify(payload)).not.toContain('prod-server');
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
