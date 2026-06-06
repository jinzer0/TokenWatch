import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

type CliResult = {
  status: number;
  stdout: string;
  stderr: string;
};

let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('budget CLI', () => {
  it('sets, lists, and unsets monthly total and sourceName budgets', async () => {
    const temp = createTempDb();
    try {
      const monthly = await runCli(
        ['budget', 'set', '--scope', 'monthly_total', '--threshold', '12.5'],
        temp.dbPath
      );
      const source = await runCli(
        [
          'budget',
          'set',
          '--scope',
          'sourceName',
          '--source-name',
          'lab-a100',
          '--threshold',
          '3.25'
        ],
        temp.dbPath
      );
      const listJson = await runCli(['budget', 'list', '--json'], temp.dbPath);
      const payload = JSON.parse(listJson.stdout) as Array<{
        scopeKind: string;
        sourceName: string | null;
        thresholdUsd: number;
      }>;

      expect(monthly).toMatchObject({ status: 0, stderr: '' });
      expect(source).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            scopeKind: 'monthly_total',
            sourceName: null,
            thresholdUsd: 12.5
          }),
          expect.objectContaining({
            scopeKind: 'sourceName',
            sourceName: 'lab-a100',
            thresholdUsd: 3.25
          })
        ])
      );

      const listText = await runCli(['budget', 'list'], temp.dbPath);
      expect(listText.stdout).toContain('monthly_total');
      expect(listText.stdout).toContain('lab-a100');
      expect(containsPrivacySentinel(listText)).toBe(false);

      const unsetSource = await runCli(
        ['budget', 'unset', '--scope', 'sourceName', '--source-name', 'lab-a100'],
        temp.dbPath
      );
      const unsetMonthly = await runCli(
        ['budget', 'unset', '--scope', 'monthly_total'],
        temp.dbPath
      );
      const emptyList = await runCli(['budget', 'list'], temp.dbPath);

      expect(unsetSource).toMatchObject({ status: 0, stderr: '' });
      expect(unsetMonthly).toMatchObject({ status: 0, stderr: '' });
      expect(emptyList.stdout).toBe('No budget thresholds set\n');
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid budget input and private sentinel source names', async () => {
    const temp = createTempDb();
    try {
      const invalidThreshold = await runCli(
        [
          'budget',
          'set',
          '--scope',
          'monthly_total',
          '--threshold',
          'RAW_PATH_SENTINEL_DO_NOT_LEAK'
        ],
        temp.dbPath
      );
      const invalidSourceName = await runCli(
        [
          'budget',
          'set',
          '--scope',
          'sourceName',
          '--source-name',
          'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
          '--threshold',
          '1'
        ],
        temp.dbPath
      );

      for (const result of [invalidThreshold, invalidSourceName]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatch(/^error: /);
        expect(containsPrivacySentinel(result)).toBe(false);
        expect(result.stderr).not.toContain('Error:');
      }
    } finally {
      temp.cleanup();
    }
  });

  it('includes parseable budget warnings in summary JSON without stderr contamination', async () => {
    const temp = createTempDb();
    try {
      await runCli(['budget', 'set', '--scope', 'monthly_total', '--threshold', '1'], temp.dbPath);
      db = openDatabase(temp.dbPath);
      new UsageEventsRepository(db).insertMany([
        createKnownCostEvent('known-current-month', 1.5, 120),
        createUnknownCostEvent('unknown-current-month', 40)
      ]);
      db.close();
      db = undefined;

      const result = await runCli(['summary', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        budgets: Array<{
          scopeKind: string;
          knownSpendUsd: number;
          thresholdUsd: number;
          status: string;
          unknownCostEventCount: number;
          warningRows: Array<{ code: string }>;
        }>;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload.budgets[0]).toMatchObject({
        scopeKind: 'monthly_total',
        knownSpendUsd: 1.5,
        thresholdUsd: 1,
        status: 'over',
        unknownCostEventCount: 1
      });
      expect(payload.budgets[0].warningRows.map((row) => row.code)).toEqual([
        'budget_threshold_exceeded',
        'budget_unknown_cost_present'
      ]);
      expect(containsPrivacySentinel(payload)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });
});

async function runCli(args: string[], dbPath: string): Promise<CliResult> {
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

function createKnownCostEvent(rawIdHash: string, estimatedCostUsd: number, totalTokens: number) {
  return createTestEvent({
    timestamp: new Date().toISOString(),
    rawIdHash,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens,
    estimatedCostUsd
  });
}

function createUnknownCostEvent(rawIdHash: string, totalTokens: number) {
  return {
    ...createKnownCostEvent(rawIdHash, 1, totalTokens),
    estimatedCostUsd: null
  };
}
