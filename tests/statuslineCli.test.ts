// allow: SIZE_OK - CLI suite intentionally keeps default and opt-in preset statusline regressions together.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import type { StatuslineDto, StatuslinePresetDto } from '../src/services/statusline.js';
import { assertCliOutputPrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';
import { createTempDb, createTestEvent } from './helpers.js';

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

describe('statusline CLI', () => {
  it('emits one compact today status line by default', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'today-row',
          totalTokens: 150,
          estimatedCostUsd: 0.25
        })
      ]);

      const result = await runCli(['statusline'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
      expect(result.stdout).toContain('TokenWatch | today');
      expect(result.stdout).toContain('1 events');
      expect(result.stdout).toContain('150 tokens');
      expect(result.stdout).toContain('budgets ok');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('emits stable month JSON with nullable unknown cost fields', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'known-row',
          inputTokens: 90,
          outputTokens: 0,
          cachedTokens: 0,
          totalTokens: 90,
          estimatedCostUsd: 0.1
        }),
        createUnknownCostEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'unknown-row',
          totalTokens: 40
        })
      ]);

      const result = await runCli(['statusline', '--window', 'month', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as StatuslineDto;

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        version: 1,
        kind: 'statusline',
        window: 'month',
        totals: { events: 2, tokens: 130, estimatedCostUsd: null },
        knownEstimatedCostUsd: 0.1,
        unknownCostEvents: 1,
        unknownCostTokens: 40,
        privacy: { sanitized: true }
      });
      expect(payload.range.label).toMatch(/^\d{4}-\d{2}$/);
      expect(payload).not.toHaveProperty('preset');
      expect(payload).not.toHaveProperty('recent');
      expect(payload).not.toHaveProperty('tokensPerMinute');
      expect(payload).not.toHaveProperty('budgetPressure');
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('reports no-data and budget warnings without treating unknown cost as zero', async () => {
    const temp = createTempDb();
    try {
      const empty = await runCli(['statusline', '--json'], temp.dbPath);
      const emptyPayload = JSON.parse(empty.stdout) as StatuslineDto;
      expect(emptyPayload.totals).toMatchObject({ events: 0, tokens: 0, estimatedCostUsd: null });

      await runCli(
        ['budget', 'set', '--scope', 'monthly_total', '--threshold', '0.01'],
        temp.dbPath
      );
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'over-budget-row',
          estimatedCostUsd: 0.25
        }),
        createUnknownCostEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'unknown-cost-row',
          totalTokens: 20
        })
      ]);

      const result = await runCli(['statusline', '--window', 'month', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as StatuslineDto;
      const text = await runCli(['statusline', '--window', 'month'], temp.dbPath);

      expect(payload.totals.estimatedCostUsd).toBeNull();
      expect(payload.knownEstimatedCostUsd).toBeGreaterThan(0.01);
      expect(payload.budgets).toMatchObject({ warningCount: 1, overCount: 1 });
      expect(payload.budgets.rows[0]?.warnings).toEqual(
        expect.arrayContaining(['budget_threshold_exceeded', 'budget_unknown_cost_present'])
      );
      expect(text.stdout).toContain('cost unknown');
      expect(text.stdout).toContain('unknown 1/20 tok');
      expect(text.stdout).toContain('budgets 1 warn');
      assertCliOutputPrivacy(result);
      assertCliOutputPrivacy(text);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid window input', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(['statusline', '--window', 'decade'], temp.dbPath);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_statusline_window\n');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('emits compact preset text only when the preset flag is used', async () => {
    const temp = createTempDb();
    try {
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'compact-row',
          totalTokens: 250,
          estimatedCostUsd: 0.5
        })
      ]);

      const result = await runCli(['statusline', '--preset', 'compact'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('TokenWatch | compact | today');
      expect(result.stdout).toContain('250 tokens');
      expect(result.stdout).toContain('budget ok');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('emits live preset JSON with recent token rate and strict preset shape', async () => {
    const temp = createTempDb();
    const now = new Date(2026, 4, 20, 12, 0, 0, 0);
    vi.setSystemTime(now);
    try {
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date(2026, 4, 20, 11, 55).toISOString(),
          rawIdHash: 'live-recent-row',
          totalTokens: 300,
          estimatedCostUsd: 0.75
        }),
        createUnknownCostEvent({
          timestamp: new Date(2026, 4, 20, 11, 40).toISOString(),
          rawIdHash: 'live-older-unknown-row',
          totalTokens: 120
        })
      ]);

      const result = await runCli(['statusline', '--preset', 'live', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as StatuslinePresetDto;

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        version: 1,
        kind: 'statusline-preset',
        preset: 'live',
        window: 'today',
        recent: { minutes: 10, tokens: 300, tokensPerMinute: 30 },
        unknownCostEvents: 1,
        privacy: { sanitized: true }
      });
      expect(payload).toHaveProperty('budgetPressure');
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      vi.useRealTimers();
      temp.cleanup();
    }
  });

  it('reports budget pressure and unknown costs in preset JSON', async () => {
    const temp = createTempDb();
    try {
      await runCli(
        ['budget', 'set', '--scope', 'monthly_total', '--threshold', '0.5'],
        temp.dbPath
      );
      insertEvents(temp.dbPath, [
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'known-budget-row',
          totalTokens: 100,
          estimatedCostUsd: 1
        }),
        createUnknownCostEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'unknown-budget-row',
          totalTokens: 75
        })
      ]);

      const result = await runCli(['statusline', '--preset', 'compact', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as StatuslinePresetDto;

      expect(payload.budgetPressure).toMatchObject({
        status: 'over',
        maxPercent: 200,
        unknownCostCount: 0,
        unknownCostEvents: 1,
        unknownCostTokens: 75
      });
      expect(payload.unknownCostEvents).toBe(1);
      assertJsonOutputPrivacy(payload);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid preset input', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(['statusline', '--preset', 'wide'], temp.dbPath);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_report_option\n');
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
  new UsageEventsRepository(db).insertMany(events);
  db.close();
  db = undefined;
}

function createUnknownCostEvent(overrides: Parameters<typeof createTestEvent>[0]): UsageEvent {
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
