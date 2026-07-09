// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/desktop/renderer/src/App.js';
import { assertDomTextPrivacy, forbiddenOutputFixtures } from '../privacyOutput.js';
import { diagnosticsHubFixture } from './helpers/diagnosticFixtures.js';
import { appStatus, installTokenwatchApi, populatedSnapshot } from './helpers/rendererFixtures.js';

const textOf = (element: HTMLElement): string => element.textContent ?? '';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'tokenwatch');
});

describe('desktop diagnostics hub renderer', () => {
  it('renders setup-needed guidance with exact safe CLI actions', async () => {
    installTokenwatchApi();

    render(<App />);

    const setup = await screen.findByLabelText('Setup needed dashboard state');
    expect(textOf(setup)).toContain('tokenwatch scan --source <source> --path <path>');
    expect(textOf(setup)).toContain('tokenwatch doctor --sources');
    assertDomTextPrivacy(textOf(setup));
  });

  it('renders database-unavailable guidance without raw database details', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => ({
        status: 'database-unavailable',
        dashboard: null,
        privacy: { sanitized: true }
      })),
      getStatus: vi.fn(async () => appStatus('database-unavailable'))
    });

    render(<App />);

    const setup = await screen.findByLabelText('Setup needed dashboard state');
    expect(textOf(setup)).toContain('Database unavailable');
    expect(textOf(setup)).toContain('tokenwatch doctor --sources');
    assertDomTextPrivacy(textOf(setup));
  });

  it('renders actionable diagnostics for scans, pricing, budget, sessions, projects, and privacy', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          diagnosticsHub: diagnosticsHubFixture({
            latestScan: {
              status: 'failed',
              startedAt: '2026-06-07T11:00:00.000Z',
              finishedAt: '2026-06-07T11:00:04.000Z',
              sourceName: 'safe-source-name',
              parserName: 'codex',
              warningCount: 2,
              errorCode: 'parser_error'
            },
            sourceHealth: {
              status: 'failing',
              sourcesWithRuns: 2,
              failedRuns: 1,
              warningRuns: 1,
              interruptedRuns: 1
            },
            pricingSummary: {
              status: 'unknown-costs',
              diagnosticCount: 2,
              unknownCostEventCount: 3,
              unknownCostTokenCount: 600,
              unresolvedModelCount: 2
            },
            budgetSummary: {
              status: 'over',
              diagnosticCount: 1,
              overBudgetCount: 1,
              unknownCostBudgetCount: 0
            },
            sessionSummary: {
              status: 'missing-session-metadata',
              sessionCount: 2,
              eventsWithoutSession: 1,
              maxConcurrentSessions: 2,
              longestContinuousMs: 300_000
            },
            projectSummary: {
              status: 'needs-labels',
              publicProjectCount: 3,
              labeledEventCount: 39,
              unknownProjectEventCount: 3,
              unlabeledWorkspaceHashCount: 2
            },
            recommendedActions: [
              {
                code: 'review-failed-scan',
                priority: 'high',
                copyKey: 'desktop.diagnostics.action.reviewFailedScan',
                command: 'tokenwatch doctor --sources'
              },
              {
                code: 'add-custom-price',
                priority: 'medium',
                copyKey: 'desktop.diagnostics.action.addCustomPrice',
                command:
                  'tokenwatch pricing set --provider <provider> --model <model> --input <usd> --output <usd>'
              },
              {
                code: 'review-budget-threshold',
                priority: 'medium',
                copyKey: 'desktop.diagnostics.action.reviewBudgetThreshold',
                command: 'tokenwatch budget list'
              },
              {
                code: 'inspect-sessions',
                priority: 'low',
                copyKey: 'desktop.diagnostics.action.inspectSessions',
                command: 'tokenwatch summary --group-by session --json'
              },
              {
                code: 'label-projects',
                priority: 'medium',
                copyKey: 'desktop.diagnostics.action.labelProjects',
                command: 'tokenwatch config set project_label <label>'
              }
            ]
          })
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const hub = await screen.findByLabelText('Desktop diagnostics hub');
    expect(textOf(hub)).toContain('Database readiness');
    expect(textOf(hub)).toContain('42 events');
    expect(textOf(hub)).toContain('Latest scan failed');
    expect(textOf(hub)).toContain('parser_error');
    expect(textOf(hub)).toContain('Source health failing');
    expect(textOf(hub)).toContain('Pricing unknown-costs');
    expect(textOf(hub)).toContain('3 unknown cost events');
    expect(textOf(hub)).toContain('Budget over');
    expect(textOf(hub)).toContain('Session metadata missing-session-metadata');
    expect(textOf(hub)).toContain('Project labels needs-labels');
    expect(textOf(hub)).toContain('Privacy boundary');
    expect(textOf(hub)).toContain('sanitized DTO only');
    expect(textOf(hub)).toContain('tokenwatch doctor --sources');
    expect(textOf(hub)).toContain(
      'tokenwatch pricing set --provider <provider> --model <model> --input <usd> --output <usd>'
    );
    expect(textOf(hub)).toContain('tokenwatch budget list');
    expect(textOf(hub)).toContain('tokenwatch summary --group-by session --json');
    expect(textOf(hub)).toContain('tokenwatch config set project_label <label>');
    assertDomTextPrivacy(textOf(hub));
  });

  it('renders active UTC filter context without changing desktop UTC semantics', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          filters: { from: '2026-06-01', to: '2026-06-07' },
          diagnosticsHub: diagnosticsHubFixture()
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const hub = await screen.findByLabelText('Desktop diagnostics hub');
    expect(textOf(hub)).toContain('UTC filter active');
    expect(textOf(hub)).toContain('2026-06-01 to 2026-06-07');
  });

  it('protects malicious diagnostics labels, errors, and action payloads in DOM text', async () => {
    const unsafe = forbiddenOutputFixtures.map((fixture) => fixture.sample).join(' ');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          diagnosticsHub: diagnosticsHubFixture({
            latestScan: {
              status: 'failed',
              startedAt: '2026-06-07T11:00:00.000Z',
              finishedAt: null,
              sourceName: unsafe,
              parserName: unsafe,
              warningCount: 1,
              errorCode: unsafe
            },
            recommendedActions: [
              {
                code: 'review-failed-scan',
                priority: 'high',
                copyKey: unsafe,
                command: unsafe
              }
            ]
          })
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const hub = await screen.findByLabelText('Desktop diagnostics hub');
    expect(textOf(hub)).toContain('withheld label');
    expect(within(hub).queryByText(unsafe)).toBeNull();
    expect(container.textContent).not.toContain(unsafe);
    assertDomTextPrivacy(textOf(hub));
  });
});
