import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScanRun } from '../src/models/scanRun.js';
import { AggregatorService } from '../src/services/aggregator.js';
import type { BudgetEvaluation } from '../src/services/budgetService.js';
import { StatuslineService, renderStatuslineText } from '../src/services/statusline.js';
import { App } from '../src/tui/App.js';
import { createFileTuiDataCache, readTuiDataCache } from '../src/tui/cache.js';
import {
  OverviewDashboard,
  overviewLayoutMode,
  overviewPrimaryLines,
  overviewSecondaryLines
} from '../src/tui/components/OverviewDashboard.js';
import { localMinuteBucket, localMonthBucket } from '../src/utils/time.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';
import { assertNoForbiddenOutput } from './privacyOutput.js';

// allow: SIZE_OK - existing focused Ink aggregation suite;
// Todo 8 only strengthens Activity coverage.

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('aggregation and TUI', () => {
  it('groups by sourceName and exposes unknown pricing', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({ sourceName: 'local' }),
      createTestEvent({
        timestamp: '2026-05-30T01:00:00.000Z',
        sourceName: 'lab-server',
        model: 'unknown-fixture-model',
        rawIdHash: 'unknown-row',
        estimatedCostUsd: null
      })
    ];

    expect(aggregator.summarize(events).sourceNameCount).toBe(2);
    expect(
      aggregator
        .group(events, 'sourceName')
        .map((group) => group.key)
        .sort()
    ).toEqual(['lab-server', 'local']);
    expect(aggregator.unknownPricing(events)).toHaveLength(1);
  });

  it('groups events across local month boundaries', () => {
    const aggregator = new AggregatorService();
    const mayTimestamp = new Date(2026, 4, 31, 23, 30).toISOString();
    const juneTimestamp = new Date(2026, 5, 1, 0, 30).toISOString();
    const events = [
      createTestEvent({ timestamp: mayTimestamp, rawIdHash: 'may-row', totalTokens: 100 }),
      createTestEvent({ timestamp: juneTimestamp, rawIdHash: 'june-row', totalTokens: 200 })
    ];

    expect(localMonthBucket(mayTimestamp)).toBe('2026-05');
    expect(localMonthBucket(juneTimestamp)).toBe('2026-06');
    expect(aggregator.group(events, 'month').map((group) => group.key)).toEqual([
      '2026-06',
      '2026-05'
    ]);
    expect(aggregator.buildTuiData(events, []).byMonth.map((group) => group.key)).toEqual([
      '2026-05',
      '2026-06'
    ]);
  });

  it('exposes deterministic empty TUI data for balanced parity views', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData([], []);

    expect(data.usageRows).toEqual([]);
    expect(data.minutelyBuckets).toEqual([]);
    expect(data.insightsRows).toEqual([]);
    expect(data.trendRows).toEqual([]);
    expect(data.agentRows).toEqual([]);
    expect(data.statsSummary).toEqual({
      eventCount: 0,
      totalTokens: 0,
      averageTokensPerEvent: 0,
      cacheHitRate: 0,
      cacheHitRatePercent: '0.00%',
      topAgent: null,
      topModel: null,
      topSource: null,
      topSourceName: null,
      estimatedTotalCostUsd: null,
      cost: 'unknown'
    });
    expect(data.statsRows).toEqual([
      { stat: 'events', value: 0 },
      { stat: 'total tokens', value: 0 },
      { stat: 'average tokens per event', value: 0 },
      { stat: 'cache hit rate', value: '0.00%' },
      { stat: 'top agent', value: 'none' },
      { stat: 'top model', value: 'none' },
      { stat: 'top source', value: 'none' },
      { stat: 'top sourceName', value: 'none' },
      { stat: 'estimated cost', value: 'unknown' }
    ]);
    expect(containsPrivacySentinel(data)).toBe(false);
  });

  it('exposes sanitized populated TUI data for balanced parity views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00.000Z'));
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);

    expect(data.usageRows[0]).toEqual({
      timestamp: '2026-05-30T00:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      inputTokens: 100,
      outputTokens: 40,
      cachedTokens: 10,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalTokens: 150,
      estimatedCostUsd: 0.01,
      cost: '$0.010000'
    });
    expect(data.minutelyBuckets).toEqual([
      expect.objectContaining({
        minute: localMinuteBucket('2026-05-30T00:00:00.000Z'),
        events: 1,
        inputTokens: 100,
        outputTokens: 40,
        cachedTokens: 10,
        totalTokens: 150,
        estimatedCostUsd: 0.01,
        cost: '$0.010000'
      }),
      expect.objectContaining({
        minute: localMinuteBucket('2026-05-30T00:01:00.000Z'),
        totalTokens: 275
      }),
      expect.objectContaining({
        minute: localMinuteBucket('2026-05-30T00:02:00.000Z'),
        totalTokens: 115
      })
    ]);
    expect(data.statsSummary).toEqual(
      expect.objectContaining({
        eventCount: 3,
        totalTokens: 540,
        averageTokensPerEvent: 180,
        cacheHitRate: 0.08536585,
        cacheHitRatePercent: '8.54%',
        topAgent: 'safe-agent-beta',
        topModel: 'gpt-5.5-careful',
        topSource: 'opencode',
        topSourceName: 'opencode-local',
        estimatedTotalCostUsd: 0.035,
        cost: '$0.035000'
      })
    );
    expect(data.statsRows).toContainEqual({ stat: 'average tokens per event', value: 180 });
    expect(data.statsRows).toContainEqual({ stat: 'cache hit rate', value: '8.54%' });
    expect(data.insightsRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'cache_hit_ratio',
          status: 'ok',
          tokens: 540,
          estimatedCostUsd: 0.035,
          knownEstimatedCostUsd: 0.035,
          unknownCostEvents: 0,
          unknownCostTokens: 0
        })
      ])
    );
    expect(data.trendRows).toEqual(expect.any(Array));
    expect(data.agentRows).toEqual([
      expect.objectContaining({
        agent: 'safe-agent-beta',
        events: 1,
        inputTokens: 200,
        outputTokens: 60,
        cachedTokens: 15,
        totalTokens: 275,
        topModel: 'gpt-5.5-careful'
      }),
      expect.objectContaining({
        agent: 'safe-agent-alpha',
        events: 2,
        inputTokens: 175,
        outputTokens: 70,
        cachedTokens: 20,
        totalTokens: 265,
        topModel: 'gpt-5.5-fast'
      })
    ]);
    expect(containsPrivacySentinel(data)).toBe(false);
  });

  it('keeps primitive Overview rows deterministic and sanitized for KPI fixture data', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(data.overviewRows).toEqual([
      { metric: 'Today', value: '1 event', detail: '1000 tokens, $0.100000' },
      { metric: 'This Week', value: '2 events', detail: '3000 tokens, $0.300000' },
      { metric: 'This Month', value: '3 events', detail: '6000 tokens, $0.300000' },
      { metric: 'Budget', value: 'not configured', detail: '0 thresholds' },
      { metric: 'Unknown pricing', value: '1 event', detail: '3000 tokens' },
      { metric: 'Top model', value: 'claude-sonnet-4', detail: 'by total tokens' },
      { metric: 'Top source', value: 'opencode', detail: 'by total tokens' },
      { metric: 'Top sourceName', value: 'lab-server', detail: 'by total tokens' }
    ]);
    expect(containsPrivacySentinel(data.overviewRows)).toBe(false);
  });

  it('defines Overview dashboard period KPIs with known and unknown pricing confidence', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(containsPrivacySentinel(data)).toBe(false);
    expect(data).toMatchObject({
      overviewDashboard: {
        today: {
          totalTokens: 1000,
          knownEstimatedCostUsd: 0.1,
          unknownCostEvents: 0
        },
        thisWeek: {
          totalTokens: 3000,
          knownEstimatedCostUsd: 0.3,
          unknownCostEvents: 0
        },
        thisMonth: {
          totalTokens: 6000,
          knownEstimatedCostUsd: 0.3,
          unknownCostEvents: 1
        },
        total: {
          totalTokens: 10000,
          knownEstimatedCostUsd: 0.7,
          unknownCostEvents: 1
        },
        budget: { status: 'not_configured' }
      }
    });
  });

  it('defines Overview dashboard top labels and unknown pricing aggregate', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(containsPrivacySentinel(data)).toBe(false);
    expect(data).toMatchObject({
      overviewDashboard: {
        topSource: { label: 'opencode', totalTokens: 5000 },
        topSourceName: { label: 'lab-server', totalTokens: 5000 },
        topModel: { label: 'claude-sonnet-4', totalTokens: 5000 },
        unknownPricing: { eventCount: 1, totalTokens: 3000 }
      }
    });
  });

  it.each([
    {
      label: 'not configured',
      budgets: [],
      expectedStatus: 'not_configured'
    },
    {
      label: 'exceeded',
      budgets: [createOverviewBudgetEvaluation({ knownSpendUsd: 1, thresholdUsd: 1 })],
      expectedStatus: 'exceeded'
    },
    {
      label: 'unknown',
      budgets: [
        createOverviewBudgetEvaluation({
          knownSpendUsd: 0.1,
          thresholdUsd: 1,
          unknownCostEventCount: 1,
          unknownCostTokenCount: 3000
        })
      ],
      expectedStatus: 'unknown'
    },
    {
      label: 'warning',
      budgets: [createOverviewBudgetEvaluation({ knownSpendUsd: 0.8, thresholdUsd: 1 })],
      expectedStatus: 'warning'
    },
    {
      label: 'ok',
      budgets: [createOverviewBudgetEvaluation({ knownSpendUsd: 0.1, thresholdUsd: 1 })],
      expectedStatus: 'ok'
    }
  ] satisfies Array<{
    readonly label: string;
    readonly budgets: BudgetEvaluation[];
    readonly expectedStatus: 'not_configured' | 'exceeded' | 'unknown' | 'warning' | 'ok';
  }>)(
    'defines Overview dashboard budget status as $expectedStatus when $label',
    ({ budgets, expectedStatus }) => {
      const aggregator = new AggregatorService();
      const data = aggregator.buildTuiData(
        createOverviewKpiFixtureEvents(),
        [],
        undefined,
        budgets,
        {},
        { now: new Date('2026-06-17T12:00:00.000Z') }
      );

      expect(data).toMatchObject({
        overviewDashboard: { budget: { status: expectedStatus } }
      });
    }
  );

  it('selects the first monthly total row as the Overview dashboard primary budget', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [
        createOverviewBudgetEvaluation({ sourceName: 'other-budget', knownSpendUsd: 0.1 }),
        createOverviewBudgetEvaluation({
          scopeKind: 'monthly_total',
          sourceName: null,
          knownSpendUsd: 0.4
        }),
        createOverviewBudgetEvaluation({
          scopeKind: 'monthly_total',
          sourceName: null,
          knownSpendUsd: 0.9
        })
      ],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(data).toMatchObject({
      overviewDashboard: {
        budget: {
          primary: {
            scopeKind: 'monthly_total',
            knownSpendUsd: 0.4,
            thresholdUsd: 1,
            progress: { label: '40%' }
          }
        }
      }
    });
  });

  it('falls back to the first canonical row when no monthly total budget exists', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [
        createOverviewBudgetEvaluation({
          sourceName: 'first-fallback-budget',
          knownSpendUsd: 0.25
        }),
        createOverviewBudgetEvaluation({ sourceName: 'second-budget', knownSpendUsd: 0.85 })
      ],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(data).toMatchObject({
      overviewDashboard: {
        budget: {
          primary: {
            scopeKind: 'sourceName',
            sourceName: 'first-fallback-budget',
            knownSpendUsd: 0.25,
            thresholdUsd: 1,
            progress: { label: '25%' }
          }
        }
      }
    });
  });

  it('keeps unknown pricing visible and semantically unknown in the Overview dashboard', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(data).toMatchObject({
      overviewDashboard: {
        budget: { status: 'not_configured' },
        unknownPricing: {
          eventCount: 1,
          totalTokens: 3000,
          estimatedCostUsd: null,
          costLabel: 'unknown'
        }
      }
    });
    const dashboard = JSON.stringify(data);
    expect(dashboard).not.toContain('$0.00');
    expect(dashboard.toLowerCase()).not.toContain('free');
    expect(dashboard.toLowerCase()).not.toContain('zero');
    expect(dashboard.toLowerCase()).not.toContain('no cost');
    expect(containsPrivacySentinel(data)).toBe(false);
  });

  it('renders seeded data, help, and sanitized current-view export', async () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({ metadata: { parser: 'test', prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' } }),
      createTestEvent({
        timestamp: '2026-05-30T01:00:00.000Z',
        model: 'unknown-fixture-model',
        rawIdHash: 'unknown-row',
        estimatedCostUsd: null
      })
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(events, []);
    const app = render(
      <App
        loadData={() => data}
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/private/raw/path/tokenwatch-current-view.json';
        }}
      />
    );

    expect(app.lastFrame()).toContain('Overview');
    expect(app.lastFrame()).toContain('Theme: blue');
    expect(app.lastFrame()).toContain('Shell: blue shell');
    expect(app.lastFrame()).toContain('Refresh: manual');
    expect(containsPrivacySentinel(app.lastFrame())).toBe(false);

    app.stdin.write('?');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('> Help'));

    app.stdin.write('e');
    expect(exported).toHaveLength(1);
    await vi.waitFor(() =>
      expect(app.lastFrame()).toContain(
        'Exported Help current view (0 rows) to tokenwatch-current-view.json'
      )
    );
    expect(app.lastFrame()).not.toContain('/private/raw/path');
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
  });

  it('exports Help when navigation and export arrive before the next render', () => {
    const data = new AggregatorService().buildTuiData([createTestEvent()], []);
    const exported: Array<{ viewKey: string; rows: unknown[] }> = [];
    const app = render(
      <App
        loadData={() => data}
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    app.stdin.write('?');
    app.stdin.write('e');

    expect(exported).toEqual([{ viewKey: 'help', rows: [] }]);
  });

  it('renders selected TUI theme and refresh labels', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData([], []);
    const app = render(
      <App
        loadData={() => data}
        settings={{ theme: 'amber', autoRefreshEnabled: true, autoRefreshMs: 120000 }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    expect(app.lastFrame()).toContain('Theme: amber');
    expect(app.lastFrame()).toContain('Shell: amber shell');
    expect(app.lastFrame()).toContain('Refresh: auto 120000ms');
    expect(app.lastFrame()).toContain('Cache: live');
    expect(containsPrivacySentinel(app.lastFrame())).toBe(false);
  });

  it('renders statusline footer from the shared service and updates it on refresh', async () => {
    const aggregator = new AggregatorService();
    const statusline = new StatuslineService();
    const firstEvents = [
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        rawIdHash: 'statusline-first-row',
        totalTokens: 100,
        estimatedCostUsd: 0.01
      })
    ];
    const nextEvents = [
      ...firstEvents,
      {
        ...createTestEvent({
          timestamp: '2026-05-30T00:01:00.000Z',
          rawIdHash: 'statusline-second-row',
          totalTokens: 250,
          metadata: { parser: 'test', prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
        }),
        estimatedCostUsd: null
      }
    ];
    const now = new Date('2026-05-30T12:00:00.000Z');
    let refreshCount = 0;
    const app = render(
      <App
        loadData={() => {
          refreshCount += 1;
          return aggregator.buildTuiData(refreshCount === 1 ? firstEvents : nextEvents, []);
        }}
        loadStatusline={() =>
          statusline.build(refreshCount <= 1 ? firstEvents : nextEvents, { window: 'today', now })
        }
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    expect(normalizedFrame(app.lastFrame())).toContain(
      renderStatuslineText(statusline.build(firstEvents, { window: 'today', now }))
    );
    expect(normalizedFrame(app.lastFrame())).not.toContain('/min');
    expect(normalizedFrame(app.lastFrame())).not.toContain('compact | today');

    app.stdin.write('r');

    await vi.waitFor(() =>
      expect(normalizedFrame(app.lastFrame())).toContain(
        renderStatuslineText(statusline.build(nextEvents, { window: 'today', now }))
      )
    );
    expect(normalizedFrame(app.lastFrame())).toContain('cost unknown');
    expect(containsPrivacySentinel(app.lastFrame())).toBe(false);
  });

  it('renders recent scan runs details and export with bounded v2 fields', () => {
    const aggregator = new AggregatorService();
    const run: ScanRun = {
      id: 'run-id',
      startedAt: '2026-05-30T00:00:00.000Z',
      finishedAt: '2026-05-30T00:01:00.000Z',
      sourceName: 'local',
      parserName: 'codex',
      pathKind: 'custom',
      status: 'failed',
      discoveredFiles: 1,
      parsedEvents: 1,
      insertedEvents: 1,
      duplicateEvents: 0,
      conflictEvents: 0,
      skippedRecords: 0,
      rejectedRecords: 1,
      errorRecords: 1,
      warningCodes: ['privacy_rejected'],
      errorCode: 'invalid_canonical_field'
    };
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData([], [run]);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="runs"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    expect(app.lastFrame()).toContain('Recent Scan Runs');
    expect(app.lastFrame()).toContain('failed');

    expect(app.lastFrame()).toContain('path_kind: custom');
    expect(app.lastFrame()).toContain('code: invalid_canonical_field');

    app.stdin.write('e');
    expect(exported).toHaveLength(1);
    expect(containsPrivacySentinel(exported)).toBe(false);
    expect(JSON.stringify(exported)).not.toContain('error_message');
  });

  it('renders monthly, sessions, and session metrics views with sanitized rows', () => {
    const aggregator = new AggregatorService();
    const aprilTimestamp = new Date(2026, 3, 30, 23, 0).toISOString();
    const mayTimestamp = new Date(2026, 4, 1, 0, 30).toISOString();
    const events = [
      createTestEvent({
        timestamp: aprilTimestamp,
        sessionIdHash: 'hashed-session-alpha',
        rawIdHash: 'raw-row-one',
        totalTokens: 120,
        pricingSource: 'bundled',
        pricingConfidence: 'exact'
      }),
      createTestEvent({
        timestamp: mayTimestamp,
        sessionIdHash: 'hashed-session-alpha',
        rawIdHash: 'raw-row-two',
        totalTokens: 200,
        pricingSource: 'bundled',
        pricingConfidence: 'exact'
      }),
      createTestEvent({
        timestamp: '2026-05-01T01:00:00.000Z',
        sessionIdHash: null,
        rawIdHash: 'raw-row-without-session',
        totalTokens: 80,
        estimatedCostUsd: null,
        pricingSource: 'unknown',
        pricingConfidence: 'none'
      })
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(events, []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="monthly"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    const monthlyFrame = app.lastFrame() ?? '';
    expect(monthlyFrame).toContain('Monthly Usage');
    expect(monthlyFrame.indexOf('2026-04')).toBeLessThan(monthlyFrame.indexOf('2026-05'));
    expect(monthlyFrame).toContain('key: 2026-04');
    expect(containsPrivacySentinel(monthlyFrame)).toBe(false);

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'monthly',
        rows: expect.arrayContaining([expect.objectContaining({ key: '2026-04' })])
      }
    ]);
    expect(containsPrivacySentinel(exported)).toBe(false);

    const sessionsApp = render(
      <App
        loadData={() => data}
        initialViewKey="sessions"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );
    expect(sessionsApp.lastFrame()).toContain('Sessions');
    expect(sessionsApp.lastFrame()).toContain('hashed-session-alpha');
    expect(sessionsApp.lastFrame()).not.toContain('raw-row-two');
    expect(containsPrivacySentinel(sessionsApp.lastFrame())).toBe(false);

    const metricsApp = render(
      <App
        loadData={() => data}
        initialViewKey="sessionMetrics"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );
    expect(metricsApp.lastFrame()).toContain('Session Metrics');
    expect(metricsApp.lastFrame()).toContain('session_count');
    expect(metricsApp.lastFrame()).toContain('events_without_session');
    expect(metricsApp.lastFrame()).toContain('1');
    expect(containsPrivacySentinel(metricsApp.lastFrame())).toBe(false);
  });

  it('uses an explicit idle gap for TUI session metrics while defaulting otherwise', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        sessionIdHash: 'hash-tui-gap',
        rawIdHash: 'tui-gap-row-1'
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:03:00.000Z',
        sessionIdHash: 'hash-tui-gap',
        rawIdHash: 'tui-gap-row-2'
      })
    ];

    expect(aggregator.buildTuiData(events, []).sessionMetrics.totalActiveDurationMs).toBe(180_000);
    expect(aggregator.buildTuiData(events, [], 179_999).sessionMetrics.totalActiveDurationMs).toBe(
      0
    );
  });

  it('defines sanitized Tokscale-style session intervals grouped by source and session hash', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(createSessionIntervalFixtureEvents(), [], 180_000);
    const sessions = data.sessions as Array<Record<string, unknown>>;

    expect(sessions).toHaveLength(3);
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'codex',
          sessionIdHash: 'shared-session-hash',
          wallDurationMs: 480_000,
          activeDurationMs: 180_000,
          messageCount: 3,
          inputTokens: 600,
          outputTokens: 60,
          cachedTokens: 6,
          reasoningTokens: 15,
          totalTokens: 666,
          estimatedCostUsd: 0.06
        }),
        expect.objectContaining({
          source: 'opencode',
          sessionIdHash: 'shared-session-hash',
          wallDurationMs: 60_000,
          activeDurationMs: 60_000,
          messageCount: 2,
          inputTokens: 900,
          outputTokens: 90,
          cachedTokens: 9,
          reasoningTokens: 0,
          totalTokens: 999,
          estimatedCostUsd: 0.09
        }),
        expect.objectContaining({
          source: 'codex',
          sessionIdHash: 'beta-session-hash',
          wallDurationMs: 120_000,
          activeDurationMs: 120_000,
          messageCount: 2,
          inputTokens: 110,
          outputTokens: 11,
          cachedTokens: 1,
          reasoningTokens: 2,
          totalTokens: 124,
          estimatedCostUsd: 0.011
        })
      ])
    );
    expect(sessions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK' })
      ])
    );
    expect(containsPrivacySentinel(sessions)).toBe(false);
  });

  it('defines Tokscale-style session time metrics, concurrency, and no-session counts', () => {
    const aggregator = new AggregatorService();
    const metrics = aggregator.buildTuiData(createSessionIntervalFixtureEvents(), [], 180_000)
      .sessionMetrics as Record<string, unknown>;

    expect(metrics).toMatchObject({
      sessionCount: 3,
      totalWallDurationMs: 660_000,
      totalActiveDurationMs: 360_000,
      longestContinuousMs: 240_000,
      maxConcurrentSessions: 3,
      eventsWithoutSession: 1
    });
  });

  it('preserves session and concurrency metrics through the TUI cache round trip', () => {
    const temp = createTempDb();
    try {
      const aggregator = new AggregatorService();
      const data = aggregator.buildTuiData(createSessionIntervalFixtureEvents(), [], 180_000);
      const cachePath = join(temp.dir, 'tui-cache.json');
      const cache = createFileTuiDataCache(cachePath);

      cache.write(data);
      const cachedData = readTuiDataCache(cachePath);

      expect(cachedData?.sessionMetrics).toMatchObject({
        sessionCount: 3,
        totalWallDurationMs: 660_000,
        totalActiveDurationMs: 360_000,
        longestContinuousMs: 240_000,
        maxConcurrentSessions: 3,
        eventsWithoutSession: 1
      });
      expect(typeof cachedData?.sessionMetrics.longestContinuousMs).toBe('number');
      expect(typeof cachedData?.sessionMetrics.maxConcurrentSessions).toBe('number');
      expect(JSON.stringify(cachedData)).not.toContain('rawIdHash');
      expect(containsPrivacySentinel(cachedData)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('keeps interval and concurrency TUI frames and exports sanitized primitives', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(createSessionIntervalFixtureEvents(), [], 180_000);
    data.sessions = data.sessions.map((session) =>
      session.source === 'codex' && session.sessionIdHash === 'shared-session-hash'
        ? { ...session, workspaceLabel: 'lab-a100', workspaceHash: 'workspace-hash-safe' }
        : session
    );
    const exported: unknown[] = [];
    const intervalsApp = render(
      <App
        loadData={() => data}
        initialViewKey="sessionIntervals"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    const intervalsFrame = intervalsApp.lastFrame() ?? '';
    expect(intervalsFrame).toContain('Session Intervals');
    expect(intervalsFrame).toContain('session_id_hash');
    expect(intervalsFrame).toContain('wall_duration_ms');
    expect(intervalsFrame).toContain('active_duration_ms');
    expect(intervalsFrame).toContain('message_count');
    expect(intervalsFrame).toContain('shared-session-hash');
    expect(intervalsFrame).not.toContain('RAW_SESSION_SENTINEL_DO_NOT_LEAK');
    expect(intervalsFrame).not.toContain('codex-alpha-');
    expect(containsPrivacySentinel(intervalsFrame)).toBe(false);

    intervalsApp.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'sessionIntervals',
        rows: expect.arrayContaining([
          expect.objectContaining({
            source: 'codex',
            session_id_hash: 'shared-session-hash',
            started_at: '2026-05-30T00:00:00.000Z',
            ended_at: '2026-05-30T00:08:00.000Z',
            wall_duration_ms: 480_000,
            active_duration_ms: 180_000,
            message_count: 3,
            total_tokens: 666,
            estimated_cost_usd: 0.06,
            workspace_label: 'lab-a100',
            workspace_hash: 'workspace-hash-safe'
          })
        ])
      }
    ]);
    expectExportedPrimitiveRows(exported[0]);
    expect(JSON.stringify(exported[0])).not.toContain('rawIdHash');
    expect(JSON.stringify(exported[0])).not.toContain('metadata');
    expect(containsPrivacySentinel(exported)).toBe(false);

    const concurrencyApp = render(
      <App
        loadData={() => data}
        initialViewKey="concurrency"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );
    const concurrencyFrame = concurrencyApp.lastFrame() ?? '';
    expect(concurrencyFrame).toContain('Concurrency');
    expect(concurrencyFrame).toContain('session_count');
    expect(concurrencyFrame).toContain('max_concurrent_sessions');
    expect(concurrencyFrame).toContain('longest_continuous_duration_ms');
    expect(concurrencyFrame).toContain('total_active_duration_ms');
    expect(concurrencyFrame).toContain('total_wall_duration_ms');
    expect(concurrencyFrame).toContain('events_without_session');
    expect(containsPrivacySentinel(concurrencyFrame)).toBe(false);

    concurrencyApp.stdin.write('e');
    expect(exported.at(-1)).toEqual({
      viewKey: 'concurrency',
      rows: [
        expect.objectContaining({
          session_count: 3,
          max_concurrent_sessions: 3,
          longest_continuous_duration_ms: 240_000,
          total_active_duration_ms: 360_000,
          total_wall_duration_ms: 660_000,
          events_without_session: 1
        })
      ]
    });
    expectExportedPrimitiveRows(exported.at(-1));
    expect(containsPrivacySentinel(exported)).toBe(false);
  });

  it('renders dashboard overview rows from shared aggregate data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    const aggregator = new AggregatorService();
    const budgets: BudgetEvaluation[] = [
      {
        scopeKind: 'monthly_total',
        sourceName: null,
        month: '2026-06',
        knownSpendUsd: 0.4,
        thresholdUsd: 1,
        status: 'ok',
        unknownCostEventCount: 0,
        unknownCostTokenCount: 0,
        warningRows: []
      }
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(createTuiDashboardFixtureEvents(), [], undefined, budgets);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="overview"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/private/raw/path/tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Overview');
    expect(frame).toContain('Today');
    expect(frame).toContain('This Week');
    expect(frame).toContain('This Month');
    expect(frame).toContain('Budget');
    expect(frame).toContain('Unknown pricing');
    expect(frame).toContain('Top model');
    expect(frame).toContain('Top source');
    expect(frame).toContain('Top sourceName');
    expect(frame).toContain('ok');
    expect(frame).toContain('1 event');
    expect(frame).toContain('2 events');
    expect(frame).not.toContain('$0.00');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'overview',
        rows: expect.arrayContaining([
          expect.objectContaining({ metric: 'Today' }),
          expect.objectContaining({ metric: 'Budget', value: 'ok' }),
          expect.objectContaining({ metric: 'Unknown pricing' })
        ])
      }
    ]);
    expectExportedPrimitiveRows(exported[0]);
    await vi.waitFor(() => expect(app.lastFrame()).toContain('to tokenwatch-current-view.json'));
    expect(app.lastFrame()).not.toContain('/private/raw/path');
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
    assertNoForbiddenOutput([app.lastFrame(), exported]);
  });

  it('renders terminal-safe Overview dashboard component lines from the dashboard DTO', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(
      createOverviewKpiFixtureEvents(),
      [],
      undefined,
      [
        createOverviewBudgetEvaluation({
          scopeKind: 'monthly_total',
          sourceName: null,
          knownSpendUsd: 0.4
        })
      ],
      {},
      { now: new Date('2026-06-17T12:00:00.000Z') }
    );

    expect(overviewPrimaryLines(data.overviewDashboard).map((line) => line.label)).toEqual([
      'Today',
      'This Week',
      'This Month',
      'Budget'
    ]);
    expect(overviewSecondaryLines(data.overviewDashboard).map((line) => line.label)).toEqual([
      'Total',
      'Top source',
      'Top sourceName',
      'Top model',
      'Unknown pricing'
    ]);

    const app = render(<OverviewDashboard dashboard={data.overviewDashboard} theme="blue" />);

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Primary KPIs');
    expect(frame).toContain('Secondary Signals');
    expect(frame).toContain('Today');
    expect(frame).toContain('This Week');
    expect(frame).toContain('This Month');
    expect(frame).toContain('Total');
    expect(frame).toContain('Budget');
    expect(frame).toContain('Top source');
    expect(frame).toContain('Top sourceName');
    expect(frame).toContain('Top model');
    expect(frame).toContain('Unknown pricing');
    expect(frame).toContain('1000 tokens');
    expect(frame).toContain('3000 tokens');
    expect(frame).toContain('6000 tokens');
    expect(frame).toContain('10000 tokens');
    expect(frame).toContain('$0.100000');
    expect(frame).toContain('$0.300000');
    expect(frame).toContain('$0.700000 + unknown');
    expect(frame).toContain('progress 40%');
    expect(frame).toContain('unknown pricing 1 event');
    expect(frame).toContain('opencode');
    expect(frame).toContain('lab-server');
    expect(frame).toContain('claude-sonnet-4');
    expect(frame).not.toContain('$0.00');
    expect(frame.toLowerCase()).not.toContain('free');
    expect(frame.toLowerCase()).not.toContain('zero');
    expect(frame.toLowerCase()).not.toContain('no cost');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);
  });

  it('renders dedicated Overview dashboard KPI values from the dashboard DTO', () => {
    const data = createOverviewKpiTuiData();
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="overview"
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Overview');
    expect(frame).toContain('Today');
    expect(frame).toContain('This Week');
    expect(frame).toContain('This Month');
    expect(frame).toContain('Total');
    expect(frame).toContain('Budget');
    expect(frame).toContain('Top source');
    expect(frame).toContain('Top sourceName');
    expect(frame).toContain('Top model');
    expect(frame).toContain('Unknown pricing');
    expect(frame).toContain('1000');
    expect(frame).toContain('3000');
    expect(frame).toContain('6000');
    expect(frame).toContain('10000');
    expect(frame).toContain('$0.100000');
    expect(frame).toContain('$0.300000');
    expect(frame).toContain('$0.700000');
    expect(frame).toContain('unknown');
    expect(frame).toContain('1 event');
    expect(frame).toContain('opencode');
    expect(frame).toContain('lab-server');
    expect(frame).toContain('claude-sonnet-4');
    expect(frame).not.toContain('$0.00');
    expect(frame.toLowerCase()).not.toContain('free');
    expect(frame.toLowerCase()).not.toContain('zero');
    expect(frame.toLowerCase()).not.toContain('no cost');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);
  });

  it('exports Overview current view as sanitized primitive rows with a safe basename', async () => {
    const data = createOverviewKpiTuiData();
    const exported: unknown[] = [];
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="overview"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/private/raw/path/tokenwatch-current-view.json';
        }}
      />
    );

    app.stdin.write('e');

    expect(exported).toEqual([{ viewKey: 'overview', rows: createOverviewPrimitiveRows() }]);
    expectExportedPrimitiveRows(exported[0]);
    await vi.waitFor(() => expect(app.lastFrame()).toContain('tokenwatch-current-view.json'));
    expect(app.lastFrame()).toContain('Exported Overview current view (8 rows)');
    expect(app.lastFrame()).not.toContain('/private/raw/path');
    expect(JSON.stringify(exported)).not.toContain('overviewDashboard');
    expect(JSON.stringify(exported)).not.toContain('metadata');
    expect(JSON.stringify(exported)).not.toContain('rawIdHash');
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
    assertNoForbiddenOutput([app.lastFrame(), exported]);
  });

  it('renders Overview details from sanitized primitive rows', () => {
    const data = createOverviewKpiTuiData();
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="overview"
        initialDetails
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Details');
    expect(frame).toContain('metric: Today');
    expect(frame).toContain('value: 1 event');
    expect(frame).toContain('detail: 1000 tokens, $0.100000');
    expect(frame).not.toContain('overviewDashboard');
    expect(frame).not.toContain('metadata');
    expect(frame).not.toContain('rawIdHash');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);
  });

  it('preserves Overview cache labels and privacy while refreshing dashboard data', async () => {
    vi.useFakeTimers();
    const cachedData = createOverviewKpiTuiData({ totalTokens: 10000 });
    const liveData = createOverviewKpiTuiData({ totalTokens: 11000 });
    const writes: unknown[] = [];
    const app = render(
      <App
        loadData={() => liveData}
        initialViewKey="overview"
        cache={{
          read: () => cachedData,
          write: (data) => writes.push(data)
        }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    const cachedFrame = app.lastFrame() ?? '';
    expect(cachedFrame).toContain('Cache: warm');
    expect(cachedFrame).toContain('Total');
    expect(cachedFrame).toContain('10000');
    expect(containsPrivacySentinel(cachedFrame)).toBe(false);

    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Cache: refreshed'));

    const refreshedFrame = app.lastFrame() ?? '';
    expect(refreshedFrame).toContain('Refresh: just now');
    expect(refreshedFrame).toContain('Refresh: manual');
    expect(refreshedFrame).toContain('Total');
    expect(refreshedFrame).toContain('11000');
    expect(writes).toHaveLength(1);
    expect(containsPrivacySentinel([refreshedFrame, writes])).toBe(false);
    assertNoForbiddenOutput([refreshedFrame, writes]);
  });

  it.each([
    { mode: 'wide', width: 120 },
    { mode: 'medium', width: 80 },
    { mode: 'narrow', width: 50 }
  ] satisfies Array<{ readonly mode: 'wide' | 'medium' | 'narrow'; readonly width: number }>)(
    'renders deterministic Overview $mode layout at $width columns without dropping KPI content',
    ({ mode, width }) => {
      const frame = renderOverviewAtWidth(width);

      expect(overviewLayoutMode(width)).toBe(mode);
      expectNoHorizontalOverflow(frame, width);
      expectOverviewResponsiveContent(frame);
      expect(frame.toLowerCase()).not.toContain('sparkline');
      expect(containsPrivacySentinel(frame)).toBe(false);
      assertNoForbiddenOutput(frame);
    }
  );

  it('preserves labels, units, estimated markers, budget, and unknown pricing in narrow Overview mode', () => {
    const frame = renderOverviewAtWidth(50);
    const normalized = normalizedFrame(frame);

    for (const label of [
      'Today',
      'This Week',
      'This Month',
      'Total',
      'Budget',
      'Top source',
      'Top sourceName',
      'Top model',
      'Unknown pricing'
    ] as const) {
      expect(normalized).toContain(label);
    }
    for (const value of ['1000', '3000', '6000', '10000'] as const) {
      expect(normalized).toContain(value);
    }
    for (const estimatedCost of ['$0.100000', '$0.300000', '$0.700000'] as const) {
      expect(normalized).toContain(estimatedCost);
    }
    expect(normalized).toContain('tokens');
    expect(normalized).toContain('not configured');
    expect(normalized).toContain('unknown');
    expect(normalized).not.toContain('$0.00');
    expect(normalized.toLowerCase()).not.toContain('free');
    expect(normalized.toLowerCase()).not.toContain('zero');
    expect(normalized.toLowerCase()).not.toContain('no cost');
    expectNoHorizontalOverflow(frame, 50);
    expect(frame.toLowerCase()).not.toContain('sparkline');
  });

  it('renders budget status rows and exports canonical sanitized budget view data', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({ metadata: { parser: 'test', prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' } })
    ];
    const budgets: BudgetEvaluation[] = [
      {
        scopeKind: 'monthly_total',
        sourceName: null,
        month: '2026-05',
        knownSpendUsd: 2,
        thresholdUsd: 1,
        status: 'over',
        unknownCostEventCount: 1,
        unknownCostTokenCount: 50,
        warningRows: [
          { code: 'budget_threshold_exceeded', scopeKind: 'monthly_total', sourceName: null },
          { code: 'budget_unknown_cost_present', scopeKind: 'monthly_total', sourceName: null }
        ]
      },
      {
        scopeKind: 'sourceName',
        sourceName: 'lab-a100',
        month: '2026-05',
        knownSpendUsd: 0.25,
        thresholdUsd: 0.5,
        status: 'unknown-costs-present',
        unknownCostEventCount: 2,
        unknownCostTokenCount: 120,
        warningRows: [
          { code: 'budget_unknown_cost_present', scopeKind: 'sourceName', sourceName: 'lab-a100' }
        ]
      },
      {
        scopeKind: 'sourceName',
        sourceName: 'warn-source',
        month: '2026-05',
        knownSpendUsd: 0.85,
        thresholdUsd: 1,
        status: 'ok',
        unknownCostEventCount: 0,
        unknownCostTokenCount: 0,
        warningRows: []
      },
      {
        scopeKind: 'sourceName',
        sourceName: 'ok-source',
        month: '2026-05',
        knownSpendUsd: 0.1,
        thresholdUsd: 1,
        status: 'ok',
        unknownCostEventCount: 0,
        unknownCostTokenCount: 0,
        warningRows: []
      }
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(events, [], undefined, budgets);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="budgets"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Budget Status');
    expectNonOverviewPrimitiveFrame(frame);
    expect(frame).toContain('monthly_total');
    expect(frame).toContain('lab-a100');
    expect(frame).toContain('warn-source');
    expect(frame).toContain('ok-source');
    expect(frame).toContain('$2.000000');
    expect(frame).toContain('$1.000000');
    expect(frame).toContain('exceeded');
    expect(frame).toContain('unknown');
    expect(frame).toContain('warning');
    expect(frame).toContain('ok');
    expect(frame).toContain('200%');
    expect(frame).toContain('50% + unknown cost');
    expect(frame).toContain('85%');
    expect(frame).toContain('10%');
    expect(frame).toContain('budget_threshold_exceeded,budget_unknown_cost_present');
    expect(frame).toContain('50');
    expect(frame).toContain('120');
    expect(frame).toContain('month: 2026-05');
    expect(frame).toContain(
      'Enter details Space select r refresh e export ? help q quit Esc close'
    );
    expect(frame).not.toContain('$0.00');
    expect(frame.toLowerCase()).not.toContain('free');
    expect(frame.toLowerCase()).not.toContain('no cost');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'budgets',
        rows: [
          expect.objectContaining({
            scope: 'monthly_total',
            sourceName: 'all',
            known_spend: '$2.000000',
            threshold: '$1.000000',
            status: 'exceeded',
            progress: '#################### 200%',
            warnings: 'budget_threshold_exceeded,budget_unknown_cost_present',
            unknown_events: 1,
            unknown_tokens: 50,
            month: '2026-05'
          }),
          expect.objectContaining({
            scope: 'sourceName',
            sourceName: 'warn-source',
            status: 'warning',
            progress: '#################... 85%',
            unknown_events: 0,
            unknown_tokens: 0
          }),
          expect.objectContaining({
            scope: 'sourceName',
            sourceName: 'lab-a100',
            status: 'unknown',
            progress: '##########.......... 50% + unknown cost',
            unknown_events: 2,
            unknown_tokens: 120
          }),
          expect.objectContaining({
            scope: 'sourceName',
            sourceName: 'ok-source',
            status: 'ok',
            progress: '##.................. 10%',
            unknown_events: 0,
            unknown_tokens: 0
          })
        ]
      }
    ]);
    expect(JSON.stringify(exported)).not.toContain('rawIdHash');
    expect(JSON.stringify(exported)).not.toContain('metadata');
    expect(JSON.stringify(exported)).not.toContain('overviewDashboard');
    expect(JSON.stringify(exported)).not.toContain('$0.00');
    expect(JSON.stringify(exported).toLowerCase()).not.toContain('free');
    expect(JSON.stringify(exported).toLowerCase()).not.toContain('no cost');
    expect(containsPrivacySentinel(exported)).toBe(false);
    assertNoForbiddenOutput(exported);
  });

  it('renders activity heatmap rows and exports sanitized primitive activity data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    const aggregator = new AggregatorService();
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(
      createTuiDashboardFixtureEvents(),
      [],
      undefined,
      [],
      {},
      {
        heatmapMetric: 'cost',
        heatmapYear: 2026
      }
    );
    expect(data.heatmapReport).toMatchObject({
      year: 2026,
      metric: 'cost',
      totals: {
        events: 3,
        totalTokens: 530,
        estimatedCostUsd: 0.05,
        unknownCostEvents: 1
      },
      privacy: { sanitized: true }
    });
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="activity"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/private/raw/path/tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    const normalized = normalizedFrame(frame);
    expect(frame).toContain('Activity Heatmap');
    expectNonOverviewPrimitiveFrame(frame);
    expect(frame).toContain('year');
    expect(frame).toContain('2026');
    expect(frame).toContain('metric');
    expect(frame).toContain('cost');
    expect(normalized).toContain('events 3');
    expect(normalized).toContain('tokens 530');
    expect(normalized).toContain('cost 0.05');
    expect(frame).toContain('density legend');
    for (const legend of [
      ['No usage', '·'],
      ['Very low usage', '▁'],
      ['Low usage', '▂'],
      ['Medium usage', '▃'],
      ['High usage', '▅'],
      ['Peak usage', '█']
    ] as const) {
      expect(frame).toContain(legend[0]);
      expect(frame).toContain(legend[1]);
    }
    expect(frame).toContain('active days');
    expect(frame).toContain('3');
    expect(frame).toContain('unknown cost warning');
    expect(frame).toContain('unknown cost events present');
    expect(frame).toContain('1 events');
    expect(frame).toContain('Peak usage');
    expect(frame).toContain('Details');
    expect(frame).toContain('detail: 2026-01-01T00:00:00.000Z');
    expect(frame).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
    expect(frame).not.toContain('RESPONSE_SENTINEL_DO_NOT_LEAK');
    expect(frame).not.toContain('FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK');
    expect(frame).not.toContain('RAW_PATH_SENTINEL_DO_NOT_LEAK');
    expect(frame).not.toContain('RAW_RECORD_SENTINEL_DO_NOT_LEAK');
    expect(frame).not.toContain('$0.00');
    expect(frame).not.toContain('/private/raw/path');
    expectNoHorizontalOverflow(frame, 100);
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);

    app.stdin.write('e');
    await vi.waitFor(() =>
      expect(app.lastFrame()).toContain('Exported Activity Heatmap current view')
    );
    expect(exported).toEqual([
      {
        viewKey: 'activity',
        rows: expect.arrayContaining([
          expect.objectContaining({ section: 'summary', label: 'year', value: 2026 }),
          expect.objectContaining({ section: 'summary', label: 'metric', value: 'cost' }),
          expect.objectContaining({ section: 'summary', label: 'active days', value: 3 }),
          expect.objectContaining({
            section: 'summary',
            label: 'unknown cost warning',
            value: 'unknown cost events present',
            detail: '1 events'
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'No usage',
            value: '·',
            level: 0
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'Very low usage',
            value: '▁',
            level: 1
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'Low usage',
            value: '▂',
            level: 2
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'Medium usage',
            value: '▃',
            level: 3
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'High usage',
            value: '▅',
            level: 4
          }),
          expect.objectContaining({
            section: 'density legend',
            label: 'Peak usage',
            value: '█',
            level: 5
          })
        ])
      }
    ]);
    expectExportedPrimitiveRows(exported[0]);
    expect(JSON.stringify(exported)).not.toContain('rawIdHash');
    expect(JSON.stringify(exported)).not.toContain('metadata');
    expect(JSON.stringify(exported)).not.toContain('overviewDashboard');
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
    assertNoForbiddenOutput([app.lastFrame(), exported]);
  });

  it('exports pricing diagnostic statuses for sanitized match and fallback distinctions', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        model: 'exact-model',
        rawIdHash: 'exact-row',
        estimatedCostUsd: 0.01,
        pricingSource: 'litellm',
        pricingConfidence: 'exact',
        normalizedModel: 'exact-model'
      }),
      createTestEvent({
        model: 'alias-model',
        rawIdHash: 'alias-row',
        estimatedCostUsd: 0.02,
        pricingSource: 'openrouter',
        pricingConfidence: 'alias',
        normalizedModel: 'canonical-alias-model'
      }),
      createTestEvent({
        model: 'provider-prefix-model',
        rawIdHash: 'prefix-row',
        estimatedCostUsd: 0.03,
        pricingSource: 'litellm',
        pricingConfidence: 'provider-prefix',
        normalizedModel: 'provider-prefix-model'
      }),
      createTestEvent({
        provider: 'cursor',
        model: 'composer-2-fast',
        rawIdHash: 'cursor-row',
        estimatedCostUsd: 0.04,
        pricingSource: 'cursor',
        pricingConfidence: 'cursor-override',
        normalizedProvider: 'cursor',
        normalizedModel: 'composer-2-fast'
      }),
      createTestEvent({
        model: 'unresolved-model',
        rawIdHash: 'unresolved-row',
        estimatedCostUsd: null,
        pricingSource: 'unknown',
        pricingConfidence: 'none',
        normalizedModel: 'unresolved-model'
      }),
      createTestEvent({
        model: 'network-fallback-model',
        rawIdHash: 'network-row',
        estimatedCostUsd: null,
        pricingSource: 'unknown',
        pricingConfidence: 'none',
        normalizedModel: 'network-fallback-model'
      })
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(events, [], undefined, [], {
      lookupWarning: true,
      lookupCache: [
        {
          cacheKey: 'lookup:openai:unresolved-model',
          provider: 'openai',
          model: 'unresolved-model',
          matchedSource: 'unknown',
          matchedKey: null,
          confidence: 'none',
          inputPricePerMillion: null,
          outputPricePerMillion: null,
          cachedInputPricePerMillion: null,
          fetchedAt: '2026-06-03T00:00:00.000Z',
          updatedAt: '2026-06-03T00:00:00.000Z',
          noMatch: true
        }
      ]
    });
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="pricing"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'pricing',
        rows: expect.arrayContaining([
          expect.objectContaining({ model: 'exact-model', status: 'exact-match' }),
          expect.objectContaining({ model: 'alias-model', status: 'alias-match' }),
          expect.objectContaining({
            model: 'provider-prefix-model',
            status: 'provider-prefix-match'
          }),
          expect.objectContaining({ model: 'composer-2-fast', status: 'cursor-override' }),
          expect.objectContaining({ model: 'unresolved-model', status: 'negative-cache' }),
          expect.objectContaining({ model: 'network-fallback-model', status: 'network-fallback' })
        ])
      }
    ]);
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
  });

  it('renders improved unknown pricing details without treating missing cost as free', () => {
    const aggregator = new AggregatorService();
    const events = [
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
        rawIdHash: 'fuzzy-row',
        estimatedCostUsd: 0.04,
        pricingSource: 'litellm',
        pricingConfidence: 'fuzzy',
        normalizedProvider: 'anthropic',
        normalizedModel: 'claude-opus-4-6'
      })
    ];
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(events, [], undefined, [], {
      lookupCache: [
        {
          cacheKey: 'lookup:openai:unknown-fixture-model',
          provider: 'openai',
          model: 'unknown-fixture-model',
          matchedSource: 'unknown',
          matchedKey: null,
          confidence: 'none',
          inputPricePerMillion: null,
          outputPricePerMillion: null,
          cachedInputPricePerMillion: null,
          fetchedAt: '2026-06-03T00:00:00.000Z',
          updatedAt: '2026-06-03T00:00:00.000Z',
          noMatch: true
        },
        {
          cacheKey: 'lookup:anthropic:claude-opus-4-6-thinking-high',
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          matchedSource: 'litellm',
          matchedKey: 'litellm:anthropic:claude-opus-4-6',
          confidence: 'fuzzy',
          inputPricePerMillion: 15,
          outputPricePerMillion: 75,
          cachedInputPricePerMillion: null,
          fetchedAt: '2026-06-03T00:00:00.000Z',
          updatedAt: '2026-06-03T00:00:00.000Z',
          noMatch: false
        }
      ]
    });
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="pricing"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    expect(app.lastFrame()).toContain('Unknown Pricing');
    expect(app.lastFrame()).toContain('openai');
    expect(app.lastFrame()).toContain('unknown-fixture-model');
    expect(app.lastFrame()).toContain('status: negative-cache');
    expect(app.lastFrame()).toContain('cache_status: negative-cache');
    expect(app.lastFrame()).toContain('estimated_missing_cost: null');
    expect(app.lastFrame()).toContain('pricing_source: unknown');
    expect(app.lastFrame()).toContain('pricing_confidence: none');
    expect(app.lastFrame()).toContain('action: add custom price');
    expect(containsPrivacySentinel(app.lastFrame())).toBe(false);

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'pricing',
        rows: expect.arrayContaining([
          expect.objectContaining({
            provider: 'openai',
            model: 'unknown-fixture-model',
            occurrence_count: 1,
            status: 'negative-cache',
            estimated_missing_cost: null,
            pricing_source: 'unknown',
            pricing_confidence: 'none',
            cache_status: 'negative-cache',
            matched_key: 'none',
            action: 'add custom price'
          }),
          expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-opus-4-6-thinking-high',
            status: 'fuzzy-match',
            pricing_source: 'litellm',
            pricing_confidence: 'fuzzy',
            cache_status: 'matched-cache',
            matched_key: 'litellm:anthropic:claude-opus-4-6',
            action: 'confirm fuzzy match'
          })
        ])
      }
    ]);
    expect(JSON.stringify(exported)).not.toContain('"estimated_missing_cost":0');
    expect(JSON.stringify(exported)).not.toContain('free');
    expect(containsPrivacySentinel(exported)).toBe(false);
  });

  it('defines theme, refresh, and cache status markers without leaking private metadata', async () => {
    const aggregator = new AggregatorService();
    let loadCount = 0;
    const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => {
          loadCount += 1;
          return data;
        }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    const initialFrame = app.lastFrame() ?? '';
    expect(containsPrivacySentinel(initialFrame)).toBe(false);
    expect(initialFrame).toContain('Theme: blue');
    expect(initialFrame).toContain('Shell: blue shell');
    expect(initialFrame).toContain('Refresh: manual');
    expect(initialFrame).toContain('Cache: live');

    app.stdin.write('r');
    expect(loadCount).toBe(2);
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Refresh: just now'));
    const refreshedFrame = app.lastFrame() ?? '';
    expect(containsPrivacySentinel(refreshedFrame)).toBe(false);
    expect(refreshedFrame).toContain('Refresh: manual');
    expect(refreshedFrame).toContain('Cache: refreshed');
  });

  it('starts from a sanitized warm cache and refreshes live data after startup', async () => {
    vi.useFakeTimers();
    const aggregator = new AggregatorService();
    const cachedData = aggregator.buildTuiData([createTestEvent({ rawIdHash: 'cached-row' })], []);
    const liveData = aggregator.buildTuiData(
      [
        createTestEvent({ rawIdHash: 'live-row-1' }),
        createTestEvent({ rawIdHash: 'live-row-2', timestamp: '2026-05-30T00:01:00.000Z' })
      ],
      []
    );
    const writes: unknown[] = [];
    let loadCount = 0;
    const app = render(
      <App
        loadData={() => {
          loadCount += 1;
          return liveData;
        }}
        cache={{
          read: () => cachedData,
          write: (data) => writes.push(data)
        }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    const cachedFrame = app.lastFrame() ?? '';
    expect(loadCount).toBe(0);
    expect(cachedFrame).toContain('events 1');
    expect(cachedFrame).toContain('Cache: warm');
    expect(containsPrivacySentinel(cachedFrame)).toBe(false);

    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(app.lastFrame()).toContain('events 2'));
    const refreshedFrame = app.lastFrame() ?? '';
    expect(loadCount).toBe(1);
    expect(writes).toHaveLength(1);
    expect(refreshedFrame).toContain('events 2');
    expect(refreshedFrame).toContain('Refresh: just now');
    expect(refreshedFrame).toContain('Refresh: manual');
    expect(refreshedFrame).toContain('Cache: refreshed');
    expect(containsPrivacySentinel([refreshedFrame, writes])).toBe(false);
  });

  it('writes a sanitized cache snapshot after manual refresh', async () => {
    const aggregator = new AggregatorService();
    const firstData = aggregator.buildTuiData([createTestEvent({ rawIdHash: 'manual-row-1' })], []);
    const secondData = aggregator.buildTuiData(
      [
        createTestEvent({ rawIdHash: 'manual-row-1' }),
        createTestEvent({ rawIdHash: 'manual-row-2', timestamp: '2026-05-30T00:02:00.000Z' })
      ],
      []
    );
    const loads = [firstData, secondData];
    const writes: unknown[] = [];
    const app = render(
      <App
        loadData={() => loads.shift() ?? secondData}
        cache={{
          read: () => null,
          write: (data) => writes.push(data)
        }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    expect(app.lastFrame()).toContain('events 1');
    app.stdin.write('r');

    await vi.waitFor(() => expect(app.lastFrame()).toContain('events 2'));
    expect(app.lastFrame()).toContain('Cache: refreshed');
    expect(app.lastFrame()).toContain('Refresh: manual');
    expect(app.lastFrame()).toContain('Refresh: just now');
    expect(writes).toHaveLength(2);
    expect(JSON.stringify(writes)).not.toContain('rawIdHash');
    expect(containsPrivacySentinel(writes)).toBe(false);
  });

  it('auto-refreshes when enabled', async () => {
    const aggregator = new AggregatorService();
    const firstData = aggregator.buildTuiData([createTestEvent({ rawIdHash: 'auto-row-1' })], []);
    const secondData = aggregator.buildTuiData(
      [
        createTestEvent({ rawIdHash: 'auto-row-1' }),
        createTestEvent({ rawIdHash: 'auto-row-2', timestamp: '2026-05-30T00:03:00.000Z' })
      ],
      []
    );
    const loads = [firstData, secondData];
    const app = render(
      <App
        loadData={() => loads.shift() ?? secondData}
        settings={{ theme: 'green', autoRefreshEnabled: true, autoRefreshMs: 10 }}
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    expect(app.lastFrame()).toContain('Theme: green');
    expect(app.lastFrame()).toContain('Refresh: auto 10ms');
    expect(app.lastFrame()).toContain('events 1');

    await vi.waitFor(() => expect(app.lastFrame()).toContain('events 2'));
    expect(app.lastFrame()).toContain('Refresh: auto 10ms');
    expect(app.lastFrame()).toContain('Refresh: just now');
    expect(app.lastFrame()).toContain('Cache: refreshed');
    expect(containsPrivacySentinel(app.lastFrame())).toBe(false);
  });

  it('falls back to live data when the on-disk TUI cache is corrupt', () => {
    const temp = createTempDb();
    try {
      const cachePath = join(temp.dir, 'tui-data-cache.v1.json');
      writeFileSync(
        cachePath,
        `${JSON.stringify({ schemaVersion: 999, data: 'broken' })}\n`,
        'utf8'
      );
      const aggregator = new AggregatorService();
      const liveData = aggregator.buildTuiData([createTestEvent({ rawIdHash: 'corrupt-row' })], []);
      const app = render(
        <App
          loadData={() => liveData}
          cache={createFileTuiDataCache(cachePath)}
          onExportView={() => 'tokenwatch-current-view.json'}
        />
      );

      const frame = app.lastFrame() ?? '';
      expect(frame).toContain('events 1');
      expect(frame).toContain('Cache: live');
      expect(readTuiDataCache(cachePath)?.totals.totalEvents).toBe(1);
      expect(readFileSync(cachePath, 'utf8')).toContain('"schemaVersion": 2');
      expect(readFileSync(cachePath, 'utf8')).not.toContain('rawIdHash');
      expect(containsPrivacySentinel([frame, readFileSync(cachePath, 'utf8')])).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('falls back to live data when the on-disk TUI cache lacks Overview dashboard data', () => {
    const temp = createTempDb();
    try {
      const cachePath = join(temp.dir, 'tui-data-cache.v2.json');
      const aggregator = new AggregatorService();
      const cachedData = aggregator.buildTuiData(
        [createTestEvent({ rawIdHash: 'cached-legacy-row' })],
        []
      );
      const liveData = createOverviewKpiTuiData();
      const legacyData = { ...cachedData, overviewDashboard: undefined };
      writeFileSync(
        cachePath,
        JSON.stringify({
          kind: 'tokenwatch-tui-data-cache',
          schemaVersion: 2,
          savedAt: '2026-06-17T12:00:00.000Z',
          data: legacyData
        }),
        'utf8'
      );

      const app = render(
        <App
          loadData={() => liveData}
          initialViewKey="overview"
          cache={createFileTuiDataCache(cachePath)}
          onExportView={() => 'tokenwatch-current-view.json'}
        />
      );

      const frame = app.lastFrame() ?? '';
      expect(frame).toContain('Cache: live');
      expect(frame).toContain('Total');
      expect(frame).toContain('10000');
      expect(frame).not.toContain('cached-legacy-row');
      expect(containsPrivacySentinel([frame, readFileSync(cachePath, 'utf8')])).toBe(false);
      assertNoForbiddenOutput(frame);
    } finally {
      temp.cleanup();
    }
  });

  it.each(balancedParityTargetViews)(
    'defines sanitized %s TUI view frame and current-view export',
    async (_label, targetView) => {
      const aggregator = new AggregatorService();
      const exported: unknown[] = [];
      const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);
      const app = render(
        <App
          loadData={() => data}
          initialViewKey={targetView.key as never}
          onExportView={(viewKey, rows) => {
            exported.push({ viewKey, rows });
            return '/tmp/tokenwatch-current-view.json';
          }}
        />
      );

      const frame = app.lastFrame() ?? '';
      expectNonOverviewPrimitiveFrame(frame);
      expect(containsPrivacySentinel(frame)).toBe(false);

      app.stdin.write('e');
      expect(exported).toHaveLength(1);
      expectExportedPrimitiveRows(exported[0]);
      await vi.waitFor(() =>
        expect(app.lastFrame()).toContain(`Exported ${targetView.title} current view`)
      );
      expect(app.lastFrame()).toContain('to tokenwatch-current-view.json');
      expect(app.lastFrame()).not.toContain('/tmp/');
      expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);

      expect(frame).toContain(targetView.title);
      for (const column of targetView.columns) {
        expect(frame).toContain(column);
      }
      for (const visibleValue of targetView.visibleValues) {
        expect(frame).toContain(visibleValue);
      }
      for (const hiddenValue of targetView.hiddenValues) {
        expect(frame).not.toContain(hiddenValue);
      }
      expect(exported[0]).toEqual(
        expect.objectContaining({
          viewKey: targetView.key,
          rows: expect.arrayContaining([expect.objectContaining(targetView.exportRow)])
        })
      );
    }
  );

  it.each(balancedParityTargetViews)(
    'renders sanitized empty %s TUI view frame and empty current-view export',
    (_label, targetView) => {
      const aggregator = new AggregatorService();
      const exported: unknown[] = [];
      const data = aggregator.buildTuiData([], []);
      const app = render(
        <App
          loadData={() => data}
          initialViewKey={targetView.key}
          onExportView={(viewKey, rows) => {
            exported.push({ viewKey, rows });
            return 'tokenwatch-current-view.json';
          }}
        />
      );

      const frame = app.lastFrame() ?? '';
      expectNonOverviewPrimitiveFrame(frame);
      expect(frame).toContain(targetView.title);
      expect(frame).toContain('No usage events');
      expect(containsPrivacySentinel(frame)).toBe(false);

      app.stdin.write('e');
      expect(exported).toEqual([{ viewKey: targetView.key, rows: [] }]);
      expectExportedPrimitiveRows(exported[0]);
      expect(containsPrivacySentinel(exported)).toBe(false);
    }
  );

  it.each(balancedParityTargetViews)(
    'opens sanitized %s TUI details for the selected row',
    (_label, targetView) => {
      const aggregator = new AggregatorService();
      const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);
      const app = render(
        <App
          loadData={() => data}
          initialViewKey={targetView.key}
          initialDetails
          onExportView={() => 'tokenwatch-current-view.json'}
        />
      );

      const frame = app.lastFrame() ?? '';
      expectNonOverviewPrimitiveFrame(frame);
      expect(frame).toContain('Details');
      for (const detailValue of targetView.detailValues) {
        expect(frame).toContain(detailValue);
      }
      expect(containsPrivacySentinel(frame)).toBe(false);
    }
  );

  it('cycles sortable columns with s and displays the selected sort label deterministically', async () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(createSortableFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="model"
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    app.stdin.write('s');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Sort: model ↑'));
    const sortedFrame = app.lastFrame() ?? '';
    expect(containsPrivacySentinel(sortedFrame)).toBe(false);
    expect(sortedFrame).toContain('Sort: model ↑');
    expect(sortedFrame.indexOf('alpha-model')).toBeLessThan(sortedFrame.indexOf('zeta-model'));
  });

  it('reverses the active sort direction with S and updates visible order', async () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData(createSortableFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="model"
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );

    app.stdin.write('s');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Sort: model ↑'));
    app.stdin.write('S');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Sort: model ↓'));
    const reversedFrame = app.lastFrame() ?? '';
    expect(containsPrivacySentinel(reversedFrame)).toBe(false);
    expect(reversedFrame).toContain('Sort: model ↓');
    expect(reversedFrame.indexOf('zeta-model')).toBeLessThan(reversedFrame.indexOf('alpha-model'));
  });

  it('sorts details and current-view export by the visible row order', async () => {
    const aggregator = new AggregatorService();
    const exported: Array<{ viewKey: string; rows: Array<Record<string, unknown>> }> = [];
    const data = aggregator.buildTuiData(createSortableFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="model"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    const defaultFrame = app.lastFrame() ?? '';
    expect(defaultFrame).toContain('Sort: total ↓');
    expect(defaultFrame).toContain('key: zeta-model');
    expect(defaultFrame.indexOf('zeta-model')).toBeLessThan(defaultFrame.indexOf('alpha-model'));

    app.stdin.write('s');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Sort: model ↑'));
    const sortedFrame = app.lastFrame() ?? '';
    expect(sortedFrame).toContain('Sort: model ↑');
    expect(sortedFrame).toContain('key: alpha-model');
    expect(sortedFrame.indexOf('alpha-model')).toBeLessThan(sortedFrame.indexOf('zeta-model'));

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'model',
        rows: [
          expect.objectContaining({ key: 'alpha-model' }),
          expect.objectContaining({ key: 'zeta-model' })
        ]
      }
    ]);
    expect(containsPrivacySentinel([sortedFrame, exported])).toBe(false);
  });

  it('preserves the keyboard contract while documenting balanced parity shortcuts in help', () => {
    const aggregator = new AggregatorService();
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="monthly"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return 'tokenwatch-current-view.json';
        }}
      />
    );

    app.stdin.write('\u001B[C');
    expect(app.lastFrame()).toContain('Daily Usage');
    app.stdin.write('\u001B[D');
    expect(app.lastFrame()).toContain('Monthly Usage');
    app.stdin.write('\u001B[B');
    app.stdin.write('\u001B[A');
    expect(() => app.stdin.write(' ')).not.toThrow();
    expect(app.lastFrame()).toContain('Space select');
    expect(app.lastFrame()).toContain('Enter details');
    for (const command of footerReportCommandFragments) {
      expect(app.lastFrame()).toContain(command);
    }
    expect(() => app.stdin.write('r')).not.toThrow();
    expect(app.lastFrame()).toContain('r refresh');
    app.stdin.write('e');
    expect(exported).toHaveLength(1);
    expectExportedPrimitiveRows(exported[0]);
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);

    expect(app.lastFrame()).toContain('? help');
    const helpApp = render(
      <App
        loadData={() => data}
        initialViewKey="help"
        onExportView={() => 'tokenwatch-current-view.json'}
      />
    );
    const helpFrame = helpApp.lastFrame() ?? '';
    expect(helpFrame).toContain('↑ / ↓ move row');
    expect(helpFrame).toContain('← / → change view');
    expect(helpFrame).toContain('Enter open details');
    expect(helpFrame).toContain('Space toggle selection');
    expect(helpFrame).toContain('r refresh live data and cache');
    expect(helpFrame).toContain('e export current view rows only');
    expect(helpFrame).toContain('? open help');
    expect(helpFrame).toContain('q quit');
    expect(helpFrame).toContain('Esc close details');
    expect(helpFrame).toContain('s cycle sort column');
    expect(helpFrame).toContain('S reverse sort direction');
    expect(helpFrame).toContain('Usage, Minutely Usage, Stats, Insights, Trends, and Agents');
    expect(helpFrame).toContain('Budget Status shows ok, warning, exceeded, and unknown rows');
    expect(helpFrame).toContain(
      'Activity Heatmap shows year, metric, density legend, and active-day summary'
    );
    expect(helpFrame).toContain('Heatmap JSON: heatmap --json');
    expect(helpFrame).toContain('Reports shows command guidance');
    expect(helpFrame).toContain('Insights JSON: insights --window 7d --json');
    expect(helpFrame).toContain('Optimize report: optimize --window 30d');
    for (const command of reportCommandFragments) {
      expect(helpFrame).toContain(command);
    }
    expect(helpFrame).toContain('Theme shows the active terminal theme');
    expect(helpFrame).toContain('Refresh shows manual or auto interval');
    expect(helpFrame).toContain('Cache shows live, warm, or refreshed data source');
    expect(helpFrame).toContain('Default footer uses the standard statusline text');
    expect(helpFrame).toContain('Statusline compact preset: statusline --preset compact');
    expect(helpFrame).toContain('Statusline live JSON: statusline --preset live --json');
    expect(helpFrame).toContain('Export writes the sorted current view');
    expect(helpFrame).toContain('primitive fields only');
    expect(helpFrame).toContain('without raw paths, prompts, responses');
    expect(helpFrame).toContain('credentials, or raw records');
    expect(helpFrame).toContain('Status shows view, row count, and file name only');
    expect(containsPrivacySentinel(helpFrame)).toBe(false);
    app.stdin.write('q');
  });

  it('renders sanitized reports command guidance with current TUI data availability', async () => {
    const aggregator = new AggregatorService();
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(createBalancedParityFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="reports"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/private/raw/path/tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Reports');
    for (const command of reportCommandFragments) {
      expect(frame).toContain(command);
    }
    expect(frame).toContain('usage data available');
    expect(frame).toContain('year summary available');
    expect(frame).toContain('source status available');
    expect(frame).toContain('live provider probe');
    expect(frame).toContain('input file or stdin');
    expect(containsPrivacySentinel(frame)).toBe(false);

    app.stdin.write('e');
    expect(exported).toEqual([
      {
        viewKey: 'reports',
        rows: expect.arrayContaining([
          expect.objectContaining({ report: 'graph', command: 'graph --json; graph --out' }),
          expect.objectContaining({ report: 'wrapped', command: 'wrapped --year' }),
          expect.objectContaining({
            report: 'insights',
            command: 'insights --window 7d --json'
          }),
          expect.objectContaining({
            report: 'optimize',
            command: 'optimize --window 30d'
          }),
          expect.objectContaining({ report: 'doctor sources', command: 'doctor --sources' }),
          expect.objectContaining({ report: 'usage provider', command: 'usage --provider' }),
          expect.objectContaining({ report: 'headless codex', command: 'headless codex --input' })
        ])
      }
    ]);
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Exported Reports current view'));
    expect(app.lastFrame()).toContain('to tokenwatch-current-view.json');
    expect(app.lastFrame()).not.toContain('/private/raw/path');
    expectExportedPrimitiveRows(exported[0]);
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
  });

  it('renders Insights view and exports sanitized primitive insight rows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    const aggregator = new AggregatorService();
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(createTuiInsightsTrendFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="insights"
        initialDetails
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/tmp/tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Insights');
    expect(frame).toContain('cache_hit_ratio');
    expect(frame).toContain('unknown_pricing_impact');
    expect(frame).toContain('Details');
    expect(frame).toContain('estimated_cost_usd: null');
    expect(frame).not.toContain('/tmp/');
    expect(frame).not.toContain('$0.00');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);

    app.stdin.write('e');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Exported Insights current view'));
    expect(exported).toEqual([
      {
        viewKey: 'insights',
        rows: expect.arrayContaining([
          expect.objectContaining({
            metric: 'unknown_pricing_impact',
            status: 'warning',
            tokens: 620,
            estimated_cost_usd: null,
            known_estimated_cost_usd: 0.04,
            unknown_cost_events: 1,
            unknown_cost_tokens: 320,
            warning: 'unknown_pricing_present'
          })
        ])
      }
    ]);
    expectExportedPrimitiveRows(exported[0]);
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
    assertNoForbiddenOutput([app.lastFrame(), exported]);
  });

  it('renders Trends view and exports sorted sanitized primitive trend rows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    const aggregator = new AggregatorService();
    const exported: unknown[] = [];
    const data = aggregator.buildTuiData(createTuiInsightsTrendFixtureEvents(), []);
    const app = render(
      <App
        loadData={() => data}
        initialViewKey="trends"
        onExportView={(viewKey, rows) => {
          exported.push({ viewKey, rows });
          return '/tmp/tokenwatch-current-view.json';
        }}
      />
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Trends');
    expect(frame).toContain('total tokens');
    expect(frame).toContain('up');
    expect(frame).not.toContain('/tmp/');
    expect(frame).not.toContain('$0.00');
    expect(containsPrivacySentinel(frame)).toBe(false);
    assertNoForbiddenOutput(frame);

    app.stdin.write('e');
    await vi.waitFor(() => expect(app.lastFrame()).toContain('Exported Trends current view'));
    expect(exported).toEqual([
      {
        viewKey: 'trends',
        rows: expect.arrayContaining([
          expect.objectContaining({
            category: 'total',
            metric: 'total tokens',
            status: 'up',
            current: 620,
            previous: 180,
            delta: 440,
            absolute_delta: 440,
            tokens: 620,
            estimated_cost_usd: null,
            known_estimated_cost_usd: 0.04,
            unknown_cost_events: 1,
            unknown_cost_tokens: 320
          })
        ])
      }
    ]);
    const rows = (exported[0] as { rows: Array<{ absolute_delta: number; metric: string }> }).rows;
    expect(rows[0]).toEqual(expect.objectContaining({ metric: 'total tokens' }));
    expectExportedPrimitiveRows(exported[0]);
    expect(containsPrivacySentinel([app.lastFrame(), exported])).toBe(false);
    assertNoForbiddenOutput([app.lastFrame(), exported]);
  });

  it('renders safe no-data states for Insights and Trends views', () => {
    const aggregator = new AggregatorService();
    const data = aggregator.buildTuiData([], []);

    for (const targetView of ['insights', 'trends'] as const) {
      const exported: unknown[] = [];
      const app = render(
        <App
          loadData={() => data}
          initialViewKey={targetView}
          onExportView={(viewKey, rows) => {
            exported.push({ viewKey, rows });
            return 'tokenwatch-current-view.json';
          }}
        />
      );

      const frame = app.lastFrame() ?? '';
      expect(frame).toContain(targetView === 'insights' ? 'Insights' : 'Trends');
      expect(frame).toContain('No usage events');
      expect(frame).not.toContain('$0.00');
      expect(containsPrivacySentinel(frame)).toBe(false);
      app.stdin.write('e');
      expect(exported).toEqual([{ viewKey: targetView, rows: [] }]);
      expectExportedPrimitiveRows(exported[0]);
      expect(containsPrivacySentinel(exported)).toBe(false);
      assertNoForbiddenOutput([frame, exported]);
    }
  });
});

