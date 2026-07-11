import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';
import { assertCliOutputPrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';

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
  it('prints deterministic budget status text when no thresholds are configured', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(['budget', 'status'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('Budget status');
      expect(result.stdout).toContain('No budget thresholds set');
      expect(result.stdout).toContain('privacy: sanitized');
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('prints budget status JSON when no thresholds are configured', async () => {
    const temp = createTempDb();
    try {
      const result = await runCli(['budget', 'status', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        kind: string;
        rows: unknown[];
        summary: { total: number };
        privacy: { sanitized: boolean };
      };

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload).toMatchObject({
        kind: 'budget_status',
        rows: [],
        summary: { total: 0 },
        privacy: { sanitized: true }
      });
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('prints threshold budget status text with progress and unknown cost counts', async () => {
    const temp = createTempDb();
    try {
      await runCli(['budget', 'set', '--scope', 'monthly_total', '--threshold', '2'], temp.dbPath);
      await runCli(
        ['budget', 'set', '--scope', 'sourceName', '--source-name', 'lab-a100', '--threshold', '1'],
        temp.dbPath
      );
      db = openDatabase(temp.dbPath);
      new UsageEventsRepository(db).insertMany([
        createKnownCostEvent('budget-status-known-total', 1, 100),
        createKnownCostEvent('budget-status-known-source', 1.25, 120, 'lab-a100'),
        createUnknownCostEvent('budget-status-unknown-source', 80, 'lab-a100')
      ]);
      db.close();
      db = undefined;

      const result = await runCli(['budget', 'status'], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('scope');
      expect(result.stdout).toContain('sourceName');
      expect(result.stdout).toContain('known spend');
      expect(result.stdout).toContain('threshold');
      expect(result.stdout).toContain('progress');
      expect(result.stdout).toContain('percent');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('unknown events');
      expect(result.stdout).toContain('monthly_total');
      expect(result.stdout).toContain('all');
      expect(result.stdout).toContain('$1.00');
      expect(result.stdout).toContain('$2.00');
      expect(result.stdout).toContain('112.5%');
      expect(result.stdout).toContain('lab-a100');
      expect(result.stdout).toContain('exceeded');
      expect(result.stdout).toContain('1');
      assertCliOutputPrivacy(result);
    } finally {
      if (db?.open) db.close();
      db = undefined;
      temp.cleanup();
    }
  });

  it('prints threshold budget status JSON from the shared status service', async () => {
    const temp = createTempDb();
    try {
      await runCli(['budget', 'set', '--scope', 'monthly_total', '--threshold', '1'], temp.dbPath);
      db = openDatabase(temp.dbPath);
      new UsageEventsRepository(db).insertMany([
        createKnownCostEvent('budget-status-json-known', 0.8, 100),
        createUnknownCostEvent('budget-status-json-unknown', 50)
      ]);
      db.close();
      db = undefined;

      const result = await runCli(['budget', 'status', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        kind: string;
        rows: Array<{
          scopeKind: string;
          sourceName: string | null;
          status: string;
          knownSpendUsd: number;
          thresholdUsd: number;
          percent: number | null;
          progress: { label: string };
          unknownCostEvents: number;
        }>;
        privacy: { sanitized: boolean };
      };

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(payload.kind).toBe('budget_status');
      expect(payload.privacy.sanitized).toBe(true);
      expect(payload.rows).toEqual([
        expect.objectContaining({
          scopeKind: 'monthly_total',
          sourceName: null,
          status: 'unknown',
          knownSpendUsd: 0.8,
          thresholdUsd: 1,
          percent: 80,
          progress: expect.objectContaining({ label: '80% + unknown cost' }),
          unknownCostEvents: 1
        })
      ]);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      if (db?.open) db.close();
      db = undefined;
      temp.cleanup();
    }
  });

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
      const invalidStatusOption = await runCli(
        ['budget', 'status', '--source-name', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      for (const result of [invalidThreshold, invalidSourceName, invalidStatusOption]) {
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

function createKnownCostEvent(
  rawIdHash: string,
  estimatedCostUsd: number,
  totalTokens: number,
  sourceName = 'local'
) {
  return createTestEvent({
    timestamp: new Date().toISOString(),
    rawIdHash,
    sourceName,
    inputTokens: totalTokens,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens,
    estimatedCostUsd
  });
}

function createUnknownCostEvent(rawIdHash: string, totalTokens: number, sourceName = 'local') {
  return {
    ...createKnownCostEvent(rawIdHash, 1, totalTokens, sourceName),
    estimatedCostUsd: null
  };
}
