// allow: SIZE_OK - process regressions intentionally share one spawned CLI harness.
import Database from 'better-sqlite3';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/client.js';
import { schemaSql } from '../src/db/schema.js';
import { ConfigRepository } from '../src/db/repositories/config.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { ConfigService } from '../src/services/configService.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import {
  auditReportSchema,
  heatmapReportSchema,
  watchTickReportSchema
} from '../src/services/reportContracts.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';
import { assertCliOutputPrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';

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

type CliOutput = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

class WatchProcessError extends Error {
  readonly name = 'WatchProcessError';

  constructor(
    readonly code:
      | 'process_timeout'
      | 'sigint_timeout'
      | 'unexpected_extra_line'
      | 'assertion_failure'
  ) {
    super(code);
  }
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

  it('runs budget status JSON through the process boundary', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['budget', 'status', '--json'], temp.dbPath);
      const payload = JSON.parse(result.stdout) as {
        kind: string;
        rows: unknown[];
        summary: { total: number };
        privacy: { sanitized: boolean };
      };

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toMatchObject({
        kind: 'budget_status',
        rows: [],
        summary: { total: 0 },
        privacy: { sanitized: true }
      });
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('runs heatmap JSON through the process boundary', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insert(
        createTestEvent({
          timestamp: '2026-05-30T00:00:00.000Z',
          rawIdHash: 'heatmap-process-row',
          totalTokens: 321,
          metadata: { rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        })
      );
      db.close();

      const result = runCli(['heatmap', '--year', '2026', '--json'], temp.dbPath);
      const payload = heatmapReportSchema.parse(JSON.parse(result.stdout));

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toMatchObject({
        kind: 'heatmap',
        totals: { events: 1, totalTokens: 321 },
        privacy: { sanitized: true }
      });
      expect(payload.days).toHaveLength(365);
      expect(containsPrivacySentinel([result.stdout, result.stderr, payload])).toBe(false);
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy(result);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('runs audit text, windows, and filtered JSON through the process boundary', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    const timestamp = new Date().toISOString();
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          id: 'audit-process-codex-row',
          timestamp,
          source: 'codex',
          sourceName: 'local',
          pricingSource: 'bundled',
          pricingConfidence: 'exact',
          metadata: { rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        }),
        {
          ...createTestEvent({
            id: 'audit-process-opencode-row',
            timestamp,
            source: 'opencode',
            sourceName: 'lab-server',
            pricingSource: 'unknown',
            pricingConfidence: 'unknown',
            sessionIdHash: null
          }),
          estimatedCostUsd: null
        }
      ]);
      new ScanRunsRepository(db).create({
        id: 'audit-process-run',
        startedAt: timestamp,
        finishedAt: timestamp,
        sourceName: 'local',
        parserName: 'codex',
        pathKind: 'default',
        status: 'completed',
        discoveredFiles: 1,
        parsedEvents: 1,
        insertedEvents: 1,
        duplicateEvents: 0,
        conflictEvents: 0,
        skippedRecords: 0,
        rejectedRecords: 0,
        errorRecords: 0,
        warningCodes: [],
        errorCode: null
      });
      db.close();

      const text = runCli(['audit'], temp.dbPath);
      const defaultJson = runCli(['audit', '--json'], temp.dbPath);
      const sevenDays = runCli(['audit', '--window', '7d', '--json'], temp.dbPath);
      const thirtyDays = runCli(['audit', '--window', '30d', '--json'], temp.dbPath);
      const codex = runCli(['audit', '--source', 'codex', '--json'], temp.dbPath);
      const reports = [defaultJson, sevenDays, thirtyDays, codex].map((result) =>
        auditReportSchema.parse(JSON.parse(result.stdout))
      );

      expect(text).toMatchObject({ status: 0, stderr: '' });
      expect(text.stdout).toContain('TokenWatch Audit');
      expect(text.stdout).toContain('source bundled');
      expect(text.stdout).toContain('source unknown');
      expect(text.stdout).toContain('confidence exact');
      expect(text.stdout).toContain('confidence unknown');
      expect(text.stdout).toContain('Codex CLI | codex');
      expect(text.stdout).toContain('discovered files 1');
      expect(text.stdout).toContain('error records 0');
      expect(reports.map((report) => report.window)).toEqual(['7d', '7d', '30d', '7d']);
      expect(reports[3]).toMatchObject({
        filters: { source: ['codex'], sourceName: [] },
        totals: { events: 1 },
        sourceContracts: [expect.objectContaining({ source: 'codex' })]
      });
      for (const [result, report] of [
        [defaultJson, reports[0]],
        [sevenDays, reports[1]],
        [thirtyDays, reports[2]],
        [codex, reports[3]]
      ] as const) {
        expect(result).toMatchObject({ status: 0, stderr: '' });
        expect(result.stdout.trimStart()).toMatch(/^\{/);
        expect(result.stdout.trimEnd()).toMatch(/\}$/);
        assertJsonOutputPrivacy(report);
        assertCliOutputPrivacy(result);
      }
      assertCliOutputPrivacy(text);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  });

  it('sanitizes malformed audit options across the process boundary', () => {
    const temp = createTempDb();
    try {
      const cases = [
        { args: ['audit', '--window', '90d'], error: 'invalid_report_option' },
        {
          args: ['audit', '--source', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
          error: 'unsupported_source'
        },
        {
          args: ['audit', '--source-name', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
          error: 'invalid_source_name'
        }
      ];

      for (const testCase of cases) {
        const result = runCli(testCase.args, temp.dbPath);
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe(`error: ${testCase.error}\n`);
        assertCliOutputPrivacy(result);
      }
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes rejected heatmap output paths across the process boundary', () => {
    const temp = createTempDb();
    try {
      const outputPath = join(temp.dir, 'RAW_PATH_SENTINEL_DO_NOT_LEAK.png');
      const result = runCli(['heatmap', '--out', outputPath], temp.dbPath);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_output_path\n');
      expect(result.stderr).not.toContain(outputPath);
      expect(containsPrivacySentinel([result.stdout, result.stderr])).toBe(false);
      assertCliOutputPrivacy(result);
    } finally {
      temp.cleanup();
    }
  });

  it('returns bounded sanitized heatmap validation errors across the process boundary', () => {
    const temp = createTempDb();
    try {
      const cases = [
        {
          args: ['heatmap', '--year', '9999'],
          stderr: 'error: invalid_report_option\n'
        },
        {
          args: ['heatmap', '--source', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
          stderr: 'error: unsupported_source\n'
        },
        {
          args: ['heatmap', '--metric', 'PROMPT_SENTINEL_DO_NOT_LEAK'],
          stderr: 'error: invalid_report_option\n'
        }
      ] as const;

      for (const testCase of cases) {
        const result = runCli([...testCase.args], temp.dbPath);

        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe(testCase.stderr);
        expect(containsPrivacySentinel([result.stdout, result.stderr])).toBe(false);
        assertCliOutputPrivacy(result);
      }
    } finally {
      temp.cleanup();
    }
  });

  it('writes heatmap files while exposing only safe basenames across the process boundary', () => {
    const temp = createTempDb();
    try {
      const outputs = [
        {
          path: join(temp.dir, 'process-heatmap.json'),
          message: 'Wrote heatmap JSON: process-heatmap.json\n',
          marker: '"kind": "heatmap"'
        },
        {
          path: join(temp.dir, 'process-heatmap.txt'),
          message: 'Wrote heatmap text: process-heatmap.txt\n',
          marker: 'TokenWatch Heatmap'
        },
        {
          path: join(temp.dir, 'process-heatmap.svg'),
          message: 'Wrote heatmap SVG: process-heatmap.svg\n',
          marker: '<svg'
        }
      ] as const;

      for (const output of outputs) {
        const result = runCli(['heatmap', '--year', '2026', '--out', output.path], temp.dbPath);
        const contents = readFileSync(output.path, 'utf8');

        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        expect(result.stdout).toBe(output.message);
        expect(result.stdout).not.toContain(temp.dir);
        expect(contents).toContain(output.marker);
        expect(containsPrivacySentinel([result.stdout, result.stderr, contents])).toBe(false);
        assertCliOutputPrivacy(result);
      }

      const jsonPayload = heatmapReportSchema.parse(
        JSON.parse(readFileSync(join(temp.dir, 'process-heatmap.json'), 'utf8'))
      );
      expect(jsonPayload).toMatchObject({
        kind: 'heatmap',
        year: 2026,
        totals: {
          events: 0,
          totalTokens: 0,
          estimatedCostUsd: null,
          unknownCostEvents: 0
        },
        privacy: { sanitized: true }
      });
      assertJsonOutputPrivacy(jsonPayload);
    } finally {
      temp.cleanup();
    }
  });

  it('streams stateful continuous watch ticks as compact NDJSON and exits cleanly on SIGINT', async () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insert(
        createTestEvent({
          timestamp: new Date(Date.now() - 1_000).toISOString(),
          rawIdHash: 'watch-process-baseline',
          metadata: { rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        })
      );
      db.close();

      const startedAtMs = Date.now();
      const result = await new Promise<
        CliOutput & {
          readonly signal: NodeJS.Signals | null;
          readonly lines: readonly string[];
        }
      >((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            '--import',
            'tsx',
            'src/cli.ts',
            'watch',
            '--interval',
            '5s',
            '--window',
            '10m',
            '--json'
          ],
          {
            cwd: process.cwd(),
            env: { ...process.env, TOKENWATCH_DB_PATH: temp.dbPath }
          }
        );
        const lines: string[] = [];
        let stdout = '';
        let stderr = '';
        let lineBuffer = '';
        let failure: unknown;
        let sigintFallback: ReturnType<typeof setTimeout> | undefined;
        const timeout = setTimeout(() => {
          failure = new WatchProcessError('process_timeout');
          child.kill('SIGKILL');
        }, 15_000);

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          stdout += chunk;
          lineBuffer += chunk;
          let newlineIndex = lineBuffer.indexOf('\n');
          while (newlineIndex >= 0) {
            const line = lineBuffer.slice(0, newlineIndex);
            lineBuffer = lineBuffer.slice(newlineIndex + 1);
            lines.push(line);
            try {
              expect(line).toBe(JSON.stringify(JSON.parse(line)));
              const tick = watchTickReportSchema.parse(JSON.parse(line));
              if (lines.length === 1) {
                expect(Date.now() - startedAtMs).toBeLessThan(5_000);
                expect(tick.delta).toEqual(tick.window);
                const firstTickAtMs = Date.parse(tick.timestamp);
                const writerDb = openDatabase(temp.dbPath);
                try {
                  new UsageEventsRepository(writerDb).insertMany([
                    createTestEvent({
                      timestamp: new Date(firstTickAtMs + 1).toISOString(),
                      rawIdHash: 'watch-process-valid-delta',
                      inputTokens: 200,
                      outputTokens: 11,
                      cachedTokens: 0,
                      totalTokens: 211
                    }),
                    createTestEvent({
                      timestamp: new Date(firstTickAtMs - 1_000).toISOString(),
                      rawIdHash: 'watch-process-backfill',
                      inputTokens: 300,
                      outputTokens: 7,
                      cachedTokens: 0,
                      totalTokens: 307
                    })
                  ]);
                } finally {
                  writerDb.close();
                }
              } else if (lines.length === 2) {
                expect(tick.delta).toMatchObject({ events: 1, totalTokens: 211 });
                expect(tick.window).toMatchObject({ events: 3, totalTokens: 658 });
                child.kill('SIGINT');
                sigintFallback = setTimeout(() => {
                  failure = new WatchProcessError('sigint_timeout');
                  child.kill('SIGKILL');
                }, 2_000);
              } else {
                failure = new WatchProcessError('unexpected_extra_line');
                child.kill('SIGKILL');
              }
            } catch (error) {
              failure = error instanceof Error ? error : new WatchProcessError('assertion_failure');
              child.kill('SIGKILL');
            }
            newlineIndex = lineBuffer.indexOf('\n');
          }
        });
        child.stderr.on('data', (chunk: string) => {
          stderr += chunk;
        });
        child.on('error', (error) => {
          clearTimeout(timeout);
          if (sigintFallback !== undefined) clearTimeout(sigintFallback);
          reject(error);
        });
        child.on('close', (code, signal) => {
          clearTimeout(timeout);
          if (sigintFallback !== undefined) clearTimeout(sigintFallback);
          if (failure !== undefined) {
            reject(failure);
            return;
          }
          resolve({ status: code ?? -1, signal, stdout, stderr, lines });
        });
      });
      const [firstLine, secondLine] = result.lines;
      const firstTick = watchTickReportSchema.parse(JSON.parse(firstLine ?? ''));
      const secondTick = watchTickReportSchema.parse(JSON.parse(secondLine ?? ''));

      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stderr).toBe('');
      expect(result.lines).toHaveLength(2);
      expect(result.stdout).toBe(`${firstLine}\n${secondLine}\n`);
      expect(firstTick).toMatchObject({
        kind: 'watch_tick',
        intervalMs: 5_000,
        windowMs: 600_000,
        delta: { events: 1, totalTokens: 140 },
        window: { events: 1, totalTokens: 140 },
        privacy: { sanitized: true }
      });
      expect(secondTick.delta).toMatchObject({ events: 1, totalTokens: 211 });
      expect(secondTick.window).toMatchObject({ events: 3, totalTokens: 658 });
      expect(Date.parse(secondTick.timestamp)).toBeGreaterThan(Date.parse(firstTick.timestamp));
      expect(containsPrivacySentinel([result.stdout, result.stderr, firstTick, secondTick])).toBe(
        false
      );
      assertJsonOutputPrivacy(firstTick);
      assertJsonOutputPrivacy(secondTick);
      assertCliOutputPrivacy(result);
    } finally {
      if (db.open) db.close();
      temp.cleanup();
    }
  }, 20_000);

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

  it('stores explicit scan project labels across the CLI process boundary', () => {
    const temp = createTempDb();
    try {
      const result = runCli(
        [
          'scan',
          '--source',
          'codex',
          '--path',
          join(process.cwd(), 'tests', 'fixtures', 'codex', 'sessions.jsonl'),
          '--project-label',
          'client-a'
        ],
        temp.dbPath
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('warning: codex:malformed-jsonl-records');
      const db = openDatabase(temp.dbPath);
      try {
        const events = new UsageEventsRepository(db).listAll();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              workspaceLabel: 'client-a',
              metadata: expect.objectContaining({ projectLabelSource: 'scan-option' })
            })
          ])
        );
        expect(containsPrivacySentinel([result.stdout, result.stderr, events])).toBe(false);
      } finally {
        db.close();
      }
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid scan project labels without echoing raw input', () => {
    const temp = createTempDb();
    try {
      const result = runCli(
        [
          'scan',
          '--source',
          'codex',
          '--path',
          join(process.cwd(), 'tests', 'fixtures', 'codex', 'sessions.jsonl'),
          '--project-label',
          'RAW_PATH_SENTINEL_DO_NOT_LEAK'
        ],
        temp.dbPath
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: invalid_project_label\n');
      expect(containsPrivacySentinel(result.stderr)).toBe(false);
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

  it('groups summary output by explicit public project labels only', () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      new UsageEventsRepository(db).insertMany([
        createTestEvent({
          rawIdHash: 'project-explicit-config',
          workspaceLabel: 'client-alpha',
          metadata: { parser: 'test', projectLabelSource: 'config' },
          inputTokens: 200,
          outputTokens: 100,
          cachedTokens: 0,
          totalTokens: 300,
          estimatedCostUsd: 0.3
        }),
        createTestEvent({
          rawIdHash: 'project-explicit-scan',
          workspaceLabel: 'client-alpha',
          metadata: { parser: 'test', projectLabelSource: 'scan-option' },
          inputTokens: 50,
          outputTokens: 50,
          cachedTokens: 0,
          totalTokens: 100,
          estimatedCostUsd: 0.1
        }),
        createTestEvent({
          rawIdHash: 'project-explicit-headless',
          workspaceLabel: 'batch-runner',
          metadata: { parser: 'test', projectLabelSource: 'headless-input' },
          inputTokens: 70,
          outputTokens: 30,
          cachedTokens: 0,
          totalTokens: 100,
          estimatedCostUsd: 0.2
        }),
        createTestEvent({
          rawIdHash: 'project-legacy-label',
          workspaceLabel: 'legacy-parser-label',
          workspaceHash: 'legacy-workspace-hash-alpha',
          model: 'unknown-fixture-model',
          metadata: { parser: 'test', rawPath: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' },
          inputTokens: 40,
          outputTokens: 10,
          cachedTokens: 0,
          totalTokens: 50
        }),
        createTestEvent({
          rawIdHash: 'project-hash-only',
          workspaceHash: 'workspace-hash-beta',
          model: 'unknown-fixture-model',
          metadata: { parser: 'test', prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' },
          inputTokens: 20,
          outputTokens: 10,
          cachedTokens: 0,
          totalTokens: 30
        }),
        createTestEvent({
          rawIdHash: 'project-hash-like-label',
          workspaceLabel: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          model: 'unknown-fixture-model',
          metadata: { parser: 'test', projectLabelSource: 'config' },
          inputTokens: 10,
          outputTokens: 10,
          cachedTokens: 0,
          totalTokens: 20
        })
      ]);
      db.close();

      const json = runCli(['summary', '--group-by', 'project', '--json'], temp.dbPath);
      const text = runCli(['summary', '--group-by', 'project'], temp.dbPath);
      const payload = JSON.parse(json.stdout) as {
        groupBy: string;
        groups: Array<{
          key: string;
          events: number;
          totalTokens: number;
          estimatedCostUsd: number | null;
        }>;
      };

      expect(json.status).toBe(0);
      expect(json.stderr).toBe('');
      expect(payload).toEqual({
        groupBy: 'project',
        groups: [
          expect.objectContaining({
            key: 'client-alpha',
            events: 2,
            totalTokens: 400,
            estimatedCostUsd: 0.4
          }),
          expect.objectContaining({
            key: 'batch-runner',
            events: 1,
            totalTokens: 100,
            estimatedCostUsd: 0.2
          }),
          expect.objectContaining({
            key: 'unknown',
            events: 3,
            totalTokens: 100,
            estimatedCostUsd: null
          })
        ]
      });
      expect(json.stdout).not.toContain('legacy-parser-label');
      expect(json.stdout).not.toContain('workspace-hash');
      expect(json.stdout).not.toContain('9f86d081');
      expect(text.status).toBe(0);
      expect(text.stderr).toBe('');
      expect(text.stdout).toContain('client-alpha');
      expect(text.stdout).toContain('batch-runner');
      expect(text.stdout).toContain('unknown');
      expect(text.stdout).toContain('unknown');
      expect(text.stdout).not.toContain('$0.00');
      expect(text.stdout).not.toContain('legacy-parser-label');
      expect(text.stdout).not.toContain('workspace-hash');
      expect(text.stdout).not.toContain('9f86d081');
      expect(containsPrivacySentinel([json.stdout, json.stderr, text.stdout, text.stderr])).toBe(
        false
      );
      assertJsonOutputPrivacy(payload);
      assertCliOutputPrivacy({ stdout: text.stdout, stderr: text.stderr });
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
      expect(pngOnly.stdout).toBe(`Wrote graph PNG: ${basename(pngPath)}\n`);
      expect(pngOnly.stdout).not.toContain('/tmp/');
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
      expect(absolutePng.stdout).toBe(`Wrote graph PNG: ${basename(absolutePngPath)}\n`);
      expect(absolutePng.stdout).not.toContain('/tmp/');
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
      expect(result.stdout).toBe(`Wrote wrapped PNG: ${basename(pngPath)}\n`);
      expect(result.stdout).not.toContain('/tmp/');
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
