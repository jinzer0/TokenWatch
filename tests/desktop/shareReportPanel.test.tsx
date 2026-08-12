// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareReportPanel } from '../../src/desktop/renderer/src/components/ShareReportPanel.js';
import type { DesktopShareReportResult } from '../../src/desktop/shared/shareContracts.js';
import { assertDomTextPrivacy } from '../privacyOutput.js';
import {
  createDeferred,
  installTokenwatchApi,
  unsafePath,
  unsafeSql
} from './helpers/rendererFixtures.js';

const textOf = (element: HTMLElement): string => element.textContent ?? '';

const renderPanel = ({ disabled = false }: { readonly disabled?: boolean } = {}) =>
  render(<ShareReportPanel disabled={disabled} filters={{ from: null, to: null }} />);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'tokenwatch');
});

describe('desktop share report panel', () => {
  it('exports local JSON, Markdown, and PNG reports through the preload API', async () => {
    const exportReport = vi.fn(
      async (request): Promise<DesktopShareReportResult> => ({
        format: request.format,
        fileName: `tokenwatch-share.${request.format === 'markdown' ? 'md' : request.format}`,
        bytesWritten: request.format === 'png' ? 4096 : 1024,
        status: 'written'
      })
    );
    installTokenwatchApi({ exportReport });
    const { container } = renderPanel();

    for (const buttonName of ['Export local JSON', 'Export local Markdown', 'Export local PNG']) {
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      await waitFor(() =>
        expect(screen.getByLabelText('Local export status').textContent).toContain(
          'Export complete'
        )
      );
    }

    expect(exportReport).toHaveBeenNthCalledWith(1, {
      format: 'json',
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });
    expect(exportReport).toHaveBeenNthCalledWith(2, {
      format: 'markdown',
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });
    expect(exportReport).toHaveBeenNthCalledWith(3, {
      format: 'png',
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });
    const panel = screen.getByLabelText('Export local report');
    expect(textOf(panel)).toContain('File tokenwatch-share.png');
    expect(textOf(panel)).toContain('4,096 bytes');
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('withholds unsafe returned file names from successful export status text', async () => {
    const unsafeFileName = [
      'RAW_PATH_SENTINEL_DO_NOT_LEAK',
      'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK',
      'STACK_TRACE_SENTINEL_DO_NOT_LEAK at save (/tmp/raw.ts:1:2)'
    ].join('-');
    installTokenwatchApi({
      exportReport: vi.fn(
        async (): Promise<DesktopShareReportResult> => ({
          format: 'json',
          fileName: unsafeFileName,
          bytesWritten: 64,
          status: 'written'
        })
      )
    });
    const { container } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Export local JSON' }));

    const status = await screen.findByLabelText('Local export status');
    expect(textOf(status)).toContain('Export complete');
    expect(textOf(status)).toContain('File withheld label');
    expect(textOf(status)).not.toContain(unsafeFileName);
    expect(textOf(status)).not.toContain('$0.00');
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('passes active UTC filters without exposing local paths', async () => {
    const exportReport = vi.fn(
      async (): Promise<DesktopShareReportResult> => ({
        format: 'json',
        fileName: 'filtered-report.json',
        bytesWritten: 256,
        status: 'written'
      })
    );
    installTokenwatchApi({ exportReport });
    const { container } = render(
      <ShareReportPanel disabled={false} filters={{ from: '2026-06-01', to: '2026-06-07' }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export local JSON' }));

    await waitFor(() =>
      expect(exportReport).toHaveBeenCalledWith({
        format: 'json',
        filters: {
          from: '2026-06-01',
          to: '2026-06-07'
        },
        report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
      })
    );
    expect(textOf(screen.getByLabelText('Local export status'))).toContain('filtered-report.json');
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('offers JSON and Markdown only for standalone insights and trend reports', async () => {
    const exportReport = vi.fn(
      async (request): Promise<DesktopShareReportResult> => ({
        format: request.format,
        fileName: `safe-${request.report.kind}.${request.format === 'markdown' ? 'md' : 'json'}`,
        bytesWritten: 128,
        status: 'written'
      })
    );
    installTokenwatchApi({ exportReport });
    const { container } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Select Insights report' }));

    expect(screen.queryByRole('button', { name: 'Export local PNG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Export local JSON' }));
    await waitFor(() =>
      expect(exportReport).toHaveBeenLastCalledWith({
        format: 'json',
        report: { kind: 'insights', window: '7d' }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Trend report' }));

    expect(screen.queryByRole('button', { name: 'Export local PNG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Export local Markdown' }));
    await waitFor(() =>
      expect(exportReport).toHaveBeenLastCalledWith({
        format: 'markdown',
        report: { kind: 'trend', window: '7d' }
      })
    );
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('offers wrapped reports with PNG through the preload API', async () => {
    const year = new Date().getUTCFullYear();
    const exportReport = vi.fn(
      async (request): Promise<DesktopShareReportResult> => ({
        format: request.format,
        fileName: `safe-${request.report.kind}.${request.format}`,
        bytesWritten: 256,
        status: 'written'
      })
    );
    installTokenwatchApi({ exportReport });
    const { container } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Select Wrapped report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export local PNG' }));

    await waitFor(() =>
      expect(exportReport).toHaveBeenLastCalledWith({
        format: 'png',
        report: { kind: 'wrapped', year }
      })
    );
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('shows a deterministic cancelled state when the save dialog is cancelled', async () => {
    installTokenwatchApi({
      exportReport: vi.fn(
        async (): Promise<DesktopShareReportResult> => ({
          format: 'json',
          fileName: null,
          bytesWritten: 0,
          status: 'cancelled'
        })
      )
    });
    const { container } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Export local JSON' }));

    await waitFor(() =>
      expect(textOf(screen.getByLabelText('Local export status'))).toContain(
        'Export cancelled. No local report was written.'
      )
    );
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('shows only a sanitized failure when preload rejects with unsafe technical details', async () => {
    const unsafeSentinel = ['STACK_TRACE', '_SENTINEL_DO_NOT_LEAK'].join('');
    installTokenwatchApi({
      exportReport: vi.fn(async () => {
        throw new Error(
          `failed ${unsafePath} ${unsafeSql} ${unsafeSentinel} at writeShare (/tmp/x.ts:1:2)`
        );
      })
    });
    const { container } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Export local Markdown' }));

    const status = screen.getByLabelText('Local export status');
    await waitFor(() => expect(textOf(status)).toContain('Export failed'));
    expect(textOf(status)).toContain('error: desktop_ipc_failed');
    expect(textOf(status)).not.toContain(unsafePath);
    expect(textOf(status)).not.toContain(unsafeSql);
    expect(textOf(status)).not.toContain(unsafeSentinel);
    assertDomTextPrivacy(container.textContent ?? '');
  });

  it('disables every export action while refreshing or exporting', async () => {
    installTokenwatchApi();
    renderPanel({ disabled: true });

    expect(screen.getByRole('button', { name: 'Export local JSON' })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByRole('button', { name: 'Export local Markdown' })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByRole('button', { name: 'Export local PNG' })).toHaveProperty(
      'disabled',
      true
    );

    cleanup();
    Reflect.deleteProperty(window, 'tokenwatch');

    const pendingExport = createDeferred<DesktopShareReportResult>();
    installTokenwatchApi({ exportReport: vi.fn(() => pendingExport.promise) });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Export local PNG' }));

    const panel = screen.getByLabelText('Export local report');
    expect(within(panel).getByRole('button', { name: 'Export local JSON' })).toHaveProperty(
      'disabled',
      true
    );
    expect(within(panel).getByRole('button', { name: 'Exporting PNG' })).toHaveProperty(
      'disabled',
      true
    );
    expect(textOf(screen.getByLabelText('Local export status'))).toContain(
      'Preparing PNG local report.'
    );

    pendingExport.resolve({
      format: 'png',
      fileName: 'tokenwatch-share.png',
      bytesWritten: 512,
      status: 'written'
    });
    await waitFor(() =>
      expect(textOf(screen.getByLabelText('Local export status'))).toContain('512 bytes')
    );
  });
});
