import { vi } from 'vitest';

import type { TokenWatchDesktopApi } from '../../../src/desktop/shared/api.js';
import type {
  DesktopAppStatus,
  DesktopDashboardSnapshot
} from '../../../src/desktop/shared/contracts.js';
import {
  budgetDiagnosticFixture,
  diagnosticsHubFixture,
  pricingDiagnosticFixture
} from './diagnosticFixtures.js';

export type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;
type RecentScanRun = Dashboard['recentScanRuns'][number];
type SessionInterval = Dashboard['sessionIntervals'][number];

export type DashboardOverrides = Partial<Dashboard> & {
  readonly totals?: Partial<Dashboard['totals']>;
  readonly top?: Partial<Dashboard['top']>;
};

export type TokenwatchApiOverrides = {
  readonly getSnapshot?: TokenWatchDesktopApi['dashboard']['getSnapshot'];
  readonly refresh?: TokenWatchDesktopApi['dashboard']['refresh'];
  readonly getStatus?: TokenWatchDesktopApi['app']['getStatus'];
  readonly getVersion?: TokenWatchDesktopApi['app']['getVersion'];
  readonly exportReport?: TokenWatchDesktopApi['share']['exportReport'];
};

export const createDeferred = <T>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

export const setupSnapshot = (): DesktopDashboardSnapshot => ({
  status: 'setup-needed',
  dashboard: null,
  privacy: { sanitized: true }
});

export const appStatus = (status: DesktopAppStatus['database']['status']): DesktopAppStatus => ({
  app: 'ready',
  database: { status },
  privacy: { sanitized: true }
});

export const unsafePath = ['/', 'Users', '/private/', 'tokenwatch', '.db'].join('');
export const unsafeSql = ['select', ' * from ', 'usage_', 'events'].join('');

export const breakdown = (
  key: string,
  events: number,
  totalTokens: number
): Dashboard['byModel'][number] => ({
  key,
  events,
  inputTokens: Math.floor(totalTokens / 2),
  outputTokens: Math.floor(totalTokens / 3),
  cachedTokens: totalTokens - Math.floor(totalTokens / 2) - Math.floor(totalTokens / 3),
  reasoningTokens: 0,
  totalTokens,
  estimatedCostUsd: totalTokens / 100000,
  knownEstimatedCostUsd: totalTokens / 100000,
  unknownCostEvents: 0,
  unknownCostTokens: 0,
  topModel: 'safe-model',
  topAgent: 'safe-agent'
});

export const scanRunFixture = (overrides: Partial<RecentScanRun> = {}): RecentScanRun => ({
  startedAt: '2026-06-07T11:00:00.000Z',
  finishedAt: '2026-06-07T11:00:05.000Z',
  sourceName: 'safe-source-name',
  parserName: 'codex',
  pathKind: 'custom',
  status: 'completed',
  discoveredFiles: 4,
  parsedEvents: 3,
  insertedEvents: 2,
  duplicateEvents: 1,
  conflictEvents: 0,
  skippedRecords: 0,
  rejectedRecords: 0,
  errorRecords: 0,
  warningCodes: [],
  errorCode: null,
  ...overrides
});

export const sessionIntervalFixture = (
  overrides: Partial<SessionInterval> = {}
): SessionInterval => ({
  source: 'codex',
  sessionIdHash: 'hashed-session-alpha',
  startedAt: '2026-06-07T10:00:00.000Z',
  endedAt: '2026-06-07T10:05:00.000Z',
  lastSeen: '2026-06-07T10:05:00.000Z',
  events: 3,
  messageCount: 5,
  inputTokens: 600,
  outputTokens: 300,
  cachedTokens: 100,
  reasoningTokens: 50,
  totalTokens: 1000,
  estimatedCostUsd: 1.23,
  knownEstimatedCostUsd: 1.23,
  unknownCostEvents: 0,
  unknownCostTokens: 0,
  activeDurationMs: 300_000,
  wallDurationMs: 300_000,
  ...overrides
});

