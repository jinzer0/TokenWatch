import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { BudgetThresholdsRepository } from '../src/db/repositories/budgetThresholds.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { ScanRun } from '../src/models/scanRun.js';
import { BudgetService } from '../src/services/budgetService.js';
import {
  desktopDashboardFiltersSchema,
  desktopDashboardSchema,
  desktopDashboardSnapshotSchema
} from '../src/desktop/shared/contracts.js';
import { DesktopDashboardService } from '../src/services/desktopDashboard.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';
import { assertJsonOutputPrivacy } from './privacyOutput.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

function createDashboardService(): {
  budget: BudgetService;
  pricingModels: PricingModelsRepository;
  usageEvents: UsageEventsRepository;
  scanRuns: ScanRunsRepository;
  service: DesktopDashboardService;
} {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  const usageEvents = new UsageEventsRepository(db);
  const scanRuns = new ScanRunsRepository(db);
  const budgetThresholds = new BudgetThresholdsRepository(db);
  const pricingModels = new PricingModelsRepository(db);
  const budget = new BudgetService(budgetThresholds, usageEvents);
  const service = new DesktopDashboardService({
    budget,
    pricingModels,
    scanRuns,
    usageEvents
  });
  return { budget, pricingModels, usageEvents, scanRuns, service };
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

function serviceSafeDashboardFixture() {
  const { service } = createDashboardService();
  return service.buildDashboard();
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
      projectGroups: [],
      unknownPricingCount: 0,
      budgetDiagnostics: [],
      pricingDiagnostics: [],
      recentScanRuns: [],
      diagnosticsHub: {
        database: { readiness: 'ready', eventCount: 0, scanRunCount: 0 },
        latestScan: {
          status: 'none',
          startedAt: null,
          finishedAt: null,
          sourceName: null,
          parserName: null,
          warningCount: 0,
          errorCode: null
        },
        sourceHealth: {
          status: 'no-runs',
          sourcesWithRuns: 0,
          failedRuns: 0,
          warningRuns: 0,
          interruptedRuns: 0
        },
        pricingSummary: {
          status: 'no-events',
          diagnosticCount: 0,
          unknownCostEventCount: 0,
          unknownCostTokenCount: 0,
          unresolvedModelCount: 0
        },
        budgetSummary: {
          status: 'not-configured',
          diagnosticCount: 0,
          overBudgetCount: 0,
          unknownCostBudgetCount: 0
        },
        sessionSummary: {
          status: 'no-sessions',
          sessionCount: 0,
          eventsWithoutSession: 0,
          maxConcurrentSessions: 0,
          longestContinuousMs: 0
        },
        projectSummary: {
          status: 'no-events',
          publicProjectCount: 0,
          labeledEventCount: 0,
          unknownProjectEventCount: 0,
          unlabeledWorkspaceHashCount: 0
        },
        privacy: {
          sanitized: true,
          boundaryCopyKey: 'desktop.diagnostics.privacyBoundary'
        },
        recommendedActions: [
          {
            code: 'run-scan',
            priority: 'high',
            copyKey: 'desktop.diagnostics.action.runScan',
            command: 'tokenwatch scan --source <source> --path <path>'
          },
          {
            code: 'set-budget-threshold',
            priority: 'low',
            copyKey: 'desktop.diagnostics.action.setBudgetThreshold',
            command: 'tokenwatch budget set --scope monthly_total --threshold <usd>'
          }
        ]
      },
      filters: { from: null, to: null },
      sessionMetrics: {
        sessionCount: 0,
        totalWallDurationMs: 0,
        totalActiveDurationMs: 0,
        longestSessionMs: 0,
        longestContinuousMs: 0,
        maxConcurrentSessions: 0,
        eventsWithoutSession: 0
      },
      sessionIntervals: [],
      privacy: { sanitized: true }
    });
    expect(desktopDashboardSchema.parse(dashboard)).toEqual(dashboard);
    expect(containsPrivacySentinel(dashboard)).toBe(false);
    assertJsonOutputPrivacy({ diagnosticsHub: dashboard.diagnosticsHub });
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
    expect(dashboard.dateRange).toEqual({
      start: '2026-05-01T00:00:00.000Z',
      end: '2026-05-02T00:00:00.000Z'
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

  it('publishes only explicit project groups and collapses legacy or hash-only rows into unknown', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        id: 'explicit-config-alpha',
        timestamp: '2026-05-01T00:00:00.000Z',
        workspaceLabel: 'client-alpha',
        metadata: { parser: 'test', projectLabelSource: 'config' },
        inputTokens: 40,
        outputTokens: 20,
        totalTokens: 60,
        estimatedCostUsd: 0.6
      }),
      createTestEvent({
        id: 'explicit-scan-alpha',
        timestamp: '2026-05-01T01:00:00.000Z',
        workspaceLabel: 'client-alpha',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' },
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        estimatedCostUsd: 0.3
      }),
      createTestEvent({
        id: 'explicit-headless-beta',
        timestamp: '2026-05-01T02:00:00.000Z',
        workspaceLabel: 'batch-beta',
        metadata: { parser: 'test', projectLabelSource: 'headless-input' },
        inputTokens: 15,
        outputTokens: 5,
        totalTokens: 20,
        estimatedCostUsd: 0.2
      }),
      {
        ...createTestEvent({
          id: 'explicit-hash-like-label',
          timestamp: '2026-05-01T02:30:00.000Z',
          workspaceLabel: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          metadata: { parser: 'test', projectLabelSource: 'scan-option' },
          inputTokens: 8,
          outputTokens: 3,
          totalTokens: 11
        }),
        estimatedCostUsd: null
      },
      {
        ...createTestEvent({
          id: 'legacy-parser-label',
          timestamp: '2026-05-01T03:00:00.000Z',
          workspaceHash: 'workspace-hash-legacy',
          workspaceLabel: 'codex',
          metadata: { parser: 'test', projectLabelSource: 'parser' },
          inputTokens: 9,
          outputTokens: 1,
          totalTokens: 10
        }),
        estimatedCostUsd: null
      },
      {
        ...createTestEvent({
          id: 'hash-only-row-event',
          timestamp: '2026-05-01T04:00:00.000Z',
          workspaceHash: 'workspace-hash-only',
          inputTokens: 6,
          outputTokens: 4,
          totalTokens: 10
        }),
        estimatedCostUsd: null
      },
      {
        ...createTestEvent({
          id: 'unlabeled-row-event',
          timestamp: '2026-05-01T05:00:00.000Z',
          inputTokens: 3,
          outputTokens: 2,
          totalTokens: 5
        }),
        estimatedCostUsd: null
      }
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.projectGroups).toEqual([
      {
        projectKey: 'client-alpha',
        events: 2,
        inputTokens: 60,
        outputTokens: 30,
        totalTokens: 90,
        estimatedCostUsd: 0.9
      },
      {
        projectKey: 'unknown',
        events: 4,
        inputTokens: 26,
        outputTokens: 10,
        totalTokens: 36,
        estimatedCostUsd: null
      },
      {
        projectKey: 'batch-beta',
        events: 1,
        inputTokens: 15,
        outputTokens: 5,
        totalTokens: 20,
        estimatedCostUsd: 0.2
      }
    ]);
    expect(dashboard.diagnosticsHub.projectSummary).toEqual({
      status: 'needs-labels',
      publicProjectCount: 2,
      labeledEventCount: 3,
      unknownProjectEventCount: 4,
      unlabeledWorkspaceHashCount: 2
    });
    expect(dashboard.diagnosticsHub.recommendedActions).toContainEqual({
      code: 'label-projects',
      priority: 'medium',
      copyKey: 'desktop.diagnostics.action.labelProjects',
      command: 'tokenwatch config set project_label <label>'
    });
    expect(JSON.stringify(dashboard.projectGroups)).not.toMatch(/workspace-hash|codex/);
    assertJsonOutputPrivacy({ projectGroups: dashboard.projectGroups });
  });

  it('does not count the unknown project bucket as a public project', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        id: 'all-unknown-legacy-label',
        workspaceHash: 'workspace-hash-legacy-only',
        workspaceLabel: 'codex',
        metadata: { parser: 'test', projectLabelSource: 'parser' }
      }),
      createTestEvent({
        id: 'all-unknown-hash-only',
        workspaceHash: 'workspace-hash-only-row'
      })
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.projectGroups.map((group) => group.projectKey)).toEqual(['unknown']);
    expect(dashboard.diagnosticsHub.projectSummary).toMatchObject({
      status: 'needs-labels',
      publicProjectCount: 0,
      labeledEventCount: 0,
      unknownProjectEventCount: 2,
      unlabeledWorkspaceHashCount: 2
    });
    expect(JSON.stringify(dashboard.projectGroups)).not.toMatch(/workspace-hash|codex/);
    assertJsonOutputPrivacy({ projectGroups: dashboard.projectGroups });
  });

  it('keeps desktop date filters on UTC boundaries instead of statusline local windows', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-04-30T23:30:00.000Z',
        rawIdHash: 'utc-previous-day-row',
        inputTokens: 100,
        outputTokens: 100,
        totalTokens: 200
      }),
      createTestEvent({
        timestamp: '2026-05-01T00:30:00.000Z',
        rawIdHash: 'utc-filtered-row',
        inputTokens: 7,
        outputTokens: 8,
        totalTokens: 15
      })
    ]);

    const filters = desktopDashboardFiltersSchema.parse({ from: '2026-05-01', to: '2026-05-01' });
    const dashboard = service.buildDashboard({ filters });

    expect(filters).toMatchObject({
      fromTimestamp: '2026-05-01T00:00:00.000Z',
      toTimestamp: '2026-05-01T23:59:59.999Z'
    });
    expect(dashboard.totals).toMatchObject({ events: 1, tokens: 15 });
    expect(dashboard.dateRange).toEqual({
      start: '2026-05-01T00:30:00.000Z',
      end: '2026-05-01T00:30:00.000Z'
    });
    expect(JSON.stringify(dashboard)).not.toContain('utc-previous-day-row');
  });

  it('applies inclusive UTC date-only filters and returns session metrics', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-05-01T00:00:00.000Z',
        source: 'codex',
        sessionIdHash: 'hash-may-one',
        rawIdHash: 'raw-may-one-start',
        messageCount: 2,
        inputTokens: 10,
        outputTokens: 20,
        cachedTokens: 3,
        reasoningTokens: 4,
        totalTokens: 30,
        estimatedCostUsd: 0.1
      }),
      createTestEvent({
        timestamp: '2026-05-01T23:59:59.999Z',
        source: 'codex',
        sessionIdHash: 'hash-may-one',
        rawIdHash: 'raw-may-one-end',
        messageCount: 3,
        inputTokens: 15,
        outputTokens: 25,
        cachedTokens: 5,
        reasoningTokens: 6,
        totalTokens: 40,
        estimatedCostUsd: 0.2
      }),
      createTestEvent({
        timestamp: '2026-05-02T00:00:00.000Z',
        source: 'claude',
        sessionIdHash: 'hash-may-two',
        rawIdHash: 'raw-may-two',
        inputTokens: 500,
        outputTokens: 499,
        totalTokens: 999,
        estimatedCostUsd: 0.9
      }),
      {
        ...createTestEvent({
          timestamp: '2026-05-01T12:00:00.000Z',
          source: 'gemini',
          sessionIdHash: null,
          rawIdHash: 'raw-missing-session',
          inputTokens: 3,
          outputTokens: 4,
          cachedTokens: 0,
          reasoningTokens: 0,
          totalTokens: 7
        }),
        estimatedCostUsd: null
      }
    ]);

    const filters = desktopDashboardFiltersSchema.parse({ from: '2026-05-01', to: '2026-05-01' });
    const dashboard = service.buildDashboard({ filters });

    expect(dashboard.filters).toEqual({ from: '2026-05-01', to: '2026-05-01' });
    expect(dashboard.totals).toMatchObject({ events: 3, tokens: 77, unknownCostEvents: 1 });
    expect(dashboard.dateRange).toEqual({
      start: '2026-05-01T00:00:00.000Z',
      end: '2026-05-01T23:59:59.999Z'
    });
    expect(dashboard.sessionMetrics).toEqual({
      sessionCount: 1,
      totalWallDurationMs: 86_399_999,
      totalActiveDurationMs: 0,
      longestSessionMs: 86_399_999,
      longestContinuousMs: 0,
      maxConcurrentSessions: 1,
      eventsWithoutSession: 1
    });
    expect(dashboard.sessionIntervals).toEqual([
      {
        source: 'codex',
        sessionIdHash: 'hash-may-one',
        startedAt: '2026-05-01T00:00:00.000Z',
        endedAt: '2026-05-01T23:59:59.999Z',
        lastSeen: '2026-05-01T23:59:59.999Z',
        events: 2,
        messageCount: 5,
        inputTokens: 25,
        outputTokens: 45,
        cachedTokens: 8,
        reasoningTokens: 10,
        totalTokens: 70,
        estimatedCostUsd: 0.3,
        activeDurationMs: 0,
        wallDurationMs: 86_399_999
      }
    ]);
    expect(JSON.stringify(dashboard)).not.toContain('hash-may-two');
  });

  it('keeps ready empty filtered results distinct from setup state', () => {
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-05-01T00:00:00.000Z',
        rawIdHash: 'raw-existing-event',
        inputTokens: 10,
        outputTokens: 10,
        totalTokens: 20
      })
    ]);

    const filters = desktopDashboardFiltersSchema.parse({ from: '2026-05-03', to: '2026-05-03' });
    const dashboard = service.buildDashboard({ filters });

    expect(dashboard.filters).toEqual({ from: '2026-05-03', to: '2026-05-03' });
    expect(dashboard.totals.events).toBe(0);
    expect(dashboard.totals.tokens).toBe(0);
    expect(dashboard.dateRange).toEqual({ start: null, end: null });
    expect(dashboard.sessionMetrics.sessionCount).toBe(0);
    expect(dashboard.sessionIntervals).toEqual([]);
  });

  it('rejects invalid desktop date filter ranges at the shared contract boundary', () => {
    expect(() =>
      desktopDashboardFiltersSchema.parse({ from: '2026-05-02', to: '2026-05-01' })
    ).toThrow();
    expect(() => desktopDashboardFiltersSchema.parse({ from: '2026-5-01' })).toThrow();
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

  it('returns current-month budget diagnostics and filtered pricing diagnostics without network lookup', () => {
    const { budget, pricingModels, usageEvents, service } = createDashboardService();
    budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 0.5 });
    budget.setThreshold({ scopeKind: 'sourceName', sourceName: 'lab-a100', thresholdUsd: 1 });
    pricingModels.setLookupCache({
      cacheKey: 'lookup:openai:exact-diagnostic-model',
      provider: 'openai',
      model: 'exact-diagnostic-model',
      matchedSource: 'litellm',
      matchedKey: 'litellm:openai:exact-diagnostic-model',
      confidence: 'exact',
      inputPricePerMillion: 3,
      outputPricePerMillion: 9,
      fetchedAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z'
    });
    pricingModels.setLookupCache({
      cacheKey: 'lookup:openai:no-match-diagnostic-model',
      provider: 'openai',
      model: 'no-match-diagnostic-model',
      matchedSource: 'unknown',
      confidence: 'none',
      fetchedAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      noMatch: true
    });
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-07-04T10:00:00.000Z',
        rawIdHash: 'known-current-budget',
        sourceName: 'lab-a100',
        model: 'exact-diagnostic-model',
        normalizedModel: 'exact-diagnostic-model',
        pricingSource: 'litellm',
        pricingConfidence: 'exact',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.75
      }),
      {
        ...createTestEvent({
          timestamp: '2026-07-04T11:00:00.000Z',
          rawIdHash: 'unknown-current-budget',
          sourceName: 'lab-a100',
          model: 'no-match-diagnostic-model',
          normalizedModel: 'no-match-diagnostic-model',
          pricingSource: 'unknown',
          pricingConfidence: 'none',
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300
        }),
        estimatedCostUsd: null
      },
      {
        ...createTestEvent({
          timestamp: '2026-07-05T10:00:00.000Z',
          rawIdHash: 'outside-filter-pricing',
          model: 'outside-filter-model',
          normalizedModel: 'outside-filter-model',
          inputTokens: 50,
          outputTokens: 50,
          totalTokens: 100
        }),
        estimatedCostUsd: null
      }
    ]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const filters = desktopDashboardFiltersSchema.parse({ from: '2026-07-04', to: '2026-07-04' });
    const dashboard = service.buildDashboard({
      budgetEvaluationDate: new Date(2026, 6, 7),
      filters
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dashboard.budgetDiagnostics).toEqual([
      expect.objectContaining({
        periodLabel: 'current month',
        month: '2026-07',
        scopeKind: 'monthly_total',
        sourceName: null,
        knownSpendUsd: 0.75,
        thresholdUsd: 0.5,
        status: 'over',
        unknownCostEventCount: 2,
        unknownCostTokenCount: 400,
        warningCodes: ['budget_threshold_exceeded', 'budget_unknown_cost_present'],
        recommendedAction: 'review budget threshold'
      }),
      expect.objectContaining({
        periodLabel: 'current month',
        scopeKind: 'sourceName',
        sourceName: 'lab-a100',
        status: 'unknown-costs-present',
        unknownCostEventCount: 1,
        unknownCostTokenCount: 300,
        recommendedAction: 'add custom price'
      })
    ]);
    expect(dashboard.pricingDiagnostics.map((row) => row.model)).toEqual([
      'no-match-diagnostic-model',
      'exact-diagnostic-model'
    ]);
    expect(dashboard.pricingDiagnostics[0]).toMatchObject({
      cacheStatus: 'negative-cache',
      diagnosticStatus: 'negative-cache',
      estimatedCostUsd: null,
      matchedKey: null,
      recommendedAction: 'add custom price',
      totalTokens: 300,
      unknownCostEventCount: 1,
      unknownCostTokenCount: 300
    });
    expect(dashboard.pricingDiagnostics[1]).toMatchObject({
      cacheStatus: 'matched-cache',
      diagnosticStatus: 'exact-match',
      estimatedCostUsd: 0.75,
      matchedKey: 'litellm:openai:exact-diagnostic-model',
      recommendedAction: 'no action',
      totalTokens: 150,
      unknownCostEventCount: 0
    });
    expect(dashboard.diagnosticsHub.pricingSummary).toEqual({
      status: 'unknown-costs',
      diagnosticCount: 2,
      unknownCostEventCount: 1,
      unknownCostTokenCount: 300,
      unresolvedModelCount: 1
    });
    expect(dashboard.diagnosticsHub.budgetSummary).toEqual({
      status: 'over',
      diagnosticCount: 2,
      overBudgetCount: 1,
      unknownCostBudgetCount: 1
    });
    expect(dashboard.diagnosticsHub.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'add-custom-price',
          command:
            'tokenwatch pricing set --provider <provider> --model <model> --input <usd> --output <usd>'
        }),
        expect.objectContaining({
          code: 'review-budget-threshold',
          command: 'tokenwatch budget list'
        })
      ])
    );
    expect(JSON.stringify(dashboard)).not.toContain('outside-filter-model');
    expect(containsPrivacySentinel(dashboard)).toBe(false);
    assertJsonOutputPrivacy({ diagnosticsHub: dashboard.diagnosticsHub });
    fetchSpy.mockRestore();
  });

  it('summarizes failed recent scans without raw error text or paths', () => {
    const { scanRuns, service } = createDashboardService();
    scanRuns.create(
      createRun({
        id: 'failed-private-run',
        startedAt: '2026-06-01T00:00:00.000Z',
        finishedAt: '2026-06-01T00:00:01.000Z',
        sourceName: 'lab-runner',
        parserName: 'codex',
        status: 'failed',
        errorRecords: 2,
        warningCodes: ['unsupported_usage_artifact'],
        errorCode: 'parser_failed'
      })
    );

    const dashboard = service.buildDashboard();

    expect(dashboard.diagnosticsHub.latestScan).toEqual({
      status: 'failed',
      startedAt: '2026-06-01T00:00:00.000Z',
      finishedAt: '2026-06-01T00:00:01.000Z',
      sourceName: 'lab-runner',
      parserName: 'codex',
      warningCount: 1,
      errorCode: 'parser_failed'
    });
    expect(dashboard.diagnosticsHub.sourceHealth).toEqual({
      status: 'failing',
      sourcesWithRuns: 1,
      failedRuns: 1,
      warningRuns: 1,
      interruptedRuns: 0
    });
    expect(dashboard.diagnosticsHub.recommendedActions).toContainEqual({
      code: 'review-failed-scan',
      priority: 'high',
      copyKey: 'desktop.diagnostics.action.reviewFailedScan',
      command: 'tokenwatch doctor --sources'
    });
    expect(JSON.stringify(dashboard.diagnosticsHub)).not.toMatch(
      /Users|TOKENWATCH_PATH|STACK_TRACE|select\s+.+from/i
    );
    assertJsonOutputPrivacy({ diagnosticsHub: dashboard.diagnosticsHub });
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
      /rawSource|rawIdHash|metadata|workspaceHash|PROMPT_SENTINEL|RESPONSE_SENTINEL|RAW_SESSION_SENTINEL/
    );
    assertJsonOutputPrivacy({ diagnosticsHub: dashboard.diagnosticsHub });
  });

  it('fails closed when diagnostics hub labels or actions contain unsafe raw text', () => {
    const unsafeDashboard = serviceSafeDashboardFixture();

    expect(() =>
      desktopDashboardSchema.parse({
        ...unsafeDashboard,
        projectGroups: [
          {
            projectKey: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            events: 1,
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            estimatedCostUsd: null
          }
        ]
      })
    ).toThrow();
    expect(() =>
      desktopDashboardSchema.parse({
        ...unsafeDashboard,
        diagnosticsHub: {
          ...unsafeDashboard.diagnosticsHub,
          recommendedActions: [
            {
              code: 'review-failed-scan',
              priority: 'high',
              copyKey: 'desktop.diagnostics.action.reviewFailedScan',
              command: 'tokenwatch doctor --sources --db /Users/private/tokenwatch.db'
            }
          ]
        }
      })
    ).toThrow();
    expect(() =>
      desktopDashboardSchema.parse({
        ...unsafeDashboard,
        diagnosticsHub: {
          ...unsafeDashboard.diagnosticsHub,
          latestScan: {
            ...unsafeDashboard.diagnosticsHub.latestScan,
            errorCode: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK at parser (/tmp/raw.ts:1:1)'
          }
        }
      })
    ).toThrow();
  });

  it('keeps unavailable desktop database snapshots sanitized without raw setup diagnostics', () => {
    const setupNeeded = desktopDashboardSnapshotSchema.parse({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    const unavailable = desktopDashboardSnapshotSchema.parse({
      status: 'database-unavailable',
      dashboard: null,
      privacy: { sanitized: true }
    });

    expect(setupNeeded).toEqual({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    expect(unavailable).toEqual({
      status: 'database-unavailable',
      dashboard: null,
      privacy: { sanitized: true }
    });
    assertJsonOutputPrivacy(setupNeeded);
    assertJsonOutputPrivacy(unavailable);
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
          projectGroups: [],
          unknownPricingCount: 0,
          budgetDiagnostics: [],
          pricingDiagnostics: [],
          recentScanRuns: [],
          diagnosticsHub: serviceSafeDashboardFixture().diagnosticsHub,
          filters: { from: null, to: null },
          sessionMetrics: {
            sessionCount: 0,
            totalWallDurationMs: 0,
            totalActiveDurationMs: 0,
            longestSessionMs: 0,
            longestContinuousMs: 0,
            maxConcurrentSessions: 0,
            eventsWithoutSession: 0
          },
          sessionIntervals: [],
          privacy: { sanitized: true }
        })
      )
    ).toContain('desktop-dashboard');
  });
});
