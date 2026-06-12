// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  DesktopAppStatus,
  DesktopDashboardSnapshot
} from '../../src/desktop/shared/contracts.js';
import { App } from '../../src/desktop/renderer/src/App.js';
import { containsPrivacySentinel, privacySentinels } from '../helpers.js';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type Dashboard = NonNullable<DesktopDashboardSnapshot['dashboard']>;

type DashboardOverrides = Partial<Dashboard> & {
  totals?: Partial<Dashboard['totals']>;
  top?: Partial<Dashboard['top']>;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const setupSnapshot = (): DesktopDashboardSnapshot => ({
  status: 'setup-needed',
  dashboard: null,
  privacy: { sanitized: true }
});

const appStatus = (status: DesktopAppStatus['database']['status']): DesktopAppStatus => ({
  app: 'ready',
  database: { status },
  privacy: { sanitized: true }
});

const unsafePath = ['/', 'Users', '/private/', 'tokenwatch', '.db'].join('');
const unsafeSql = ['select', ' * from ', 'usage_', 'events'].join('');

const breakdown = (
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
  topModel: 'safe-model',
  topAgent: 'safe-agent'
});

const dashboardFixture = (overrides: DashboardOverrides = {}): Dashboard => {
  const { totals: totalsOverride, top: topOverride, ...dashboardOverrides } = overrides;
  const totals: Dashboard['totals'] = {
    events: 42,
    tokens: 123456,
    inputTokens: 60000,
    outputTokens: 40000,
    cachedTokens: 23456,
    estimatedCostUsd: 12.34,
    sources: 3,
    sourceNames: 2,
    models: 2,
    agents: 2,
    unknownCostEvents: 1,
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
        unknownCostEvents: 0
      },
      {
        key: '2026-06-01',
        events: 12,
        tokens: 2000,
        inputTokens: 1200,
        outputTokens: 600,
        cachedTokens: 200,
        estimatedCostUsd: 2.22,
        unknownCostEvents: 0
      },
      {
        key: '2026-06-07',
        events: 20,
        tokens: 4000,
        inputTokens: 2400,
        outputTokens: 1200,
        cachedTokens: 400,
        estimatedCostUsd: 4.44,
        unknownCostEvents: 1
      }
    ],
    costSeries: [
      { key: '2026-06', estimatedCostUsd: 1.11, unknownCostEvents: 0 },
      { key: '2026-06-01', estimatedCostUsd: 2.22, unknownCostEvents: 0 },
      { key: '2026-06-07', estimatedCostUsd: 4.44, unknownCostEvents: 1 }
    ],
    byModel: [breakdown('safe-model-alpha', 24, 90000), breakdown('safe-model-beta', 18, 33456)],
    byAgent: [breakdown('safe-agent', 30, 100000), breakdown('safe-agent-alt', 12, 23456)],
    bySource: [breakdown('safe-source', 32, 100000), breakdown('safe-source-alt', 10, 23456)],
    bySourceName: [
      breakdown('safe-source-name', 25, 80000),
      breakdown('safe-source-name-alt', 17, 43456)
    ],
    unknownPricingCount: 1,
    recentScanRuns: [],
    privacy: { sanitized: true }
  };

  return { ...baseDashboard, ...dashboardOverrides, totals, top };
};

const populatedSnapshot = (overrides: DashboardOverrides = {}): DesktopDashboardSnapshot => ({
  status: 'ready',
  dashboard: dashboardFixture(overrides),
  privacy: { sanitized: true }
});

const installTokenwatchApi = ({
  getSnapshot = vi.fn(async () => setupSnapshot()),
  refresh = vi.fn(async () => setupSnapshot()),
  getStatus = vi.fn(async () => appStatus('setup-needed')),
  getVersion = vi.fn(async () => '0.1.0')
}: {
  getSnapshot?: () => Promise<DesktopDashboardSnapshot>;
  refresh?: () => Promise<DesktopDashboardSnapshot>;
  getStatus?: () => Promise<DesktopAppStatus>;
  getVersion?: () => Promise<string>;
} = {}) => {
  Object.defineProperty(window, 'tokenwatch', {
    configurable: true,
    value: Object.freeze({
      dashboard: Object.freeze({ getSnapshot, refresh }),
      app: Object.freeze({ getStatus, getVersion })
    })
  });
  return { getSnapshot, refresh, getStatus, getVersion };
};

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
    expect(textOf(summary)).toContain('$12.34');
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
          unknownPricingCount: 3
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
    expect(container.textContent).not.toContain('$0.00');
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
