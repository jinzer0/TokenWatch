import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { ScanRun } from '../src/models/scanRun.js';
import { desktopDashboardSchema } from '../src/desktop/shared/contracts.js';
import { DesktopDashboardService } from '../src/services/desktopDashboard.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

function createDashboardService(): {
  usageEvents: UsageEventsRepository;
  scanRuns: ScanRunsRepository;
  service: DesktopDashboardService;
} {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  const usageEvents = new UsageEventsRepository(db);
  const scanRuns = new ScanRunsRepository(db);
  return { usageEvents, scanRuns, service: new DesktopDashboardService(usageEvents, scanRuns) };
}

function createRun(overrides: Partial<ScanRun> = {}): ScanRun {
  return {
    id: `scan-${overrides.startedAt ?? '2026-05-30T00:00:00.000Z'}`,
    startedAt: '2026-05-30T00:00:00.000Z',
    finishedAt: '2026-05-30T00:00:02.000Z',
    sourceName: 'local',
    parserName: 'codex',
    pathKind: 'custom',
    status: 'completed',
    discoveredFiles: 2,
    parsedEvents: 2,
    insertedEvents: 2,
    duplicateEvents: 0,
    conflictEvents: 0,
    skippedRecords: 0,
    rejectedRecords: 0,
    errorRecords: 0,
    warningCodes: [],
    errorCode: null,
    ...overrides
  };
}

