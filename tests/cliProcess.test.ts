import Database from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/client.js';
import { schemaSql } from '../src/db/schema.js';
import { ConfigRepository } from '../src/db/repositories/config.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { ConfigService } from '../src/services/configService.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

function runCli(args: string[], dbPath: string, extraEnv: Record<string, string> = {}) {
  return spawnSync('corepack', ['pnpm', 'exec', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, TOKENWATCH_DB_PATH: dbPath, ...extraEnv },
    encoding: 'utf8'
  });
}

function runPnpmDev(args: string[], dbPath: string) {
  return spawnSync('corepack', ['pnpm', 'dev', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, TOKENWATCH_DB_PATH: dbPath },
    encoding: 'utf8'
  });
}

function runCliWithInput(args: string[], dbPath: string, input: string) {
  return spawnSync('corepack', ['pnpm', 'exec', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, TOKENWATCH_DB_PATH: dbPath },
    input,
    encoding: 'utf8'
  });
}

describe('CLI process error boundary', () => {
  it('resolves TUI settings defaults and runtime overrides', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      const config = new ConfigService(new ConfigRepository(db));

      expect(config.getAll()).toMatchObject({
        tui_theme: 'blue',
        tui_auto_refresh_enabled: 'false',
        tui_auto_refresh_ms: '60000'
      });
      expect(config.getTuiSettings()).toEqual({
        theme: 'blue',
        autoRefreshEnabled: false,
        autoRefreshMs: 60000
      });
      expect(config.resolveTuiSettings({ theme: 'green', refresh: '120000' })).toEqual({
        theme: 'green',
        autoRefreshEnabled: true,
        autoRefreshMs: 120000
      });
      expect(config.resolveTuiSettings({ theme: 'amber', refresh: 'off' })).toEqual({
        theme: 'amber',
        autoRefreshEnabled: false,
        autoRefreshMs: 60000
      });
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('sanitizes invalid TUI theme and refresh options', () => {
    const temp = createTempDb();
    try {
      const invalidTheme = runCli(['tui', '--theme', 'PROMPT_SENTINEL_DO_NOT_LEAK'], temp.dbPath);
      const invalidRefresh = runCli(
        ['tui', '--refresh', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      for (const result of [invalidTheme, invalidRefresh]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: validation_failed\n');
        expect(containsPrivacySentinel(result.stderr)).toBe(false);
        expect(result.stderr).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
        expect(result.stderr).not.toContain('RAW_PATH_SENTINEL_DO_NOT_LEAK');
      }
    } finally {
      temp.cleanup();
    }
  });

  it('shows TUI theme and refresh options in help', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['tui', '--help'], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('--theme <theme>');
      expect(result.stdout).toContain('--refresh <ms|off>');
      expect(containsPrivacySentinel(result.stdout)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('runs budget set/list/unset through the process boundary', () => {
    const temp = createTempDb();
    try {
      const set = runCli(
        ['budget', 'set', '--scope', 'monthly_total', '--threshold', '8'],
        temp.dbPath
      );
      const list = runCli(['budget', 'list', '--json'], temp.dbPath);
      const unset = runCli(['budget', 'unset', '--scope', 'monthly_total'], temp.dbPath);
      const payload = JSON.parse(list.stdout) as Array<{ scopeKind: string; thresholdUsd: number }>;

      expect(set.status).toBe(0);
      expect(set.stderr).toBe('');
      expect(payload).toEqual([
        expect.objectContaining({ scopeKind: 'monthly_total', thresholdUsd: 8 })
      ]);
      expect(unset.status).toBe(0);
      expect(unset.stderr).toBe('');
      expect(containsPrivacySentinel([set.stdout, list.stdout, unset.stdout])).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('exports and imports pricing lookup cache through the CLI process boundary', () => {
    const source = createTempDb();
    const target = createTempDb();
    const db = openDatabase(source.dbPath);
    try {
      const usageRepo = new UsageEventsRepository(db);
      const pricingRepo = new PricingModelsRepository(db);
      const event = createTestEvent({ id: 'cli-cache-event-0001' });
      usageRepo.insert(event);
      pricingRepo.setLookupCache({
        cacheKey: 'cli:openai:gpt-5.5',
        provider: 'openai',
        model: 'gpt-5.5',
        matchedSource: 'litellm',
        matchedKey: 'litellm:openai:gpt-5.5',
        confidence: 'exact',
        inputPricePerMillion: 1,
        outputPricePerMillion: 2,
        cachedInputPricePerMillion: 0.5,
        fetchedAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:01.000Z'
      });
      pricingRepo.setLookupCache({
        cacheKey: 'cli:unknown:none',
        provider: 'unknown-provider',
        model: 'none',
        matchedSource: 'unknown',
        confidence: 'none',
        fetchedAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:02.000Z',
        noMatch: true
      });
      db.close();

      const exportPath = join(source.dir, 'cli-cache-export.json');
      const exported = runCli(['export', '--out', exportPath], source.dbPath);
      const exportedPayload = JSON.parse(readFileSync(exportPath, 'utf8')) as {
        pricingLookupCache?: unknown[];
      };
      const imported = runCli(['import', exportPath], target.dbPath);

      expect(exported.status).toBe(0);
      expect(exported.stderr).toBe('');
      expect(exportedPayload.pricingLookupCache).toHaveLength(2);
      expect(containsPrivacySentinel(exportedPayload)).toBe(false);
      expect(imported.status).toBe(0);
      expect(imported.stderr).toBe('');
      expect(imported.stdout).toContain('Inserted: 1');
      expect(imported.stdout).toContain('Rejected: 0');

      const importedDb = openDatabase(target.dbPath);
      try {
        const importedPricing = new PricingModelsRepository(importedDb);
        expect(importedPricing.getLookupCache('cli:openai:gpt-5.5')).toMatchObject({
          cacheKey: 'cli:openai:gpt-5.5',
          matchedSource: 'litellm',
          noMatch: false
        });
        expect(importedPricing.getLookupCache('cli:unknown:none')).toMatchObject({
          cacheKey: 'cli:unknown:none',
          matchedSource: 'unknown',
          noMatch: true
        });
      } finally {
        importedDb.close();
      }
    } finally {
      if (db.open) db.close();
      source.cleanup();
      target.cleanup();
    }
  });

  it('keeps JSON stdout pure for summary --json', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['summary', '--json'], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    } finally {
      temp.cleanup();
    }
  });

  it('normalizes pnpm dev standalone separator before parsing graph arguments', () => {
    const temp = createTempDb();
    try {
      const result = runPnpmDev(['--', 'graph', '--json'], temp.dbPath);
      const jsonStart = result.stdout.indexOf('{');

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(jsonStart).toBeGreaterThanOrEqual(0);
      const payload = JSON.parse(result.stdout.slice(jsonStart)) as {
        kind: string;
        series: unknown[];
      };
      expect(payload).toMatchObject({ kind: 'graph', series: [] });
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('ingests explicit headless Codex file and stdin payloads across the CLI process boundary', () => {
    const temp = createTempDb();
    try {
      const filePayload = {
        id: 'cli-process-file',
        timestamp: '2026-06-05T00:00:00.000Z',
        provider: 'openai',
        model: 'gpt-5.5-fast',
        inputTokens: 10,
        outputTokens: 5,
        sessionId: 'cli-process-session-file'
      };
      const stdinPayload = {
        id: 'cli-process-stdin',
        timestamp: '2026-06-05T00:01:00.000Z',
        provider: 'openai',
        model: 'gpt-5.5-fast',
        inputTokens: 20,
        outputTokens: 7,
        agent: 'codex-cli'
      };
      const payloadPath = join(temp.dir, 'headless-codex-cli.json');
      writeFileSync(payloadPath, JSON.stringify(filePayload), 'utf8');

      const fileResult = runCli(
        ['headless', 'codex', '--input', payloadPath, '--source-name', 'cli-file', '--json'],
        temp.dbPath
      );
      const stdinResult = runCliWithInput(
        ['headless', 'codex', '--input', '-', '--source-name', 'cli-stdin', '--json'],
        temp.dbPath,
        JSON.stringify(stdinPayload)
      );

      expect(fileResult.status).toBe(0);
      expect(stdinResult.status).toBe(0);
      expect(JSON.parse(fileResult.stdout)).toMatchObject({ inserted: 1, rejected: 0 });
      expect(JSON.parse(stdinResult.stdout)).toMatchObject({ inserted: 1, rejected: 0 });

      const db = openDatabase(temp.dbPath);
      try {
        const events = new UsageEventsRepository(db).listAll();
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.sourceName).sort()).toEqual(['cli-file', 'cli-stdin']);
        expect(events.every((event) => event.source === 'codex')).toBe(true);
        expect(events.every((event) => event.rawSource === 'headless-codex')).toBe(true);
        expect(containsPrivacySentinel([events, fileResult.stdout, stdinResult.stdout])).toBe(
          false
        );
      } finally {
        db.close();
      }
    } finally {
      temp.cleanup();
    }
  });

  it('reports provider usage as not configured from env-only live credentials', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['usage', '--provider', 'openai', '--json'], temp.dbPath, {
        OPENAI_API_KEY: ''
      });
      const payload = JSON.parse(result.stdout) as {
        provider: string;
        status: string;
        httpStatus: number | null;
        quota: string;
        rateLimit: string;
        source: string;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toMatchObject({
        provider: 'openai',
        status: 'not_configured',
        httpStatus: null,
        quota: 'unknown',
        rateLimit: 'unknown',
        source: 'env-only-live'
      });
      expect(containsPrivacySentinel(payload)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid provider usage options', () => {
    const temp = createTempDb();
    try {
      const result = runCli(
        ['usage', '--provider', 'PROMPT_SENTINEL_DO_NOT_LEAK', '--json'],
        temp.dbPath
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_provider\n');
      expect(containsPrivacySentinel(result.stderr)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('continues summary with a sanitized pricing warning when always-on lookup fails', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insert(
        createTestEvent({
          model: 'network-fallback-model',
          rawIdHash: 'network-fallback-row',
          estimatedCostUsd: null,
          pricingSource: 'unknown',
          pricingConfidence: 'none',
          normalizedModel: 'network-fallback-model'
        })
      );
      db.close();

      const result = runCli(['summary', '--json'], temp.dbPath, {
        TOKENWATCH_TEST_PRICING_LOOKUP: 'fail'
      });
      const payload = JSON.parse(result.stdout) as {
        pricingDiagnostics: Array<{ key: string; diagnosticStatus: string; cacheStatus: string }>;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('warning: pricing_lookup_unavailable');
      expect(payload.pricingDiagnostics).toEqual([
        expect.objectContaining({
          key: 'network-fallback-model',
          diagnosticStatus: 'network-fallback',
          cacheStatus: 'network-fallback'
        })
      ]);
      expect(containsPrivacySentinel([result.stdout, result.stderr])).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('keeps JSON stdout pure for empty sessionInterval summaries', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['summary', '--group-by', 'sessionInterval', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        groupBy: string;
        groups: unknown[];
        sessionIntervals: unknown[];
        metrics: {
          sessionCount: number;
          totalWallDurationMs: number;
          totalActiveDurationMs: number;
          longestSessionMs: number;
          longestContinuousMs: number;
          maxConcurrentSessions: number;
          eventsWithoutSession: number;
        };
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toEqual({
        groupBy: 'sessionInterval',
        groups: [],
        sessionIntervals: [],
        metrics: {
          sessionCount: 0,
          totalWallDurationMs: 0,
          totalActiveDurationMs: 0,
          longestSessionMs: 0,
          longestContinuousMs: 0,
          maxConcurrentSessions: 0,
          eventsWithoutSession: 0
        }
      });
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('emits month groups for summary --group-by month --json', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({ timestamp: '2026-05-30T00:00:00.000Z', rawIdHash: 'may-row' }),
        createTestEvent({
          timestamp: '2026-06-01T00:00:00.000Z',
          rawIdHash: 'june-row',
          totalTokens: 240
        })
      ]);
      db.close();

      const result = runCli(['summary', '--group-by', 'month', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        groupBy: string;
        groups: Array<{ key: string; events: number; totalTokens: number }>;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload.groupBy).toBe('month');
      expect(payload.groups.map((group) => group.key).sort()).toEqual(['2026-05', '2026-06']);
      expect(payload.groups.reduce((total, group) => total + group.events, 0)).toBe(2);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('exposes sanitized pricing diagnostics in summary JSON and text output', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          provider: 'openai',
          model: 'unknown-fixture-model',
          rawIdHash: 'unknown-pricing-row',
          estimatedCostUsd: null,
          pricingSource: 'unknown',
          pricingConfidence: 'none',
          normalizedProvider: 'openai',
          normalizedModel: 'unknown-fixture-model'
        }),
        createTestEvent({
          provider: 'anthropic',
          model: 'claude-opus-4-6-thinking-high',
          rawIdHash: 'fuzzy-cli-row',
          estimatedCostUsd: 0.04,
          pricingSource: 'litellm',
          pricingConfidence: 'fuzzy',
          normalizedProvider: 'anthropic',
          normalizedModel: 'claude-opus-4-6'
        })
      ]);
      const pricingRepo = new PricingModelsRepository(db);
      pricingRepo.setLookupCache({
        cacheKey: 'lookup:openai:unknown-fixture-model',
        provider: 'openai',
        model: 'unknown-fixture-model',
        matchedSource: 'unknown',
        confidence: 'none',
        fetchedAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:00.000Z',
        noMatch: true
      });
      pricingRepo.setLookupCache({
        cacheKey: 'lookup:anthropic:claude-opus-4-6-thinking-high',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        matchedSource: 'litellm',
        matchedKey: 'litellm:anthropic:claude-opus-4-6',
        confidence: 'fuzzy',
        inputPricePerMillion: 15,
        outputPricePerMillion: 75,
        fetchedAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:00.000Z'
      });
      db.close();

      const json = runCli(['summary', '--json'], temp.dbPath);
      const text = runCli(['summary'], temp.dbPath);
      const payload = JSON.parse(json.stdout) as {
        pricingDiagnostics: Array<{
          key: string;
          pricingSource: string;
          pricingConfidence: string;
          matchedKey: string | null;
          cacheStatus: string;
          diagnosticStatus: string;
          recommendedAction: string;
        }>;
      };

      expect(json.status).toBe(0);
      expect(json.stderr).toBe('');
      expect(payload.pricingDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'unknown-fixture-model',
            pricingSource: 'unknown',
            pricingConfidence: 'none',
            matchedKey: null,
            cacheStatus: 'negative-cache',
            diagnosticStatus: 'negative-cache',
            recommendedAction: 'add custom price'
          }),
          expect.objectContaining({
            key: 'claude-opus-4-6-thinking-high',
            pricingSource: 'litellm',
            pricingConfidence: 'fuzzy',
            matchedKey: 'litellm:anthropic:claude-opus-4-6',
            cacheStatus: 'matched-cache',
            diagnosticStatus: 'fuzzy-match',
            recommendedAction: 'confirm fuzzy match'
          })
        ])
      );
      expect(text.status).toBe(0);
      expect(text.stderr).toBe('');
      expect(text.stdout).toContain('Pricing diagnostics');
      expect(text.stdout).toContain('negative-cache');
      expect(text.stdout).toContain('fuzzy-match');
      expect(text.stdout).toContain('litellm:anthropic:claude-opus-4-6');
      expect(containsPrivacySentinel([json.stdout, json.stderr, text.stdout, text.stderr])).toBe(
        false
      );
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('renders budget warnings in text summary without non-zero exit status', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: new Date().toISOString(),
          rawIdHash: 'budget-known-row',
          estimatedCostUsd: 2
        }),
        {
          ...createTestEvent({
            timestamp: new Date().toISOString(),
            rawIdHash: 'budget-unknown-row',
            totalTokens: 50
          }),
          estimatedCostUsd: null
        }
      ]);
      db.close();

      const set = runCli(
        ['budget', 'set', '--scope', 'monthly_total', '--threshold', '1'],
        temp.dbPath
      );
      const summary = runCli(['summary'], temp.dbPath);

      expect(set.status).toBe(0);
      expect(summary.status).toBe(0);
      expect(summary.stderr).toBe('');
      expect(summary.stdout).toContain('Budget warnings');
      expect(summary.stdout).toContain('budget_threshold_exceeded');
      expect(containsPrivacySentinel(summary.stdout)).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('emits hashed session groups and metrics for summary --group-by session --json', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new ConfigRepository(db).set('session_idle_gap_ms', '59999');
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'session-row-1'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:01:00.000Z',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'session-row-2'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:02:00.000Z',
          sessionIdHash: null,
          rawIdHash: 'missing-session-row'
        })
      ]);
      db.close();

      const result = runCli(['summary', '--group-by', 'session', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        groupBy: string;
        groups: Array<{
          key: string;
          events: number;
          startedAt: string;
          lastSeen: string;
          activeDurationMs: number;
        }>;
        metrics: {
          sessionCount: number;
          totalWallDurationMs: number;
          totalActiveDurationMs: number;
          longestContinuousMs: number;
          maxConcurrentSessions: number;
          eventsWithoutSession: number;
        };
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload.groupBy).toBe('session');
      expect(payload.groups).toHaveLength(1);
      expect(payload.groups[0]).toMatchObject({
        key: 'hash-alpha',
        events: 2,
        startedAt: '2026-05-30T00:00:00.000Z',
        lastSeen: '2026-05-30T00:01:00.000Z',
        activeDurationMs: 0
      });
      expect(payload.metrics).toMatchObject({
        sessionCount: 1,
        totalWallDurationMs: 60_000,
        totalActiveDurationMs: 0,
        longestContinuousMs: 0,
        maxConcurrentSessions: 1,
        eventsWithoutSession: 1
      });
      expect(containsPrivacySentinel(payload)).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('emits stable session interval metrics in summary --json without privacy leaks', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          source: 'codex',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'session-json-row-1',
          metadata: {
            parser: 'test',
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            rawSession: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
            rawWorkspace: 'RAW_WORKSPACE_SENTINEL_DO_NOT_LEAK'
          }
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:01:00.000Z',
          source: 'codex',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'session-json-row-2'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:00:30.000Z',
          source: 'opencode',
          sessionIdHash: 'hash-beta',
          rawIdHash: 'session-json-row-3'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:01:30.000Z',
          source: 'opencode',
          sessionIdHash: 'hash-beta',
          rawIdHash: 'session-json-row-4'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:02:00.000Z',
          sessionIdHash: null,
          rawIdHash: 'no-session-json-row',
          metadata: { response: 'RESPONSE_SENTINEL_DO_NOT_LEAK' }
        })
      ]);
      db.close();

      const result = runCli(['summary', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        maxConcurrentSessions: number;
        longestContinuousMs: number;
        totalActiveDurationMs: number;
        totalWallDurationMs: number;
        sessionIntervals: Array<{ sessionIdHash: string; source: string }>;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toMatchObject({
        maxConcurrentSessions: 2,
        longestContinuousMs: 90_000,
        totalActiveDurationMs: 120_000,
        totalWallDurationMs: 120_000
      });
      expect(payload.sessionIntervals).toHaveLength(2);
      expect(payload.sessionIntervals.map((row) => row.sessionIdHash).sort()).toEqual([
        'hash-alpha',
        'hash-beta'
      ]);
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('emits sanitized JSON rows for summary --group-by sessionInterval --json', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          sessionIdHash: 'hash-alpha',
          messageCount: 2,
          rawIdHash: 'interval-json-row-1',
          metadata: { apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK' }
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:01:00.000Z',
          sessionIdHash: 'hash-alpha',
          messageCount: 3,
          rawIdHash: 'interval-json-row-2'
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:02:00.000Z',
          sessionIdHash: null,
          rawIdHash: 'interval-json-no-session'
        })
      ]);
      db.close();

      const result = runCli(['summary', '--group-by', 'sessionInterval', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        groupBy: string;
        groups: Array<{ sessionIdHash: string; messageCount: number; activeDurationMs: number }>;
        sessionIntervals: Array<{ sessionIdHash: string }>;
        metrics: { eventsWithoutSession: number; longestContinuousMs: number };
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload.groupBy).toBe('sessionInterval');
      expect(payload.groups).toHaveLength(1);
      expect(payload.groups).toEqual(payload.sessionIntervals);
      expect(payload.groups[0]).toMatchObject({
        sessionIdHash: 'hash-alpha',
        messageCount: 5,
        activeDurationMs: 60_000
      });
      expect(payload.metrics).toMatchObject({
        eventsWithoutSession: 1,
        longestContinuousMs: 60_000
      });
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('renders sanitized text rows for summary --group-by sessionInterval', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          source: 'codex',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'interval-text-row-1',
          metadata: { credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK' }
        }),
        createTestEvent({
          timestamp: '2026-05-30T00:01:00.000Z',
          source: 'codex',
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'interval-text-row-2'
        })
      ]);
      db.close();

      const result = runCli(['summary', '--group-by', 'sessionInterval'], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('source');
      expect(result.stdout).toContain('session');
      expect(result.stdout).toContain('messages');
      expect(result.stdout).toContain('active ms');
      expect(result.stdout).toContain('wall ms');
      expect(result.stdout).toContain('hash-alpha');
      expect(result.stdout).toContain('codex');
      expect(result.stdout).toContain('60,000');
      expect(containsPrivacySentinel([result.stdout, result.stderr])).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('keeps session interval privacy sentinels out of export command output', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          sessionIdHash: 'hash-alpha',
          rawIdHash: 'export-row',
          metadata: {
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        })
      ]);
      db.close();

      const outPath = join(temp.dir, 'tokenwatch-export.json');
      const result = runCli(['export', '--out', outPath], temp.dbPath);
      const exportPayload = readFileSync(outPath, 'utf8');

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(containsPrivacySentinel([result.stdout, result.stderr, exportPayload])).toBe(false);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('prints graph JSON by default and writes PNG from the CLI process boundary', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    const pngPath = join('/tmp', `tokenwatch-graph-${process.pid}-cli-process.png`);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          rawIdHash: 'graph-cli-row-1',
          totalTokens: 140,
          metadata: { prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
        }),
        createTestEvent({
          timestamp: '2026-05-31T00:00:00.000Z',
          rawIdHash: 'graph-cli-row-2',
          totalTokens: 240,
          metadata: { rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        })
      ]);
      db.close();

      const json = runCli(['graph', '--bucket', 'day', '--metric', 'tokens'], temp.dbPath);
      const jsonAndPng = runCli(
        ['graph', '--bucket', 'day', '--metric', 'tokens', '--json', '--out', pngPath],
        temp.dbPath
      );
      const pngOnly = runCli(['graph', '--out', pngPath], temp.dbPath);
      const payload = JSON.parse(json.stdout) as {
        kind: string;
        bucket: string;
        metric: string;
        totals: { events: number; tokens: number };
        series: Array<{ key: string; tokens: number }>;
      };
      const combinedPayload = JSON.parse(jsonAndPng.stdout) as { series: unknown[] };
      const png = readFileSync(pngPath);

      expect(json.status).toBe(0);
      expect(json.stderr).toBe('');
      expect(payload).toMatchObject({
        kind: 'graph',
        bucket: 'day',
        metric: 'tokens',
        totals: { events: 2, tokens: 380 },
        series: [
          { key: '2026-05-30', tokens: 140 },
          { key: '2026-05-31', tokens: 240 }
        ]
      });
      expect(json.stdout).not.toContain('points');
      expect(jsonAndPng.status).toBe(0);
      expect(jsonAndPng.stderr).toBe('');
      expect(combinedPayload.series).toEqual(payload.series);
      expect(pngOnly.status).toBe(0);
      expect(pngOnly.stdout).toBe(`Wrote graph PNG: ${pngPath}\n`);
      expect(pngOnly.stderr).toBe('');
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(
        containsPrivacySentinel([json.stdout, json.stderr, jsonAndPng.stdout, pngOnly.stdout])
      ).toBe(false);
    } finally {
      if (db.open) db.close();
      rmSync(pngPath, { force: true });
      temp.cleanup();
    }
  });

  it('writes an empty graph PNG to normal absolute and relative output paths', () => {
    const temp = createTempDb();
    const absolutePngPath = join('/tmp', `tokenwatch-task-4-empty-${process.pid}.png`);
    const relativePngPath = `tokenwatch-task-4-debug-${process.pid}.png`;
    try {
      const json = runCli(
        ['graph', '--bucket', 'day', '--metric', 'tokens', '--json'],
        temp.dbPath
      );
      const absolutePng = runCli(
        ['graph', '--bucket', 'day', '--metric', 'tokens', '--out', absolutePngPath],
        temp.dbPath
      );
      const relativePng = runCli(['graph', '--out', relativePngPath], temp.dbPath);
      const payload = JSON.parse(json.stdout) as { series: unknown[]; totals: { events: number } };
      const absoluteBytes = readFileSync(absolutePngPath);
      const relativeBytes = readFileSync(relativePngPath);

      expect(json.status).toBe(0);
      expect(json.stderr).toBe('');
      expect(payload).toMatchObject({ series: [], totals: { events: 0 } });
      expect(absolutePng.status).toBe(0);
      expect(absolutePng.stdout).toBe(`Wrote graph PNG: ${absolutePngPath}\n`);
      expect(absolutePng.stderr).toBe('');
      expect(relativePng.status).toBe(0);
      expect(relativePng.stdout).toBe(`Wrote graph PNG: ${relativePngPath}\n`);
      expect(relativePng.stderr).toBe('');
      for (const bytes of [absoluteBytes, relativeBytes]) {
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
      }
      expect(containsPrivacySentinel([json.stdout, absolutePng.stdout, relativePng.stdout])).toBe(
        false
      );
    } finally {
      rmSync(absolutePngPath, { force: true });
      rmSync(relativePngPath, { force: true });
      temp.cleanup();
    }
  });

  it('prints wrapped JSON by default and supports explicit JSON with PNG output', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    const pngPath = join('/tmp', `tokenwatch-wrapped-${process.pid}-cli-process.png`);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          timestamp: '2026-01-15T00:00:00.000Z',
          rawIdHash: 'wrapped-cli-row-1',
          sessionIdHash: 'wrapped-session-a',
          model: 'gpt-5.5-fast',
          inputTokens: 100,
          outputTokens: 40,
          totalTokens: 140,
          metadata: { prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
        }),
        createTestEvent({
          timestamp: '2026-02-15T00:00:00.000Z',
          rawIdHash: 'wrapped-cli-row-2',
          sessionIdHash: 'wrapped-session-b',
          model: 'gpt-5.5-fast',
          inputTokens: 200,
          outputTokens: 40,
          totalTokens: 240,
          metadata: { rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        }),
        createTestEvent({
          timestamp: '2025-12-31T23:59:59.999Z',
          rawIdHash: 'wrapped-cli-outside-year',
          sessionIdHash: 'wrapped-session-outside',
          totalTokens: 999
        })
      ]);
      db.close();

      const json = runCli(['wrapped', '--year', '2026'], temp.dbPath);
      const jsonAndPng = runCli(
        ['wrapped', '--year', '2026', '--json', '--out', pngPath],
        temp.dbPath
      );
      const payload = JSON.parse(json.stdout) as {
        kind: string;
        year: number;
        totals: { events: number; tokens: number };
        monthly: Array<{ key: string; tokens: number }>;
        topModels: Array<{ key: string; tokens: number }>;
      };
      const combinedPayload = JSON.parse(jsonAndPng.stdout) as {
        monthly: unknown[];
        topModels: unknown[];
      };
      const png = readFileSync(pngPath);

      expect(json.status).toBe(0);
      expect(json.stderr).toBe('');
      expect(payload).toMatchObject({
        kind: 'wrapped',
        year: 2026,
        totals: { events: 2, tokens: 380 },
        monthly: [
          { key: '2026-01', tokens: 140 },
          { key: '2026-02', tokens: 240 }
        ],
        topModels: [{ key: 'gpt-5.5-fast', tokens: 380 }]
      });
      expect(jsonAndPng.status).toBe(0);
      expect(jsonAndPng.stderr).toBe('');
      expect(combinedPayload.monthly).toEqual(payload.monthly);
      expect(combinedPayload.topModels).toEqual(payload.topModels);
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(containsPrivacySentinel([json.stdout, json.stderr, jsonAndPng.stdout])).toBe(false);
    } finally {
      if (db.open) db.close();
      rmSync(pngPath, { force: true });
      temp.cleanup();
    }
  });

  it('writes wrapped PNG-only output with concise stdout', () => {
    const temp = createTempDb();
    const pngPath = join('/tmp', `tokenwatch-wrapped-${process.pid}-png-only.png`);
    try {
      const result = runCli(['wrapped', '--year', '2026', '--out', pngPath], temp.dbPath);
      const png = readFileSync(pngPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`Wrote wrapped PNG: ${pngPath}\n`);
      expect(result.stderr).toBe('');
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(containsPrivacySentinel([result.stdout, result.stderr])).toBe(false);
    } finally {
      rmSync(pngPath, { force: true });
      temp.cleanup();
    }
  });

  it('sanitizes invalid wrapped years and output paths', () => {
    const temp = createTempDb();
    const directoryOut = join('/tmp', `tokenwatch-wrapped-${process.pid}-dir.png`);
    try {
      mkdirSync(directoryOut);
      const nonNumericYear = runCli(['wrapped', '--year', 'not-a-year'], temp.dbPath);
      const outOfRangeYear = runCli(['wrapped', '--year', '1999'], temp.dbPath);
      const invalidOut = runCli(
        ['wrapped', '--year', '2026', '--out', 'RAW_PATH_SENTINEL_DO_NOT_LEAK.png'],
        temp.dbPath
      );
      const invalidExtension = runCli(
        ['wrapped', '--year', '2026', '--out', 'tokenwatch-wrapped.txt'],
        temp.dbPath
      );
      const invalidDirectory = runCli(
        ['wrapped', '--year', '2026', '--out', directoryOut],
        temp.dbPath
      );

      for (const result of [nonNumericYear, outOfRangeYear]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: invalid_wrapped_year\n');
      }
      for (const result of [invalidOut, invalidExtension, invalidDirectory]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: invalid_output_path\n');
      }
      expect(
        containsPrivacySentinel([
          nonNumericYear.stderr,
          outOfRangeYear.stderr,
          invalidOut.stderr,
          invalidExtension.stderr,
          invalidDirectory.stderr
        ])
      ).toBe(false);
    } finally {
      rmSync(directoryOut, { recursive: true, force: true });
      temp.cleanup();
    }
  });

  it('sanitizes invalid graph options and output paths', () => {
    const temp = createTempDb();
    const directoryOut = join('/tmp', `tokenwatch-graph-${process.pid}-dir.png`);
    try {
      mkdirSync(directoryOut);
      const invalidBucket = runCli(['graph', '--bucket', 'week'], temp.dbPath);
      const invalidOut = runCli(
        ['graph', '--out', 'RAW_PATH_SENTINEL_DO_NOT_LEAK.png'],
        temp.dbPath
      );
      const invalidExtension = runCli(['graph', '--out', 'tokenwatch-graph.txt'], temp.dbPath);
      const invalidDirectory = runCli(['graph', '--out', directoryOut], temp.dbPath);

      expect(invalidBucket.status).not.toBe(0);
      expect(invalidBucket.stdout).toBe('');
      expect(invalidBucket.stderr).toBe('error: invalid_report_option\n');
      for (const result of [invalidOut, invalidExtension, invalidDirectory]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('error: invalid_output_path\n');
      }
      expect(
        containsPrivacySentinel([
          invalidBucket.stderr,
          invalidOut.stderr,
          invalidExtension.stderr,
          invalidDirectory.stderr
        ])
      ).toBe(false);
    } finally {
      rmSync(directoryOut, { recursive: true, force: true });
      temp.cleanup();
    }
  });

  it('sanitizes invalid group/source/config without raw values', () => {
    const temp = createTempDb();
    try {
      const invalidGroup = 'RAW_PATH_SENTINEL_DO_NOT_LEAK';
      const summary = runCli(['summary', '--group-by', invalidGroup], temp.dbPath);
      const scan = runCli(['scan', '--source', invalidGroup], temp.dbPath);
      const config = runCli(
        ['config', 'set', 'source_name', 'PROMPT_SENTINEL_DO_NOT_LEAK'],
        temp.dbPath
      );

      for (const result of [summary, scan, config]) {
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatch(/^error: /);
        expect(result.stderr).not.toContain(invalidGroup);
        expect(result.stderr).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
        expect(result.stderr).not.toContain('Error:');
      }
    } finally {
      temp.cleanup();
    }
  });

  it('shows every parser key in scan help', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['scan', '--help'], temp.dbPath);
      const expectedSources = [
        'opencode',
        'claude',
        'codex',
        'cursor',
        'gemini',
        'amp',
        'droid',
        'openclaw',
        'pi',
        'kimi',
        'qwen',
        'roocode',
        'kilocode',
        'mux',
        'kilo',
        'crush',
        'hermes',
        'copilot',
        'goose',
        'codebuff',
        'antigravity',
        'zed',
        'kiro',
        'trae'
      ];

      expect(result.status).toBe(0);
      for (const source of expectedSources) expect(result.stdout).toContain(source);
      expect(containsPrivacySentinel(result.stdout)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('accepts unsupported status artifacts with a generic warning', () => {
    const temp = createTempDb();
    try {
      const artifactPath = join(temp.dir, 'usage.json');
      writeFileSync(artifactPath, JSON.stringify({ safe: true }), 'utf8');

      const result = runCli(['scan', '--source', 'trae', '--path', artifactPath], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Scan complete');
      expect(result.stdout).toContain('Discovered files: 1');
      expect(result.stdout).toContain('Parsed events: 0');
      expect(result.stderr).toBe('warning: trae:unsupported_usage_artifact\n');
      expect(result.stdout).not.toContain(artifactPath);
      expect(result.stderr).not.toContain(artifactPath);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes malformed import JSON without raw snippets', () => {
    const temp = createTempDb();
    try {
      const importPath = join(temp.dir, 'invalid-tokenwatch-export.json');
      writeFileSync(importPath, '{"raw":"PROMPT_SENTINEL_DO_NOT_LEAK"', 'utf8');

      const result = runCli(['import', importPath], temp.dbPath);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_import_file\n');
      expect(result.stderr).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
      expect(result.stderr).not.toContain(importPath);
    } finally {
      temp.cleanup();
    }
  });

  it('emits parseable doctor JSON without hostname or raw DB path', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['doctor'], temp.dbPath);
      const report = JSON.parse(result.stdout) as {
        platform: Record<string, string>;
        dbPath: string;
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(report.platform.hostname).toBeUndefined();
      expect(report.dbPath).toBe('custom-db');
      expect(result.stdout).not.toContain(temp.dir);
    } finally {
      temp.cleanup();
    }
  });

  it('marks stale running scans and reports invalid config with bounded doctor JSON', () => {
    const temp = createTempDb();
    try {
      const seeded = new Database(temp.dbPath);
      seeded.exec(schemaSql);
      seeded.prepare('INSERT INTO app_config(key, value) VALUES (?, ?)').run('schemaVersion', '2');
      seeded
        .prepare('INSERT INTO app_config(key, value) VALUES (?, ?)')
        .run('source_name', 'PROMPT_SENTINEL_DO_NOT_LEAK');
      seeded
        .prepare(
          `INSERT INTO scan_runs (
            id, started_at, finished_at, source_name, parser_name, path_kind, status,
            discovered_files, parsed_events, inserted_events, duplicate_events, conflict_events,
            skipped_records, rejected_records, error_records, warning_codes_json, error_code
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, NULL)`
        )
        .run(
          'stale-run',
          '2020-01-01T00:00:00.000Z',
          'lab-a100',
          'codex',
          'default',
          'running',
          '[]'
        );
      seeded.close();

      const result = runCli(['doctor'], temp.dbPath);
      const report = JSON.parse(result.stdout) as {
        sourceNameStatus: string;
        resolvedSourceName: string;
        recentScanRuns: Array<{ status: string; errorCode: string | null; errorRecords: number }>;
      };

      expect(result.status).toBe(0);
      expect(report.sourceNameStatus).toBe('invalid_source_name');
      expect(report.resolvedSourceName).toBe('local');
      expect(report.recentScanRuns[0]).toMatchObject({
        status: 'interrupted',
        errorCode: 'stale_running_interrupted',
        errorRecords: 1
      });
      expect(result.stdout).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
    } finally {
      temp.cleanup();
    }
  });

  it('emits degraded doctor JSON for DB open and migration failures', () => {
    const temp = createTempDb();
    try {
      const openFailure = runCli(['doctor'], temp.dir);
      const openReport = JSON.parse(openFailure.stdout) as { status: string; code: string };

      expect(openFailure.status).not.toBe(0);
      expect(openReport.status).toBe('degraded');
      expect(openReport.code).toBe('db_open_failed');
      expect(openFailure.stdout).not.toContain(temp.dir);

      const future = new Database(temp.dbPath);
      future.exec(`
        CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO app_config(key, value) VALUES ('schemaVersion', '999');
      `);
      future.close();

      const migrationFailure = runCli(['doctor'], temp.dbPath);
      const migrationReport = JSON.parse(migrationFailure.stdout) as {
        status: string;
        code: string;
      };

      expect(migrationFailure.status).not.toBe(0);
      expect(migrationReport.status).toBe('degraded');
      expect(migrationReport.code).toBe('migration_failed');
      expect(migrationFailure.stdout).not.toContain(temp.dbPath);
    } finally {
      temp.cleanup();
    }
  });

  it('emits degraded doctor JSON for simulated native load failure', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['doctor'], temp.dbPath, { TOKENWATCH_TEST_NATIVE_LOAD_FAILURE: '1' });
      const report = JSON.parse(result.stdout) as { status: string; code: string };

      expect(result.status).not.toBe(0);
      expect(result.stderr).toBe('');
      expect(report.status).toBe('degraded');
      expect(report.code).toBe('native_sqlite_unavailable');
      expect(result.stdout).not.toContain(temp.dbPath);
    } finally {
      temp.cleanup();
    }
  });
});