export const dashboardFixture = (overrides: DashboardOverrides = {}): Dashboard => {
  const { totals: totalsOverride, top: topOverride, ...dashboardOverrides } = overrides;
  const totals: Dashboard['totals'] = {
    events: 42,
    tokens: 123456,
    inputTokens: 60000,
    outputTokens: 40000,
    cachedTokens: 23456,
    estimatedCostUsd: null,
    knownEstimatedCostUsd: 12.34,
    sources: 3,
    sourceNames: 2,
    models: 2,
    agents: 2,
    unknownCostEvents: 1,
    unknownCostTokens: 140,
    ...totalsOverride
  };
  const top: Dashboard['top'] = {
    model: 'safe-model-alpha',
    agent: 'safe-agent',
    source: 'safe-source',
    sourceName: 'safe-source-name',
    ...topOverride
  };

  const baseDashboard: Dashboard = {
    version: 1,
    kind: 'desktop-dashboard',
    generatedAt: '2026-06-07T12:00:00.000Z',
    totals,
    dateRange: {
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-07T12:00:00.000Z'
    },
    top,
    usageSeries: [
      {
        key: '2026-06',
        events: 10,
        tokens: 1000,
        inputTokens: 600,
        outputTokens: 300,
        cachedTokens: 100,
        estimatedCostUsd: 1.11,
        knownEstimatedCostUsd: 1.11,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      {
        key: '2026-06-01',
        events: 12,
        tokens: 2000,
        inputTokens: 1200,
        outputTokens: 600,
        cachedTokens: 200,
        estimatedCostUsd: 2.22,
        knownEstimatedCostUsd: 2.22,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      {
        key: '2026-06-07',
        events: 20,
        tokens: 4000,
        inputTokens: 2400,
        outputTokens: 1200,
        cachedTokens: 400,
        estimatedCostUsd: null,
        knownEstimatedCostUsd: 4.44,
        unknownCostEvents: 1,
        unknownCostTokens: 140
      }
    ],
    costSeries: [
      {
        key: '2026-06',
        estimatedCostUsd: 1.11,
        knownEstimatedCostUsd: 1.11,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      {
        key: '2026-06-01',
        estimatedCostUsd: 2.22,
        knownEstimatedCostUsd: 2.22,
        unknownCostEvents: 0,
        unknownCostTokens: 0
      },
      {
        key: '2026-06-07',
        estimatedCostUsd: null,
        knownEstimatedCostUsd: 4.44,
        unknownCostEvents: 1,
        unknownCostTokens: 140
      }
    ],
    insights: {
      window: '7d',
      range: {
        from: '2026-05-31T12:00:00.000Z',
        to: '2026-06-07T12:00:00.000Z'
      },
      cards: {
        totals: {
          events: 42,
          tokens: 123456,
          inputTokens: 60000,
          outputTokens: 40000,
          cachedTokens: 23456,
          reasoningTokens: 0,
          estimatedCostUsd: null,
          knownEstimatedCostUsd: 12.34,
          unknownCostEvents: 1,
          unknownCostTokens: 140
        },
        cacheHitRatio: { status: 'ok', value: 0.28 },
        reasoningToOutputRatio: { status: 'ok', value: 0 },
        budgetPressure: {
          status: 'over',
          ratio: 1.23,
          knownSpendUsd: 12.34,
          thresholdUsd: 10,
          unknownCostEvents: 1,
          unknownCostTokens: 140
        }
      },
      topRows: {
        models: [],
        sources: [],
        sourceNames: [],
        projects: []
      },
      costDriverCandidates: [
        {
          label: 'safe-model-alpha',
          pricingStatus: 'known',
          knownTokens: 90000,
          knownCostUsd: 9.87,
          effectiveCostPerMillionTokens: 109.67,
          knownSpendShare: 0.8,
          expensiveRelativeToMedian: true,
          spendDriverCandidate: true
        }
      ],
      warnings: ['unknown_pricing_present'],
      confidence: { level: 'medium', reasons: ['mixed_pricing_confidence'] },
      privacy: { sanitized: true }
    },
    trends: {
      trendScope: 'all-events-rolling',
      label: 'all-events rolling trend',
      windows: [
        {
          window: '7d',
          trendScope: 'all-events-rolling',
          range: {
            current: {
              from: '2026-05-31T12:00:00.000Z',
              to: '2026-06-07T12:00:00.000Z'
            },
            previous: {
              from: '2026-05-24T12:00:00.000Z',
              to: '2026-05-31T12:00:00.000Z'
            }
          },
          totals: {
            current: {
              events: 42,
              tokens: 123456,
              estimatedCostUsd: null,
              knownEstimatedCostUsd: 12.34,
              unknownCostEvents: 1,
              unknownCostTokens: 140
            },
            previous: {
              events: 30,
              tokens: 90000,
              estimatedCostUsd: 8.5,
              knownEstimatedCostUsd: 8.5,
              unknownCostEvents: 0,
              unknownCostTokens: 0
            },
            deltaPercent: 0.37,
            direction: 'up'
          },
          cards: [
            {
              window: '7d',
              metric: 'tokens',
              trendScope: 'all-events-rolling',
              label: 'all-events rolling trend',
              current: {
                events: 42,
                tokens: 123456,
                estimatedCostUsd: null,
                knownEstimatedCostUsd: 12.34,
                unknownCostEvents: 1,
                unknownCostTokens: 140
              },
              previous: {
                events: 30,
                tokens: 90000,
                estimatedCostUsd: 8.5,
                knownEstimatedCostUsd: 8.5,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              deltaPercent: 0.37,
              direction: 'up'
            },
            {
              window: '7d',
              metric: 'cost',
              trendScope: 'all-events-rolling',
              label: 'all-events rolling trend',
              current: {
                events: 42,
                tokens: 123456,
                estimatedCostUsd: null,
                knownEstimatedCostUsd: 12.34,
                unknownCostEvents: 1,
                unknownCostTokens: 140
              },
              previous: {
                events: 30,
                tokens: 90000,
                estimatedCostUsd: 8.5,
                knownEstimatedCostUsd: 8.5,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              deltaPercent: null,
              direction: 'unknown'
            }
          ],
          chartRows: [],
          warnings: ['unknown_pricing_present'],
          confidence: { level: 'medium', reasons: ['mixed_pricing_confidence'] },
          privacy: { sanitized: true }
        },
        {
          window: '30d',
          trendScope: 'all-events-rolling',
          range: {
            current: {
              from: '2026-05-08T12:00:00.000Z',
              to: '2026-06-07T12:00:00.000Z'
            },
            previous: {
              from: '2026-04-08T12:00:00.000Z',
              to: '2026-05-08T12:00:00.000Z'
            }
          },
          totals: {
            current: {
              events: 120,
              tokens: 250000,
              estimatedCostUsd: 22.5,
              knownEstimatedCostUsd: 22.5,
              unknownCostEvents: 0,
              unknownCostTokens: 0
            },
            previous: {
              events: 140,
              tokens: 300000,
              estimatedCostUsd: 25,
              knownEstimatedCostUsd: 25,
              unknownCostEvents: 0,
              unknownCostTokens: 0
            },
            deltaPercent: -0.17,
            direction: 'down'
          },
          cards: [
            {
              window: '30d',
              metric: 'tokens',
              trendScope: 'all-events-rolling',
              label: 'all-events rolling trend',
              current: {
                events: 120,
                tokens: 250000,
                estimatedCostUsd: 22.5,
                knownEstimatedCostUsd: 22.5,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              previous: {
                events: 140,
                tokens: 300000,
                estimatedCostUsd: 25,
                knownEstimatedCostUsd: 25,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              deltaPercent: -0.17,
              direction: 'down'
            },
            {
              window: '30d',
              metric: 'cost',
              trendScope: 'all-events-rolling',
              label: 'all-events rolling trend',
              current: {
                events: 120,
                tokens: 250000,
                estimatedCostUsd: 22.5,
                knownEstimatedCostUsd: 22.5,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              previous: {
                events: 140,
                tokens: 300000,
                estimatedCostUsd: 25,
                knownEstimatedCostUsd: 25,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              deltaPercent: -0.1,
              direction: 'down'
            }
          ],
          chartRows: [],
          warnings: [],
          confidence: { level: 'high', reasons: [] },
          privacy: { sanitized: true }
        }
      ],
      privacy: { sanitized: true }
    },
    byModel: [breakdown('safe-model-alpha', 24, 90000), breakdown('safe-model-beta', 18, 33456)],
    byAgent: [breakdown('safe-agent', 30, 100000), breakdown('safe-agent-alt', 12, 23456)],
    bySource: [breakdown('safe-source', 32, 100000), breakdown('safe-source-alt', 10, 23456)],
    bySourceName: [
      breakdown('safe-source-name', 25, 80000),
      breakdown('safe-source-name-alt', 17, 43456)
    ],
    unknownPricingCount: 1,
    budgetDiagnostics: [budgetDiagnosticFixture()],
    pricingDiagnostics: [pricingDiagnosticFixture()],
    recentScanRuns: [],
    diagnosticsHub: diagnosticsHubFixture(),
    filters: { from: null, to: null },
    sessionMetrics: {
      sessionCount: 2,
      totalWallDurationMs: 900_000,
      totalActiveDurationMs: 600_000,
      longestSessionMs: 600_000,
      longestContinuousMs: 300_000,
      maxConcurrentSessions: 2,
      eventsWithoutSession: 1
    },
    sessionIntervals: [
      sessionIntervalFixture(),
      sessionIntervalFixture({
        source: 'claude',
        sessionIdHash: 'hashed-session-beta',
        startedAt: '2026-06-07T10:02:00.000Z',
        endedAt: '2026-06-07T10:12:00.000Z',
        lastSeen: '2026-06-07T10:12:00.000Z',
        events: 4,
        messageCount: 4,
        totalTokens: 2000,
        estimatedCostUsd: null,
        knownEstimatedCostUsd: null,
        unknownCostEvents: 4,
        unknownCostTokens: 2000,
        activeDurationMs: 300_000,
        wallDurationMs: 600_000
      })
    ],
    privacy: { sanitized: true }
  };

  return { ...baseDashboard, ...dashboardOverrides, totals, top };
};

export const populatedSnapshot = (
  overrides: DashboardOverrides = {}
): DesktopDashboardSnapshot => ({
  status: 'ready',
  dashboard: dashboardFixture(overrides),
  privacy: { sanitized: true }
});

export const installTokenwatchApi = ({
  exportReport = vi.fn(async () => ({
    format: 'json',
    fileName: 'tokenwatch-share.json',
    bytesWritten: 0,
    status: 'cancelled'
  })),
  getSnapshot = vi.fn(async () => setupSnapshot()),
  refresh = vi.fn(async () => setupSnapshot()),
  getStatus = vi.fn(async () => appStatus('setup-needed')),
  getVersion = vi.fn(async () => '0.1.0')
}: TokenwatchApiOverrides = {}): TokenwatchApiOverrides => {
  const tokenwatchApi: TokenWatchDesktopApi = Object.freeze({
    dashboard: Object.freeze({ getSnapshot, refresh }),
    app: Object.freeze({ getStatus, getVersion }),
    share: Object.freeze({ exportReport })
  });
  Object.defineProperty(window, 'tokenwatch', {
    configurable: true,
    value: tokenwatchApi
  });
  return { exportReport, getSnapshot, refresh, getStatus, getVersion };
};