describe('desktop dashboard service contract', () => {
  it('returns a strict sanitized empty dashboard', () => {
    const { service } = createDashboardService();

    const dashboard = service.buildDashboard();

    expect(dashboard).toMatchObject({
      version: 1,
      kind: 'desktop-dashboard',
      totals: {
        events: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        estimatedCostUsd: null,
        sources: 0,
        sourceNames: 0,
        models: 0,
        agents: 0,
        unknownCostEvents: 0
      },
      dateRange: { start: null, end: null },
      top: { model: null, agent: null, source: null, sourceName: null },
      usageSeries: [],
      costSeries: [],
      byModel: [],
      byAgent: [],
      bySource: [],
      bySourceName: [],
      unknownPricingCount: 0,
      recentScanRuns: [],
      privacy: { sanitized: true }
    });
    expect(desktopDashboardSchema.parse(dashboard)).toEqual(dashboard);
    expect(containsPrivacySentinel(dashboard)).toBe(false);
  });

  it('aggregates multi-model, multi-agent, multi-sourceName data', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-05-01T00:00:00.000Z',
        source: 'codex',
        sourceName: 'local',
        agent: 'codex',
        model: 'gpt-5.5-fast',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 10,
        totalTokens: 150,
        estimatedCostUsd: 0.1
      }),
      createTestEvent({
        timestamp: '2026-05-01T01:00:00.000Z',
        source: 'claude',
        sourceName: 'work',
        agent: 'claude',
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        inputTokens: 60,
        outputTokens: 40,
        cachedTokens: 0,
        totalTokens: 100,
        estimatedCostUsd: 0.2
      }),
      createTestEvent({
        timestamp: '2026-05-02T00:00:00.000Z',
        source: 'codex',
        sourceName: 'local',
        agent: 'codex',
        model: 'gpt-5.5-fast',
        inputTokens: 50,
        outputTokens: 25,
        cachedTokens: 5,
        totalTokens: 75,
        estimatedCostUsd: 0.05
      })
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.totals).toMatchObject({
      events: 3,
      tokens: 325,
      inputTokens: 210,
      outputTokens: 115,
      cachedTokens: 15,
      estimatedCostUsd: 0.35,
      sources: 2,
      sourceNames: 2,
      models: 2,
      agents: 2,
      unknownCostEvents: 0
    });
    expect(dashboard.top).toEqual({
      model: 'gpt-5.5-fast',
      agent: 'codex',
      source: 'codex',
      sourceName: 'local'
    });
    expect(dashboard.byModel.map((group) => [group.key, group.totalTokens])).toEqual([
      ['gpt-5.5-fast', 225],
      ['claude-sonnet-4.5', 100]
    ]);
    expect(dashboard.byAgent.map((group) => group.key)).toEqual(['codex', 'claude']);
    expect(dashboard.bySourceName.map((group) => [group.key, group.events])).toEqual([
      ['local', 2],
      ['work', 1]
    ]);
    expect(dashboard.usageSeries).toMatchObject([
      {
        key: '2026-05-01',
        events: 2,
        tokens: 250,
        inputTokens: 160,
        outputTokens: 90,
        cachedTokens: 10,
        estimatedCostUsd: 0.3,
        unknownCostEvents: 0
      },
      {
        key: '2026-05-02',
        events: 1,
        tokens: 75,
        inputTokens: 50,
        outputTokens: 25,
        cachedTokens: 5,
        estimatedCostUsd: 0.05,
        unknownCostEvents: 0
      }
    ]);
  });

  it('preserves partial unknown cost without coercing it to zero', () => {
    const { usageEvents, service } = createDashboardService();
    const unknownCostEvent = createTestEvent({
      timestamp: '2026-05-03T00:00:00.000Z',
      sourceName: 'unknown-cost',
      model: 'unpriced-model',
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30
    });
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-05-03T01:00:00.000Z',
        sourceName: 'known-cost',
        model: 'priced-model',
        inputTokens: 30,
        outputTokens: 20,
        totalTokens: 50,
        estimatedCostUsd: 0.25
      }),
      { ...unknownCostEvent, estimatedCostUsd: null }
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.totals.estimatedCostUsd).toBe(0.25);
    expect(dashboard.totals.unknownCostEvents).toBe(1);
    expect(dashboard.unknownPricingCount).toBe(1);
    expect(dashboard.byModel.find((group) => group.key === 'unpriced-model')).toMatchObject({
      estimatedCostUsd: null
    });
    expect(dashboard.costSeries).toEqual([
      { key: '2026-05-03', estimatedCostUsd: null, unknownCostEvents: 1 }
    ]);
  });

  it('includes recent scan-run summaries with path-kind only', () => {
    const { scanRuns, service } = createDashboardService();
    scanRuns.create(
      createRun({
        id: 'older-run',
        startedAt: '2026-05-29T00:00:00.000Z',
        sourceName: 'local',
        parserName: 'codex',
        pathKind: 'default'
      })
    );
    scanRuns.create(
      createRun({
        id: 'newer-run',
        startedAt: '2026-05-30T00:00:00.000Z',
        finishedAt: null,
        sourceName: 'work',
        parserName: 'claude-code',
        pathKind: 'custom',
        status: 'failed',
        discoveredFiles: 3,
        parsedEvents: 1,
        insertedEvents: 1,
        skippedRecords: 1,
        rejectedRecords: 1,
        errorRecords: 1,
        warningCodes: ['privacy_rejected'],
        errorCode: 'parser_failed'
      })
    );

    const dashboard = service.buildDashboard({ recentScanLimit: 1 });

    expect(dashboard.recentScanRuns).toEqual([
      {
        startedAt: '2026-05-30T00:00:00.000Z',
        finishedAt: null,
        sourceName: 'work',
        parserName: 'claude-code',
        pathKind: 'custom',
        status: 'failed',
        discoveredFiles: 3,
        parsedEvents: 1,
        insertedEvents: 1,
        duplicateEvents: 0,
        conflictEvents: 0,
        skippedRecords: 1,
        rejectedRecords: 1,
        errorRecords: 1,
        warningCodes: ['privacy_rejected'],
        errorCode: 'parser_failed'
      }
    ]);
    const serializedRuns = JSON.stringify(dashboard.recentScanRuns);
    expect(serializedRuns).not.toContain('/Users');
    expect(serializedRuns).not.toContain('\\Users');
    expect(serializedRuns).not.toContain('TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK');
  });

  it('rejects and avoids leaking privacy sentinel payloads', () => {
    const { service } = createDashboardService();
    const eventWithPrivateFields = {
      ...createTestEvent({
        timestamp: '2026-05-04T00:00:00.000Z',
        model: 'gpt-5.5-fast',
        estimatedCostUsd: 0.1
      }),
      rawSource: 'PROMPT_SENTINEL_DO_NOT_LEAK',
      rawIdHash: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
      metadata: { safeCode: 'RESPONSE_SENTINEL_DO_NOT_LEAK' }
    };

    const dashboard = service.buildDashboardFromEvents([eventWithPrivateFields], []);

    expect(containsPrivacySentinel(dashboard)).toBe(false);
    expect(JSON.stringify(dashboard)).not.toMatch(
      /rawSource|rawIdHash|metadata|workspaceHash|sessionIdHash|PROMPT_SENTINEL|RESPONSE_SENTINEL|RAW_SESSION_SENTINEL/
    );
  });

  it('keeps shared dashboard contracts renderer-safe', () => {
    expect(
      JSON.stringify(
        desktopDashboardSchema.parse({
          version: 1,
          kind: 'desktop-dashboard',
          generatedAt: '2026-05-30T00:00:00.000Z',
          totals: {
            events: 0,
            tokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            estimatedCostUsd: null,
            sources: 0,
            sourceNames: 0,
            models: 0,
            agents: 0,
            unknownCostEvents: 0
          },
          dateRange: { start: null, end: null },
          top: { model: null, agent: null, source: null, sourceName: null },
          usageSeries: [],
          costSeries: [],
          byModel: [],
          byAgent: [],
          bySource: [],
          bySourceName: [],
          unknownPricingCount: 0,
          recentScanRuns: [],
          privacy: { sanitized: true }
        })
      )
    ).toContain('desktop-dashboard');
  });
});
