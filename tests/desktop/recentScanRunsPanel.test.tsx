// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/desktop/renderer/src/App.js';
import { containsPrivacySentinel } from '../helpers.js';
import {
  appStatus,
  installTokenwatchApi,
  populatedSnapshot,
  scanRunFixture,
  unsafePath,
  unsafeSql
} from './helpers/rendererFixtures.js';

const textOf = (element: HTMLElement): string => element.textContent ?? '';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'tokenwatch');
});

describe('desktop recent scan runs panel', () => {
  it('renders completed failed and running scan runs as read-only safe summaries', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          recentScanRuns: [
            scanRunFixture(),
            scanRunFixture({
              startedAt: '2026-06-07T12:00:00.000Z',
              finishedAt: null,
              sourceName: 'safe-lab',
              parserName: 'claude-code',
              pathKind: 'default',
              status: 'failed',
              discoveredFiles: 2,
              parsedEvents: 1,
              insertedEvents: 1,
              skippedRecords: 1,
              rejectedRecords: 1,
              errorRecords: 1,
              warningCodes: ['privacy_rejected'],
              errorCode: 'parser_failed'
            }),
            scanRunFixture({
              startedAt: '2026-06-07T12:05:00.000Z',
              finishedAt: null,
              sourceName: 'safe-runner',
              parserName: null,
              pathKind: 'unknown',
              status: 'running',
              discoveredFiles: 1,
              parsedEvents: 0,
              insertedEvents: 0
            })
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    const panel = await screen.findByLabelText('Recent scan runs panel');
    expect(textOf(panel)).toContain('Recent scan runs');
    expect(textOf(panel)).toContain('3 runs');
    expect(textOf(panel)).toContain('Completed');
    expect(textOf(panel)).toContain('Failed');
    expect(textOf(panel)).toContain('Running');
    expect(textOf(panel)).toContain('StartedJun 7, 2026, 11:00 UTC');
    expect(textOf(panel)).toContain('FinishedJun 7, 2026, 11:00 UTC');
    expect(textOf(panel)).toContain('Finishedrunning');
    expect(textOf(panel)).toContain('Source namesafe-source-name');
    expect(textOf(panel)).toContain('Parsercodex');
    expect(textOf(panel)).toContain('Path kindcustom');
    expect(textOf(panel)).toContain('Discovered4');
    expect(textOf(panel)).toContain('Parsed3');
    expect(textOf(panel)).toContain('Inserted2');
    expect(textOf(panel)).toContain('Duplicate1');
    expect(textOf(panel)).toContain('Conflict0');
    expect(textOf(panel)).toContain('Skipped1');
    expect(textOf(panel)).toContain('Rejected1');
    expect(textOf(panel)).toContain('Errors1');
    expect(textOf(panel)).toContain('Warningsprivacy_rejected');
    expect(textOf(panel)).toContain('Error codeparser_failed');
    expect(within(panel).queryByRole('button', { name: /scan|import/i })).toBeNull();
  });

  it('withholds unsafe scan labels without exposing scan action controls', async () => {
    const unsafePrompt = ['PROMPT', '_SENTINEL_DO_NOT_LEAK'].join('');
    const unsafeRawPath = ['RAW_PATH', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      getSnapshot: vi.fn(async () =>
        populatedSnapshot({
          recentScanRuns: [
            scanRunFixture({
              sourceName: unsafePath,
              parserName: unsafePrompt,
              warningCodes: [unsafeRawPath],
              errorCode: unsafeSql
            })
          ]
        })
      ),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    const { container } = render(<App />);

    const panel = await screen.findByLabelText('Recent scan runs panel');
    expect(textOf(panel)).toContain('withheld label');
    expect(container.textContent).not.toContain(unsafePath);
    expect(container.textContent).not.toContain(unsafePrompt);
    expect(container.textContent).not.toContain(unsafeRawPath);
    expect(container.textContent).not.toContain(unsafeSql);
    expect(containsPrivacySentinel(container.textContent)).toBe(false);
    expect(within(panel).queryByRole('button', { name: /scan|import/i })).toBeNull();
  });

  it('renders an empty scan-run state inside populated analytics', async () => {
    installTokenwatchApi({
      getSnapshot: vi.fn(async () => populatedSnapshot({ recentScanRuns: [] })),
      getStatus: vi.fn(async () => appStatus('ready'))
    });

    render(<App />);

    expect(textOf(await screen.findByLabelText('Recent scan runs panel'))).toContain(
      'No scan runs recorded yet'
    );
  });
});