const reportCommandFragments = [
  'graph --json',
  'graph --out',
  'heatmap --json',
  'wrapped --year',
  'insights --window 7d --json',
  'optimize --window 30d',
  'doctor --sources',
  'usage --provider',
  'headless codex --input'
] as const;

const footerReportCommandFragments = [
  'graph --json',
  'graph --out',
  'heatmap --json',
  'wrapped --year',
  'doctor --sources',
  'usage --provider',
  'headless codex --input'
] as const;

const balancedParityTargetViews = [
  [
    'usage',
    {
      key: 'usage',
      title: 'Usage',
      columns: [
        'timestamp',
        'source',
        'source_name',
        'agent',
        'model',
        'input_tokens',
        'output_tokens',
        'cached_tokens',
        'total_tokens',
        'cost'
      ],
      visibleValues: [
        '2026-05-30T00:00:00.000Z',
        'codex-cli',
        'safe-agent-alpha',
        'gpt-5.5-fast',
        '$0.010000'
      ],
      hiddenValues: ['raw-usage-alpha', 'PROMPT_SENTINEL_DO_NOT_LEAK'],
      exportRow: {
        timestamp: '2026-05-30T00:00:00.000Z',
        source: 'codex',
        source_name: 'codex-cli',
        agent: 'safe-agent-alpha',
        model: 'gpt-5.5-fast',
        input_tokens: 100,
        output_tokens: 40,
        cached_tokens: 10,
        total_tokens: 150,
        cost: '$0.010000'
      },
      detailValues: ['timestamp: 2026-05-30T00:01:00.000Z', 'source_name: opencode-local']
    }
  ],
  [
    'minutely',
    {
      key: 'minutely',
      title: 'Minutely Usage',
      columns: ['minute', 'events', 'input', 'output', 'cached', 'total', 'cost'],
      visibleValues: [
        localMinuteBucket('2026-05-30T00:00:00.000Z'),
        localMinuteBucket('2026-05-30T00:01:00.000Z'),
        '150',
        '275'
      ],
      hiddenValues: ['raw-minutely-beta', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'],
      exportRow: {
        minute: localMinuteBucket('2026-05-30T00:00:00.000Z'),
        events: 1,
        input: 100,
        output: 40,
        cached: 10,
        total: 150,
        cost: '$0.010000'
      },
      detailValues: [`minute: ${localMinuteBucket('2026-05-30T00:00:00.000Z')}`, 'total: 150']
    }
  ],
  [
    'stats',
    {
      key: 'stats',
      title: 'Stats',
      columns: ['stat', 'value'],
      visibleValues: ['average tokens per event', 'cache hit rate', 'top agent', 'safe-agent-beta'],
      hiddenValues: ['raw-stats-gamma', 'RESPONSE_SENTINEL_DO_NOT_LEAK'],
      exportRow: { stat: 'average tokens per event', value: 180 },
      detailValues: ['stat: events', 'value: 3']
    }
  ],
  [
    'agents',
    {
      key: 'agents',
      title: 'Agents',
      columns: ['agent', 'events', 'input', 'output', 'cached', 'total', 'cost', 'top_model'],
      visibleValues: ['safe-agent-alpha', 'safe-agent-beta', 'gpt-5.5-fast'],
      hiddenValues: ['raw-agent-alpha', 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK'],
      exportRow: {
        agent: 'safe-agent-alpha',
        events: 2,
        input: 175,
        output: 70,
        cached: 20,
        total: 265,
        top_model: 'gpt-5.5-fast'
      },
      detailValues: ['agent: safe-agent-beta', 'top_model: gpt-5.5-careful']
    }
  ]
] as const;

function expectNonOverviewPrimitiveFrame(frame: string) {
  expect(frame).not.toContain('Primary KPIs');
  expect(frame).not.toContain('Secondary Signals');
}

function createBalancedParityFixtureEvents() {
  return [
    createTestEvent({
      timestamp: '2026-05-30T00:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'raw-usage-alpha',
      sessionIdHash: 'session-alpha-hash',
      inputTokens: 100,
      outputTokens: 40,
      cachedTokens: 10,
      totalTokens: 150,
      estimatedCostUsd: 0.01,
      metadata: {
        parser: 'test',
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
        path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createTestEvent({
      timestamp: '2026-05-30T00:01:00.000Z',
      source: 'opencode',
      sourceName: 'opencode-local',
      agent: 'safe-agent-beta',
      model: 'gpt-5.5-careful',
      rawIdHash: 'raw-minutely-beta',
      sessionIdHash: 'session-beta-hash',
      inputTokens: 200,
      outputTokens: 60,
      cachedTokens: 15,
      totalTokens: 275,
      estimatedCostUsd: 0.02,
      metadata: { parser: 'test', apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK' }
    }),
    createTestEvent({
      timestamp: '2026-05-30T00:02:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'raw-agent-alpha',
      sessionIdHash: 'session-alpha-hash',
      inputTokens: 75,
      outputTokens: 30,
      cachedTokens: 10,
      totalTokens: 115,
      estimatedCostUsd: 0.005,
      metadata: { parser: 'test', credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK' }
    })
  ];
}

function createSortableFixtureEvents() {
  return [
    createTestEvent({
      model: 'zeta-model',
      rawIdHash: 'sort-zeta-row',
      totalTokens: 300,
      inputTokens: 220,
      outputTokens: 70,
      cachedTokens: 10
    }),
    createTestEvent({
      model: 'alpha-model',
      rawIdHash: 'sort-alpha-row',
      totalTokens: 100,
      inputTokens: 60,
      outputTokens: 30,
      cachedTokens: 10,
      metadata: { parser: 'test', prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
    })
  ];
}

function createTuiInsightsTrendFixtureEvents() {
  return [
    createTestEvent({
      timestamp: '2026-06-14T00:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'tui-insight-current-known',
      inputTokens: 220,
      outputTokens: 60,
      cachedTokens: 20,
      reasoningTokens: 10,
      totalTokens: 300,
      estimatedCostUsd: 0.04,
      metadata: {
        parser: 'test',
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
        oauth: 'FAKE_OAUTH_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createTestEvent({
      timestamp: '2026-06-14T01:00:00.000Z',
      source: 'opencode',
      sourceName: 'opencode-local',
      agent: 'safe-agent-beta',
      model: 'unknown-fixture-model',
      rawIdHash: 'tui-insight-current-unknown',
      inputTokens: 240,
      outputTokens: 70,
      cachedTokens: 10,
      reasoningTokens: 0,
      totalTokens: 320,
      estimatedCostUsd: null,
      metadata: {
        parser: 'test',
        response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
        credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK',
        rawRecord: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createTestEvent({
      timestamp: '2026-06-07T00:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'tui-insight-previous-known',
      inputTokens: 120,
      outputTokens: 40,
      cachedTokens: 20,
      totalTokens: 180,
      estimatedCostUsd: 0.02,
      metadata: {
        parser: 'test',
        path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
        sql: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK',
        stack: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK at trend (/tmp/raw.ts:1:2)'
      }
    })
  ];
}

function createTuiDashboardFixtureEvents() {
  return [
    createTestEvent({
      timestamp: '2026-06-15T09:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'dashboard-known-row',
      inputTokens: 100,
      outputTokens: 25,
      cachedTokens: 5,
      totalTokens: 130,
      estimatedCostUsd: 0.04,
      metadata: {
        parser: 'test',
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
        path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createTestEvent({
      timestamp: '2026-06-12T09:00:00.000Z',
      source: 'opencode',
      sourceName: 'opencode-local',
      agent: 'safe-agent-beta',
      model: 'unknown-fixture-model',
      rawIdHash: 'dashboard-unknown-row',
      inputTokens: 200,
      outputTokens: 50,
      cachedTokens: 10,
      totalTokens: 260,
      estimatedCostUsd: null,
      metadata: {
        parser: 'test',
        credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK',
        rawRecord: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createTestEvent({
      timestamp: '2026-05-20T09:00:00.000Z',
      source: 'codex',
      sourceName: 'codex-cli',
      agent: 'safe-agent-alpha',
      model: 'gpt-5.5-fast',
      rawIdHash: 'dashboard-previous-month-row',
      totalTokens: 90,
      estimatedCostUsd: 0.01,
      metadata: { parser: 'test', sql: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK' }
    })
  ];
}

function createOverviewKpiFixtureEvents() {
  const unknownCostEvent = createTestEvent({
    timestamp: '2026-06-03T10:00:00.000Z',
    source: 'opencode',
    sourceName: 'lab-server',
    agent: 'opencode',
    model: 'claude-sonnet-4',
    rawIdHash: 'overview-kpi-event-c',
    inputTokens: 2500,
    outputTokens: 500,
    cachedTokens: 0,
    totalTokens: 3000,
    metadata: {
      parser: 'test',
      prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
      response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
      apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
      oauth: 'FAKE_OAUTH_SENTINEL_DO_NOT_LEAK',
      credential: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK',
      path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
      rawRecord: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK',
      sessionId: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'
    }
  });
  return [
    createTestEvent({
      timestamp: '2026-06-17T09:00:00.000Z',
      source: 'codex',
      sourceName: 'local',
      agent: 'codex',
      model: 'gpt-5.5-fast',
      rawIdHash: 'overview-kpi-event-a',
      inputTokens: 700,
      outputTokens: 300,
      cachedTokens: 0,
      totalTokens: 1000,
      estimatedCostUsd: 0.1
    }),
    createTestEvent({
      timestamp: '2026-06-16T10:00:00.000Z',
      source: 'opencode',
      sourceName: 'lab-server',
      agent: 'opencode',
      model: 'claude-sonnet-4',
      rawIdHash: 'overview-kpi-event-b',
      inputTokens: 1500,
      outputTokens: 500,
      cachedTokens: 0,
      totalTokens: 2000,
      estimatedCostUsd: 0.2
    }),
    { ...unknownCostEvent, estimatedCostUsd: null },
    createTestEvent({
      timestamp: '2026-05-20T10:00:00.000Z',
      source: 'cursor',
      sourceName: 'workstation',
      agent: 'cursor',
      model: 'gpt-5.5-fast',
      rawIdHash: 'overview-kpi-event-d',
      inputTokens: 3000,
      outputTokens: 1000,
      cachedTokens: 0,
      totalTokens: 4000,
      estimatedCostUsd: 0.4
    })
  ];
}

function createOverviewKpiTuiData(overrides: { readonly totalTokens?: number } = {}) {
  const aggregator = new AggregatorService();
  const data = aggregator.buildTuiData(
    createOverviewKpiFixtureEvents(),
    [],
    undefined,
    [],
    {},
    { now: new Date('2026-06-17T12:00:00.000Z') }
  );
  return {
    ...data,
    overviewRows: createOverviewPrimitiveRows(),
    overviewDashboard: {
      today: {
        label: 'Today',
        eventCount: 1,
        totalTokens: 1000,
        knownEstimatedCostUsd: 0.1,
        costLabel: '$0.100000',
        unknownCostEvents: 0
      },
      thisWeek: {
        label: 'This Week',
        eventCount: 2,
        totalTokens: 3000,
        knownEstimatedCostUsd: 0.3,
        costLabel: '$0.300000',
        unknownCostEvents: 0
      },
      thisMonth: {
        label: 'This Month',
        eventCount: 3,
        totalTokens: 6000,
        knownEstimatedCostUsd: 0.3,
        costLabel: '$0.300000 + unknown',
        unknownCostEvents: 1
      },
      total: {
        label: 'Total',
        eventCount: 4,
        totalTokens: overrides.totalTokens ?? 10000,
        knownEstimatedCostUsd: 0.7,
        costLabel: '$0.700000 + unknown',
        unknownCostEvents: 1
      },
      budget: {
        label: 'Budget',
        status: 'not_configured',
        statusLabel: 'not configured',
        detail: '0 thresholds'
      },
      topSource: { label: 'opencode', totalTokens: 5000 },
      topSourceName: { label: 'lab-server', totalTokens: 5000 },
      topModel: { label: 'claude-sonnet-4', totalTokens: 5000 },
      unknownPricing: {
        label: 'Unknown pricing',
        eventCount: 1,
        totalTokens: 3000,
        estimatedCostUsd: null,
        costLabel: 'unknown'
      }
    }
  };
}

function createOverviewPrimitiveRows() {
  return [
    { metric: 'Today', value: '1 event', detail: '1000 tokens, $0.100000' },
    { metric: 'This Week', value: '2 events', detail: '3000 tokens, $0.300000' },
    { metric: 'This Month', value: '3 events', detail: '6000 tokens, $0.300000' },
    { metric: 'Budget', value: 'not configured', detail: '0 thresholds' },
    { metric: 'Unknown pricing', value: '1 event', detail: '3000 tokens, unknown' },
    { metric: 'Top model', value: 'claude-sonnet-4', detail: '5000 tokens' },
    { metric: 'Top source', value: 'opencode', detail: '5000 tokens' },
    { metric: 'Top sourceName', value: 'lab-server', detail: '5000 tokens' }
  ];
}

function createOverviewBudgetEvaluation(
  overrides: Partial<BudgetEvaluation> = {}
): BudgetEvaluation {
  const scopeKind = overrides.scopeKind ?? 'sourceName';
  return {
    scopeKind,
    sourceName: overrides.sourceName ?? (scopeKind === 'monthly_total' ? null : 'overview-lab'),
    month: overrides.month ?? '2026-06',
    knownSpendUsd: overrides.knownSpendUsd ?? 0,
    thresholdUsd: overrides.thresholdUsd ?? 1,
    status: overrides.status ?? 'ok',
    unknownCostEventCount: overrides.unknownCostEventCount ?? 0,
    unknownCostTokenCount: overrides.unknownCostTokenCount ?? 0,
    warningRows: overrides.warningRows ?? []
  };
}

function createSessionIntervalFixtureEvents() {
  return [
    createSessionEvent('2026-05-30T00:00:00.000Z', {
      source: 'codex',
      sessionIdHash: 'shared-session-hash',
      rawIdHash: 'codex-alpha-1',
      inputTokens: 100,
      outputTokens: 10,
      cachedTokens: 1,
      reasoningTokens: 5,
      totalTokens: 111,
      estimatedCostUsd: 0.01,
      metadata: {
        parser: 'test',
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
        path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
        sessionId: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'
      }
    }),
    createSessionEvent('2026-05-30T00:03:00.000Z', {
      source: 'codex',
      sessionIdHash: 'shared-session-hash',
      rawIdHash: 'codex-alpha-2',
      inputTokens: 200,
      outputTokens: 20,
      cachedTokens: 2,
      reasoningTokens: 5,
      totalTokens: 222,
      estimatedCostUsd: 0.02
    }),
    createSessionEvent('2026-05-30T00:08:00.000Z', {
      source: 'codex',
      sessionIdHash: 'shared-session-hash',
      rawIdHash: 'codex-alpha-3',
      inputTokens: 300,
      outputTokens: 30,
      cachedTokens: 3,
      reasoningTokens: 5,
      totalTokens: 333,
      estimatedCostUsd: 0.03
    }),
    createSessionEvent('2026-05-30T00:01:00.000Z', {
      source: 'opencode',
      agent: 'opencode',
      sessionIdHash: 'shared-session-hash',
      rawIdHash: 'opencode-alpha-1',
      inputTokens: 400,
      outputTokens: 40,
      cachedTokens: 4,
      reasoningTokens: 0,
      totalTokens: 444,
      estimatedCostUsd: 0.04
    }),
    createSessionEvent('2026-05-30T00:02:00.000Z', {
      source: 'opencode',
      agent: 'opencode',
      sessionIdHash: 'shared-session-hash',
      rawIdHash: 'opencode-alpha-2',
      inputTokens: 500,
      outputTokens: 50,
      cachedTokens: 5,
      reasoningTokens: 0,
      totalTokens: 555,
      estimatedCostUsd: 0.05
    }),
    createSessionEvent('2026-05-30T00:02:00.000Z', {
      source: 'codex',
      sessionIdHash: 'beta-session-hash',
      rawIdHash: 'codex-beta-1',
      inputTokens: 50,
      outputTokens: 5,
      cachedTokens: 0,
      reasoningTokens: 1,
      totalTokens: 56,
      estimatedCostUsd: 0.005
    }),
    createSessionEvent('2026-05-30T00:04:00.000Z', {
      source: 'codex',
      sessionIdHash: 'beta-session-hash',
      rawIdHash: 'codex-beta-2',
      inputTokens: 60,
      outputTokens: 6,
      cachedTokens: 1,
      reasoningTokens: 1,
      totalTokens: 68,
      estimatedCostUsd: 0.006
    }),
    createSessionEvent('2026-05-30T00:10:00.000Z', {
      sessionIdHash: null,
      rawIdHash: 'without-session-row',
      totalTokens: 10,
      estimatedCostUsd: 0.001
    })
  ];
}

function createSessionEvent(timestamp: string, overrides: Parameters<typeof createTestEvent>[0]) {
  return createTestEvent({
    timestamp,
    sourceName: 'local-fixture',
    model: 'gpt-5.5-fixture',
    ...overrides
  });
}

function expectExportedPrimitiveRows(entry: unknown) {
  expect(entry).toEqual(expect.objectContaining({ rows: expect.any(Array) }));
  const rows = (entry as { rows: unknown[] }).rows;
  for (const row of rows) {
    expect(row).not.toBeNull();
    expect(Array.isArray(row)).toBe(false);
    expect(typeof row).toBe('object');
    for (const value of Object.values(row as Record<string, unknown>)) {
      expect(value === null || ['string', 'number', 'boolean'].includes(typeof value)).toBe(true);
    }
  }
}

type ResponsiveOverviewProps = React.ComponentProps<typeof App> & {
  readonly overviewWidthColumns: number;
};

function renderOverviewAtWidth(width: number): string {
  const props: ResponsiveOverviewProps = {
    loadData: () => createOverviewKpiTuiData(),
    initialViewKey: 'overview',
    onExportView: () => 'tokenwatch-current-view.json',
    overviewWidthColumns: width
  };
  return render(React.createElement(App, props)).lastFrame() ?? '';
}

function expectOverviewResponsiveContent(frame: string): void {
  const normalized = normalizedFrame(frame);
  for (const expected of [
    'Overview',
    'Today',
    'This Week',
    'This Month',
    'Total',
    'Budget',
    'Top source',
    'Top sourceName',
    'Top model',
    'Unknown pricing',
    '1000',
    '3000',
    '6000',
    '10000',
    '$0.100000',
    '$0.300000',
    '$0.700000',
    'tokens',
    'not configured',
    'opencode',
    'lab-server',
    'claude-sonnet-4',
    'unknown'
  ] as const) {
    expect(normalized).toContain(expected);
  }
  expect(normalized).not.toContain('$0.00');
  expect(normalized.toLowerCase()).not.toContain('free');
  expect(normalized.toLowerCase()).not.toContain('zero');
  expect(normalized.toLowerCase()).not.toContain('no cost');
}

function expectNoHorizontalOverflow(frame: string, width: number): void {
  for (const line of stripAnsi(frame).split('\n')) {
    expect(line.length).toBeLessThanOrEqual(width);
  }
}

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g'), '');
}

function normalizedFrame(frame: string | undefined): string {
  return (frame ?? '').replace(/\s+/g, ' ');
}
