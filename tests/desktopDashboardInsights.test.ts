import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { BudgetThresholdsRepository } from '../src/db/repositories/budgetThresholds.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { desktopDashboardFiltersSchema } from '../src/desktop/shared/contracts.js';
import { dashboardInsightsSchema } from '../src/desktop/shared/dashboardAnalyticsContracts.js';
import { BudgetService } from '../src/services/budgetService.js';
import { DesktopDashboardService } from '../src/services/desktopDashboard.js';
import { createTempDb, createTestEvent } from './helpers.js';
import { assertJsonOutputPrivacy } from './privacyOutput.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  vi.useRealTimers();
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

function createDashboardService(): {
  readonly budget: BudgetService;
  readonly usageEvents: UsageEventsRepository;
  readonly service: DesktopDashboardService;
} {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  const usageEvents = new UsageEventsRepository(db);
  const scanRuns = new ScanRunsRepository(db);
  const budgetThresholds = new BudgetThresholdsRepository(db);
  const budget = new BudgetService(budgetThresholds, usageEvents);
  const pricingModels = new PricingModelsRepository(db);
  const service = new DesktopDashboardService({
    budget,
    pricingModels,
    scanRuns,
    usageEvents
  });
  return { budget, usageEvents, service };
}

describe('desktop dashboard insights and trends DTO', () => {
  it('publishes sanitized read-only insights and trend cards', () => {
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'));
    const { budget, usageEvents, service } = createDashboardService();
    budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 0.2 });
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-07-09T12:00:00.000Z',
        model: 'safe-model-alpha',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 20,
        reasoningTokens: 10,
        totalTokens: 150,
        estimatedCostUsd: 0.4
      })
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.insights).toMatchObject({
      window: '7d',
      cards: {
        totals: {
          events: 1,
          tokens: 150,
          estimatedCostUsd: 0.4,
          knownEstimatedCostUsd: 0.4,
          unknownCostEvents: 0,
          unknownCostTokens: 0
        }
      },
      privacy: { sanitized: true }
    });
    expect(dashboard.trends).toMatchObject({
      trendScope: 'all-events-rolling',
      label: 'all-events rolling trend',
      privacy: { sanitized: true }
    });
    expect(dashboard.trends.windows.map((window) => window.window)).toEqual(['7d', '30d']);
    expect(dashboard.trends.windows[0]?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'tokens', trendScope: 'all-events-rolling' }),
        expect.objectContaining({ metric: 'cost', trendScope: 'all-events-rolling' })
      ])
    );
    expect(dashboard.insights.cards.budgetPressure).toMatchObject({
      status: 'over',
      ratio: 2,
      knownSpendUsd: 0.4,
      thresholdUsd: 0.2
    });
    expect(dashboard.trends.windows.map((window) => window.budgetPressure)).toEqual([
      expect.objectContaining({ status: 'over', ratio: 2 }),
      expect.objectContaining({ status: 'over', ratio: 2 })
    ]);
    assertJsonOutputPrivacy({ insights: dashboard.insights, trends: dashboard.trends });
  });

  it('keeps rolling trend windows all-events scoped when dashboard filters clip totals', () => {
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'));
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-07-09T12:00:00.000Z',
        rawIdHash: 'current-window-event',
        totalTokens: 90,
        inputTokens: 60,
        outputTokens: 30,
        estimatedCostUsd: 0.9
      }),
      createTestEvent({
        timestamp: '2026-07-02T12:00:00.000Z',
        rawIdHash: 'previous-window-event',
        totalTokens: 30,
        inputTokens: 20,
        outputTokens: 10,
        estimatedCostUsd: 0.3
      })
    ]);
    const filters = desktopDashboardFiltersSchema.parse({ from: '2026-07-09', to: '2026-07-09' });

    const dashboard = service.buildDashboard({ filters });

    const sevenDayTrend = dashboard.trends.windows.find((window) => window.window === '7d');
    expect(dashboard.totals).toMatchObject({ events: 1, tokens: 90 });
    expect(dashboard.usageSeries).toHaveLength(1);
    expect(dashboard.insights.cards.totals).toMatchObject({ events: 1, tokens: 90 });
    expect(sevenDayTrend?.totals.current).toMatchObject({ events: 1, tokens: 90 });
    expect(sevenDayTrend?.totals.previous).toMatchObject({ events: 1, tokens: 30 });
    expect(sevenDayTrend?.trendScope).toBe('all-events-rolling');
  });

  it('uses strict unknown-cost semantics for dashboard and card aggregates', () => {
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'));
    const { usageEvents, service } = createDashboardService();
    usageEvents.insertMany([
      createTestEvent({
        timestamp: '2026-07-09T12:00:00.000Z',
        model: 'mixed-cost-model',
        totalTokens: 100,
        inputTokens: 60,
        outputTokens: 40,
        estimatedCostUsd: 1.25
      }),
      {
        ...createTestEvent({
          timestamp: '2026-07-09T13:00:00.000Z',
          model: 'mixed-cost-model',
          totalTokens: 50,
          inputTokens: 30,
          outputTokens: 20
        }),
        estimatedCostUsd: null
      }
    ]);

    const dashboard = service.buildDashboard();

    expect(dashboard.totals).toMatchObject({
      estimatedCostUsd: null,
      knownEstimatedCostUsd: 1.25,
      unknownCostEvents: 1,
      unknownCostTokens: 50
    });
    expect(dashboard.byModel[0]).toMatchObject({
      estimatedCostUsd: null,
      knownEstimatedCostUsd: 1.25,
      unknownCostEvents: 1,
      unknownCostTokens: 50
    });
    expect(dashboard.insights.cards.totals).toMatchObject({
      estimatedCostUsd: null,
      knownEstimatedCostUsd: 1.25,
      unknownCostEvents: 1,
      unknownCostTokens: 50
    });
  });

  it('rejects unsafe desktop insight labels through the central output-label schema', () => {
    const { service } = createDashboardService();
    const dashboard = service.buildDashboard();

    expect(() =>
      dashboardInsightsSchema.parse({
        ...dashboard.insights,
        topRows: {
          ...dashboard.insights.topRows,
          models: [
            {
              label: 'update usage_events set token = 1',
              events: 1,
              tokens: 1,
              inputTokens: 1,
              outputTokens: 0,
              cachedTokens: 0,
              reasoningTokens: 0,
              estimatedCostUsd: null,
              knownEstimatedCostUsd: null,
              unknownCostEvents: 0,
              unknownCostTokens: 0
            }
          ]
        }
      })
    ).toThrow('invalid_report_option');
  });
});
