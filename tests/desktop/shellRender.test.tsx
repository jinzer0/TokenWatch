// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopDashboardSnapshot } from '../../src/desktop/shared/contracts.js';
import { App } from '../../src/desktop/renderer/src/App.js';
import { containsPrivacySentinel, privacySentinels } from '../helpers.js';
import {
  appStatus,
  breakdown,
  createDeferred,
  dashboardFixture,
  installTokenwatchApi,
  populatedSnapshot,
  sessionIntervalFixture,
  setupSnapshot,
  unsafePath,
  unsafeSql
} from './helpers/rendererFixtures.js';
import { pricingDiagnosticFixture } from './helpers/diagnosticFixtures.js';

const textOf = (element: HTMLElement): string => element.textContent ?? '';

const breakdownRowLabels = (table: HTMLElement): string[] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => textOf(within(row).getByRole('button', { name: /Show details for/ })));

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'tokenwatch');
});

describe('desktop renderer shell', () => {
  it('renders an observable loading state while the preload snapshot is pending', () => {
    const snapshot = createDeferred<DesktopDashboardSnapshot>();
    installTokenwatchApi({ getSnapshot: () => snapshot.promise });

    render(<App />);

    expect(screen.getByLabelText('Loading dashboard snapshot')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh dashboard snapshot' })).toHaveProperty(
      'disabled',
      true
    );

    snapshot.resolve(setupSnapshot());
  });

  it('renders populated summary cards and local SVG charts from the typed preload DTO', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => populatedSnapshot()),
      refresh: vi.fn(async () => populatedSnapshot()),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Local token analytics' })).toBeTruthy();
    expect(screen.getByLabelText('Dashboard status').textContent).toContain('Ready');
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain(
      'DatabaseReady'
    );
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain(
      'Last refreshedJun 7, 2026'
    );
    expect(screen.getByLabelText('Analytics summary metrics').textContent).toContain('42');
    expect(screen.getByLabelText('Analytics summary metrics').textContent).toContain('123,456');

    const summary = screen.getByLabelText('Dashboard summary cards');
    expect(textOf(summary)).toContain('Total tokens');
    expect(textOf(summary)).toContain('123,456');
    expect(textOf(summary)).toContain('Estimated cost');
    expect(textOf(summary)).toContain('unknown');
    expect(textOf(summary)).toContain('1 unknown pricing event');
    expect(textOf(summary)).toContain('Event count');
    expect(textOf(summary)).toContain('Date range');
    expect(textOf(summary)).toContain('Jun 1, 2026 - Jun 7, 2026');
    expect(textOf(summary)).toContain('Top model');
    expect(textOf(summary)).toContain('safe-model-alpha');
    expect(textOf(summary)).toContain('Top agent');
    expect(textOf(summary)).toContain('safe-agent');
    expect(textOf(summary)).toContain('Top sourceName');
    expect(textOf(summary)).toContain('safe-source-name');
    expect(textOf(summary)).toContain('Top source');
    expect(textOf(summary)).toContain('safe-source');

    const usageChart = screen.getByRole('img', { name: 'Usage over time chart' });
    expect(usageChart.querySelector('path.chart-line')?.getAttribute('d')).toBe(
      'M 24 108 L 160 80 L 296 24'
    );
    expect(screen.getByRole('img', { name: 'Cost over time chart' })).toBeTruthy();
    const modelChart = screen.getByRole('img', { name: 'Model distribution chart' });
    const sourceNameChart = screen.getByRole('img', { name: 'SourceName distribution chart' });
    const modelDonutSegments = modelChart.querySelectorAll('circle.donut-segment');
    const sourceNameDonutSegments = sourceNameChart.querySelectorAll('circle.donut-segment');
    expect(modelDonutSegments).toHaveLength(2);
    expect(sourceNameDonutSegments).toHaveLength(2);
    expect(modelDonutSegments[0]?.getAttribute('stroke-dasharray')).toBe('146.58 54.49');
    expect(modelDonutSegments[1]?.getAttribute('stroke-dashoffset')).toBe('-146.58');
    expect(sourceNameDonutSegments[0]?.getAttribute('stroke-dasharray')).toBe('130.29 70.77');
    expect(sourceNameDonutSegments[1]?.getAttribute('stroke-dashoffset')).toBe('-130.29');
    expect(screen.getByLabelText('Model distribution chart data').textContent).toContain(
      'safe-model-beta: 33,456 tokens, 18 events'
    );
    expect(screen.getByLabelText('SourceName distribution chart data').textContent).toContain(
      'safe-source-name-alt: 43,456 tokens, 17 events'
    );
    expect(screen.getByLabelText('Dashboard breakdown tables')).toBeTruthy();
    expect(screen.getByLabelText('By Model breakdown table')).toBeTruthy();
    expect(screen.getByLabelText('By Agent breakdown table')).toBeTruthy();
    expect(screen.getByLabelText('By Source breakdown table')).toBeTruthy();
    expect(screen.getByLabelText('By Source Name breakdown table')).toBeTruthy();
    expect(screen.getByLabelText('Unknown pricing warning').textContent).toContain(
      '1 unknown pricing event'
    );

    const filters = screen.getByLabelText('UTC date filters');
    expect(within(filters).getByLabelText('From date UTC')).toBeTruthy();
    expect(within(filters).getByLabelText('To date UTC')).toBeTruthy();

    const sessions = screen.getByLabelText('Session metrics panel');
    expect(textOf(sessions)).toContain('Session count');
    expect(textOf(sessions)).toContain('2');
    expect(textOf(sessions)).toContain('Events without session');
    expect(textOf(sessions)).toContain('1');
    const sessionTable = screen.getByLabelText('Session interval summaries');
    expect(textOf(sessionTable)).toContain('hashed-session-alpha');
    expect(textOf(sessionTable)).toContain('hashed-session-beta');
    expect(textOf(sessionTable)).toContain('unknown');

    const diagnostics = screen.getByLabelText('Budget and pricing diagnostics panel');
    expect(textOf(diagnostics)).toContain('Budget and pricing diagnostics');
    expect(textOf(diagnostics)).toContain('current month');
    expect(textOf(diagnostics)).toContain('$12.34');
    expect(textOf(diagnostics)).toContain('$10.00');
    expect(textOf(diagnostics)).toContain('budget_threshold_exceeded');
    expect(textOf(diagnostics)).toContain('safe-model-alpha');
    expect(textOf(diagnostics)).toContain('exact-match');
    expect(textOf(diagnostics)).toContain('matched-cache');
    expect(textOf(diagnostics)).toContain('litellm:openai:safe-model-alpha');
    expect(textOf(diagnostics)).toContain('no action');
  });

  it('renders populated insights and all-events rolling trend cards from the dashboard DTO', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => populatedSnapshot()),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const panel = await screen.findByLabelText('Insights and trends panel');
    expect(textOf(panel)).toContain('Cache efficiency');
    expect(textOf(panel)).toContain('28%');
    expect(textOf(panel)).toContain('Unknown pricing impact');
    expect(textOf(panel)).toContain('unknown');
    expect(textOf(panel)).toContain('1 events / 140 tokens');
    expect(textOf(panel)).toContain('Top cost driver');
    expect(textOf(panel)).toContain('safe-model-alpha');
    expect(textOf(panel)).toContain('known');
    expect(textOf(panel)).toContain('spend driver');
    expect(textOf(panel)).toContain('all-events rolling trend');
    expect(textOf(panel)).toContain('7d tokens');
    expect(textOf(panel)).toContain('up 37%');
    expect(textOf(panel)).toContain('7d cost');
    expect(textOf(panel)).toContain('unknown');
    expect(textOf(panel)).toContain('30d tokens');
    expect(textOf(panel)).toContain('down 17%');
    expect(textOf(panel)).toContain('30d cost');
    expect(textOf(panel)).toContain('down 10%');
    expect(textOf(panel)).not.toContain('$0.00');
    expect(containsPrivacySentinel(textOf(panel))).toBe(false);
  });

  it('renders no-data and unknown-price insight DTOs without zero-dollar fallback', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          insights: {
            window: '7d',
            range: {
              from: '2026-05-31T12:00:00.000Z',
              to: '2026-06-07T12:00:00.000Z'
            },
            cards: {
              totals: {
                events: 0,
                tokens: 0,
                inputTokens: 0,
                outputTokens: 0,
                cachedTokens: 0,
                reasoningTokens: 0,
                estimatedCostUsd: null,
                knownEstimatedCostUsd: null,
                unknownCostEvents: 0,
                unknownCostTokens: 0
              },
              cacheHitRatio: { status: 'insufficient-data', value: null },
              reasoningToOutputRatio: { status: 'insufficient-data', value: null },
              budgetPressure: {
                status: 'unknown-costs-present',
                ratio: null,
                knownSpendUsd: null,
                thresholdUsd: null,
                unknownCostEvents: 2,
                unknownCostTokens: 600
              }
            },
            topRows: { models: [], sources: [], sourceNames: [], projects: [] },
            costDriverCandidates: [],
            warnings: ['unknown_pricing_present'],
            confidence: { level: 'low', reasons: ['insufficient_data'] },
            privacy: { sanitized: true }
          },
          trends: {
            trendScope: 'all-events-rolling',
            label: 'all-events rolling trend',
            windows: [],
            privacy: { sanitized: true }
          }
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const panel = await screen.findByLabelText('Insights and trends panel');
    expect(textOf(panel)).toContain('Cache efficiency');
    expect(textOf(panel)).toContain('insufficient-data');
    expect(textOf(panel)).toContain('Unknown pricing impact');
    expect(textOf(panel)).toContain('unknown');
    expect(textOf(panel)).toContain('2 events / 600 tokens');
    expect(textOf(panel)).toContain('No cost-driver candidates');
    expect(textOf(panel)).toContain('No all-events rolling trend windows available');
    expect(container.textContent).not.toContain('$0.00');
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('withholds privacy sentinels from insight labels and trend rows', async () => {
    const unsafeSentinel = ['RAW_PATH', '_SENTINEL_DO_NOT_LEAK'].join('');
    const dashboard = dashboardFixture();
    const firstTrendWindow = dashboard.trends.windows[0];
    if (!firstTrendWindow) throw new Error('missing trend fixture window');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          insights: {
            ...dashboard.insights,
            costDriverCandidates: [
              {
                label: unsafeSentinel,
                pricingStatus: 'unknown',
                knownTokens: 0,
                knownCostUsd: null,
                effectiveCostPerMillionTokens: null,
                knownSpendShare: null,
                expensiveRelativeToMedian: false,
                spendDriverCandidate: false
              }
            ]
          },
          trends: {
            trendScope: 'all-events-rolling',
            label: 'all-events rolling trend',
            windows: [
              {
                ...firstTrendWindow,
                chartRows: [
                  {
                    category: 'model',
                    label: unsafePath,
                    metric: 'tokens',
                    current: {
                      events: 1,
                      tokens: 100,
                      estimatedCostUsd: null,
                      knownEstimatedCostUsd: null,
                      unknownCostEvents: 1,
                      unknownCostTokens: 100
                    },
                    previous: {
                      events: 0,
                      tokens: 0,
                      estimatedCostUsd: null,
                      knownEstimatedCostUsd: null,
                      unknownCostEvents: 0,
                      unknownCostTokens: 0
                    },
                    deltaPercent: null,
                    direction: 'new'
                  }
                ]
              }
            ]
          }
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const panel = await screen.findByLabelText('Insights and trends panel');
    expect(textOf(panel)).toContain('withheld label');
    expect(container.textContent).not.toContain(unsafeSentinel);
    expect(container.textContent).not.toContain(unsafePath);
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('applies valid UTC date filters through the typed preload API', async () => {
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(populatedSnapshot())
      .mockResolvedValueOnce(
        populatedSnapshot({
          filters: { from: '2026-05-01', to: '2026-05-01' },
          totals: { events: 2, tokens: 300 },
          dateRange: {
            start: '2026-05-01T00:00:00.000Z',
            end: '2026-05-01T23:59:59.999Z'
          },
          usageSeries: [
            {
              key: '2026-05-01',
              events: 2,
              tokens: 300,
              inputTokens: 100,
              outputTokens: 150,
              cachedTokens: 50,
              estimatedCostUsd: 0.3,
              unknownCostEvents: 0
            }
          ],
          costSeries: [{ key: '2026-05-01', estimatedCostUsd: 0.3, unknownCostEvents: 0 }]
        })
      );
    installTokenwatchApi({ getSnapshot, getStatus: vi.fn(async () => appStatus('ready')) });

    render(<App />);

    const filters = await screen.findByLabelText('UTC date filters');
    const fromDate = within(filters).getByLabelText<HTMLInputElement>('From date UTC');
    const toDate = within(filters).getByLabelText<HTMLInputElement>('To date UTC');
    await waitFor(() => {
      expect(fromDate.value).toBe('');
      expect(toDate.value).toBe('');
    });
    fireEvent.change(fromDate, {
      target: { value: '2026-05-01' }
    });
    fireEvent.change(toDate, {
      target: { value: '2026-05-01' }
    });
    fireEvent.click(within(filters).getByRole('button', { name: 'Apply UTC date filter' }));

    await waitFor(() =>
      expect(getSnapshot).toHaveBeenLastCalledWith({ from: '2026-05-01', to: '2026-05-01' })
    );
    expect(textOf(await screen.findByLabelText('Dashboard summary cards'))).toContain('300');
    expect(textOf(screen.getByLabelText('UTC date filters'))).toContain('2026-05-01 to 2026-05-01');
  });

  it('blocks invalid UTC date ranges before calling preload', async () => {
    const getSnapshot = vi.fn(async () => populatedSnapshot());
    const refresh = vi.fn(async () => populatedSnapshot());
    installTokenwatchApi({
      getSnapshot,
      refresh,
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const filters = await screen.findByLabelText('UTC date filters');
    fireEvent.change(within(filters).getByLabelText('From date UTC'), {
      target: { value: '2026-05-02' }
    });
    fireEvent.change(within(filters).getByLabelText('To date UTC'), {
      target: { value: '2026-05-01' }
    });
    fireEvent.click(within(filters).getByRole('button', { name: 'Apply UTC date filter' }));

    expect(textOf(screen.getByLabelText('UTC filter validation'))).toContain(
      'From date must be on or before to date.'
    );
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders empty filtered analytics without setup-state confusion', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          filters: { from: '2026-05-03', to: '2026-05-03' },
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
          sessionMetrics: {
            sessionCount: 0,
            totalWallDurationMs: 0,
            totalActiveDurationMs: 0,
            longestSessionMs: 0,
            longestContinuousMs: 0,
            maxConcurrentSessions: 0,
            eventsWithoutSession: 0
          },
          sessionIntervals: []
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    expect(textOf(await screen.findByLabelText('Filtered empty dashboard state'))).toContain(
      'No usage events match the current UTC date filter.'
    );
    expect(screen.queryByLabelText('Setup needed dashboard state')).toBeNull();
    expect(textOf(screen.getByLabelText('Session interval summaries'))).toContain(
      'No session intervals in this filtered window'
    );
  });

  it('withholds unsafe session-adjacent labels in the session table', async () => {
    const rawSessionSentinel = ['RAW_SESSION', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          sessionIntervals: [
            sessionIntervalFixture({ sessionIdHash: rawSessionSentinel, source: unsafePath })
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const sessionTable = await screen.findByLabelText('Session interval summaries');
    expect(textOf(sessionTable)).toContain('withheld label');
    expect(container.textContent).not.toContain(rawSessionSentinel);
    expect(container.textContent).not.toContain(unsafePath);
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('sorts breakdown tables deterministically by numeric and string columns', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          byAgent: [
            breakdown('zeta-agent', 5, 500),
            breakdown('alpha-agent', 50, 100),
            breakdown('middle-agent', 20, 300)
          ],
          bySource: [
            breakdown('source-low-events', 1, 1000),
            breakdown('source-high-events', 9, 200),
            breakdown('source-mid-events', 5, 500)
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const agentTable = await screen.findByLabelText('By Agent breakdown table');
    expect(breakdownRowLabels(agentTable)).toEqual(['zeta-agent', 'middle-agent', 'alpha-agent']);

    fireEvent.click(within(agentTable).getByRole('button', { name: 'Sort By Agent by Group' }));
    expect(breakdownRowLabels(agentTable)).toEqual(['alpha-agent', 'middle-agent', 'zeta-agent']);

    const sourceTable = screen.getByLabelText('By Source breakdown table');
    fireEvent.click(within(sourceTable).getByRole('button', { name: 'Sort By Source by Events' }));
    expect(breakdownRowLabels(sourceTable)).toEqual([
      'source-high-events',
      'source-mid-events',
      'source-low-events'
    ]);
  });

  it('selects a total-token sorted model row and shows aggregate-only drilldown fields', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          byModel: [
            breakdown('safe-model-medium', 7, 50000),
            breakdown('safe-model-large', 11, 90000),
            breakdown('safe-model-small', 3, 10000)
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const modelTable = await screen.findByLabelText('By Model breakdown table');
    expect(breakdownRowLabels(modelTable)).toEqual([
      'safe-model-large',
      'safe-model-medium',
      'safe-model-small'
    ]);

    fireEvent.click(
      within(modelTable).getByRole('button', {
        name: 'Show details for safe-model-large in By Model'
      })
    );

    const drilldown = screen.getByLabelText('Breakdown drilldown panel');
    expect(textOf(drilldown)).toContain('safe-model-large');
    expect(textOf(drilldown)).toContain('Events11');
    expect(textOf(drilldown)).toContain('Input tokens45,000');
    expect(textOf(drilldown)).toContain('Output tokens30,000');
    expect(textOf(drilldown)).toContain('Cached tokens15,000');
    expect(textOf(drilldown)).toContain('Reasoning tokens0');
    expect(textOf(drilldown)).toContain('Total tokens90,000');
    expect(textOf(drilldown)).toContain('Estimated cost$0.90');
    expect(textOf(drilldown)).toContain('Top related modelsafe-model');
    expect(textOf(drilldown)).toContain('Top related agentsafe-agent');
  });

  it('withholds sentinel-like and path-like breakdown labels from tables and drilldowns', async () => {
    const unsafeSentinel = ['PROMPT', '_SENTINEL_DO_NOT_LEAK'].join('');
    const unsafeMetadata = ['metadata', ' JSON'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          top: { model: unsafeSentinel, agent: unsafeMetadata },
          byModel: [
            {
              ...breakdown(unsafePath, 4, 4000),
              topModel: unsafeSentinel,
              topAgent: unsafeMetadata
            },
            breakdown('safe-visible-model', 2, 2000)
          ],
          byAgent: [breakdown(unsafeSentinel, 3, 3000)],
          bySource: [breakdown(unsafeSql, 5, 5000)],
          bySourceName: [breakdown(unsafeMetadata, 6, 6000)]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const modelTable = await screen.findByLabelText('By Model breakdown table');
    expect(textOf(modelTable)).toContain('withheld label');
    expect(container.textContent).not.toContain(unsafePath);
    expect(container.textContent).not.toContain(unsafeSql);
    expect(container.textContent).not.toContain(unsafeSentinel);
    expect(container.textContent).not.toContain(unsafeMetadata);

    fireEvent.click(
      within(modelTable).getByRole('button', {
        name: 'Show details for withheld label in By Model'
      })
    );

    const drilldown = screen.getByLabelText('Breakdown drilldown panel');
    expect(textOf(drilldown)).toContain('withheld label');
    expect(textOf(drilldown)).not.toContain(unsafePath);
    expect(textOf(drilldown)).not.toContain(unsafeSentinel);
    expect(textOf(drilldown)).not.toContain(unsafeMetadata);
  });

  it('renders empty chart states with deterministic accessible SVG output', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({ usageSeries: [], costSeries: [], byModel: [], bySourceName: [] })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const usageChart = await screen.findByRole('img', { name: 'Usage over time chart' });
    expect(usageChart.querySelector('path.chart-line')).toBeNull();
    expect(textOf(screen.getByLabelText('Usage over time chart data'))).toContain(
      'No usage data available'
    );
    expect(
      screen
        .getByRole('img', { name: 'Model distribution chart' })
        .querySelectorAll('circle.donut-segment')
    ).toHaveLength(0);
    expect(textOf(screen.getByLabelText('Model distribution chart data'))).toContain(
      'No model distribution available'
    );
  });

  it('renders a single-point line chart deterministically', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          usageSeries: [
            {
              key: '2026-06-07',
              events: 1,
              tokens: 500,
              inputTokens: 250,
              outputTokens: 200,
              cachedTokens: 50,
              estimatedCostUsd: 0.5,
              unknownCostEvents: 0
            }
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const usageChart = await screen.findByRole('img', { name: 'Usage over time chart' });
    expect(usageChart.querySelector('path.chart-line')?.getAttribute('d')).toBe('M 160 24');
    expect(usageChart.querySelector('circle.chart-point')?.getAttribute('cx')).toBe('160');
    expect(usageChart.querySelector('circle.chart-point')?.getAttribute('cy')).toBe('24');
  });

  it('renders unknown cost as unknown and never as a zero-dollar amount', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          totals: { estimatedCostUsd: null, unknownCostEvents: 3 },
          costSeries: [
            { key: '2026-06', estimatedCostUsd: null, unknownCostEvents: 3 },
            { key: '2026-06-07', estimatedCostUsd: null, unknownCostEvents: 1 }
          ],
          unknownPricingCount: 3,
          pricingDiagnostics: [
            pricingDiagnosticFixture({
              model: 'unknown-price-model',
              diagnosticStatus: 'unresolved',
              cacheStatus: 'not-cached',
              pricingSource: 'unknown',
              pricingConfidence: 'none',
              matchedKey: null,
              estimatedCostUsd: null,
              unknownCostEventCount: 3,
              unknownCostTokenCount: 600,
              recommendedAction: 'add custom price'
            })
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const summary = await screen.findByLabelText('Dashboard summary cards');
    expect(textOf(summary)).toContain('Estimated cost');
    expect(textOf(summary)).toContain('unknown');
    expect(textOf(summary)).toContain('3 unknown pricing events');
    expect(textOf(screen.getByLabelText('Cost over time chart data'))).toContain('unknown cost');
    expect(textOf(screen.getByLabelText('Budget and pricing diagnostics panel'))).toContain(
      'unknown'
    );
    expect(container.textContent).not.toContain('$0.00');
  });

  it('renders no-threshold and pricing no-match diagnostics without unsafe labels or refresh controls', async () => {
    const unsafeMatchedKey = ['RAW_PATH', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          budgetDiagnostics: [],
          pricingDiagnostics: [
            pricingDiagnosticFixture({
              provider: unsafePath,
              model: unsafeMatchedKey,
              diagnosticStatus: 'negative-cache',
              cacheStatus: 'negative-cache',
              pricingSource: 'unknown',
              pricingConfidence: 'none',
              matchedKey: unsafeMatchedKey,
              totalTokens: 300,
              estimatedCostUsd: null,
              unknownCostEventCount: 1,
              unknownCostTokenCount: 300,
              recommendedAction: 'add custom price'
            })
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const diagnostics = await screen.findByLabelText('Budget and pricing diagnostics panel');
    expect(textOf(diagnostics)).toContain('No budget thresholds configured');
    expect(textOf(diagnostics)).toContain('negative-cache');
    expect(textOf(diagnostics)).toContain('add custom price');
    expect(textOf(diagnostics)).toContain('unknown');
    expect(textOf(diagnostics)).toContain('withheld label');
    expect(textOf(diagnostics)).not.toContain('pricing refresh');
    expect(textOf(diagnostics)).not.toContain('provider credentials');
    expect(container.textContent).not.toContain(unsafePath);
    expect(container.textContent).not.toContain(unsafeMatchedKey);
    expect(container.textContent).not.toContain('$0.00');
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('renders incomplete date ranges as unknown', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          dateRange: { start: null, end: '2026-06-07T12:00:00.000Z' }
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const summary = await screen.findByLabelText('Dashboard summary cards');
    expect(textOf(summary)).toContain('Date range');
    expect(textOf(summary)).toContain('unknown');
    expect(textOf(summary)).not.toContain('Jun 7, 2026');

    cleanup();
    Reflect.deleteProperty(window, 'tokenwatch');

    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          dateRange: { start: '2026-06-01T00:00:00.000Z', end: null }
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const nextSummary = await screen.findByLabelText('Dashboard summary cards');
    expect(textOf(nextSummary)).toContain('Date range');
    expect(textOf(nextSummary)).toContain('unknown');
    expect(textOf(nextSummary)).not.toContain('Jun 1, 2026');
  });

  it('withholds unsafe chart keys before rendering chart text', async () => {
    const unsafePrompt = ['PROMPT', '_SENTINEL_DO_NOT_LEAK'].join('');
    const unsafeRawPath = ['RAW_PATH', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          usageSeries: [
            {
              key: unsafePath,
              events: 1,
              tokens: 100,
              inputTokens: 40,
              outputTokens: 50,
              cachedTokens: 10,
              estimatedCostUsd: 0.1,
              unknownCostEvents: 0
            }
          ],
          costSeries: [{ key: unsafePrompt, estimatedCostUsd: 0.1, unknownCostEvents: 0 }],
          byModel: [breakdown(unsafeRawPath, 2, 200)],
          bySourceName: [breakdown(unsafeSql, 3, 300)]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const usageChartData = await screen.findByLabelText('Usage over time chart data');
    const costChartData = screen.getByLabelText('Cost over time chart data');
    const modelChart = screen.getByRole('img', { name: 'Model distribution chart' });
    const sourceNameChartData = screen.getByLabelText('SourceName distribution chart data');
    expect(textOf(usageChartData)).toContain('withheld label: 100 tokens across 1 events');
    expect(textOf(costChartData)).toContain('withheld label: $0.10 estimated');
    expect(modelChart.textContent).toContain('withheld label');
    expect(textOf(sourceNameChartData)).toContain('withheld label: 300 tokens, 3 events');
    expect(container.textContent).not.toContain(unsafePath);
    expect(container.textContent).not.toContain(unsafeSql);
    expect(container.textContent).not.toContain(unsafePrompt);
    expect(container.textContent).not.toContain(unsafeRawPath);
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('renders setup-needed copy without raw local locations', async () => {
    installTokenwatchApi();

    render(<App />);

    expect((await screen.findByLabelText('Setup needed dashboard state')).textContent).toContain(
      'No TokenWatch database data is available yet.'
    );
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain(
      'DatabaseSetup needed'
    );
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain(
      'Last refreshedNot refreshed yet'
    );
    expect(screen.getByLabelText('Setup needed dashboard state').textContent).not.toContain(
      unsafePath
    );
    expect(screen.getByLabelText('Setup needed dashboard state').textContent).not.toContain(
      unsafeSql
    );
  });

  it('renders a sanitized error state when preload rejects with unsafe technical details', async () => {
    const unsafeSentinel = ['PROMPT', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => {
        throw new Error(`open ${unsafePath} failed: ${unsafeSql} ${unsafeSentinel}`);
      })
    });

    const { container } = render(<App />);

    const error = await screen.findByLabelText('Sanitized dashboard error');
    expect(error.textContent).toContain('Dashboard unavailable');
    expect(error.textContent).toContain('error: dashboard_unavailable');
    expect(error.textContent).toContain('Code: dashboard_unavailable');
    expect(error.textContent).not.toContain(unsafePath);
    expect(error.textContent).not.toContain(unsafeSql);
    expect(error.textContent).not.toContain(unsafeSentinel);
    for (const sentinel of privacySentinels) {
      expect(container.textContent).not.toContain(sentinel);
    }
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('manual refresh updates cards and last refreshed status through the preload API', async () => {
    const firstSnapshot = populatedSnapshot({
      generatedAt: '2026-06-07T12:00:00.000Z',
      totals: { events: 42, tokens: 123456 }
    });
    const secondSnapshot = populatedSnapshot({
      generatedAt: '2026-06-07T13:30:00.000Z',
      totals: { events: 84, tokens: 654321 }
    });
    const refresh = vi.fn(async () => secondSnapshot);
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => firstSnapshot),
      refresh,
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    expect((await screen.findByLabelText('Analytics summary metrics')).textContent).toContain(
      '123,456'
    );
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain(
      'Last refreshedJun 7, 2026'
    );

    const button = await screen.findByRole('button', { name: 'Refresh dashboard snapshot' });
    fireEvent.click(button);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByLabelText('Analytics summary metrics').textContent).toContain('654,321')
    );
    expect(screen.getByLabelText('Database and refresh status').textContent).toContain('13:30 UTC');
  });

  it('renders sanitized refresh failure without replacing the safe dashboard', async () => {
    const unsafeSentinel = ['RAW_PATH', '_SENTINEL_DO_NOT_LEAK'].join('');
    const refresh = vi.fn(async () => {
      throw new Error(`refresh failed for ${unsafePath} ${unsafeSql} ${unsafeSentinel}`);
    });
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => populatedSnapshot()),
      refresh,
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    expect(await screen.findByLabelText('Dashboard summary cards')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh dashboard snapshot' }));

    const error = await screen.findByLabelText('Sanitized dashboard error');
    expect(error.textContent).toContain('error: refresh_failed');
    expect(error.textContent).toContain('Code: refresh_failed');
    expect(container.textContent).not.toContain(unsafePath);
    expect(container.textContent).not.toContain(unsafeSql);
    expect(container.textContent).not.toContain(unsafeSentinel);
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
  });

  it('keeps auto-refresh off by default', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => populatedSnapshot()),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    try {
      render(<App />);

      await screen.findByLabelText('Dashboard summary cards');
      expect(
        intervalSpy.mock.calls.filter(([callback]) => callback.name !== 'checkRealTimersCallback')
      ).toEqual([]);
    } finally {
      intervalSpy.mockRestore();
    }
  });
});
