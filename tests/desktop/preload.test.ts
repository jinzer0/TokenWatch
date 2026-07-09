import { beforeEach, describe, expect, it, vi } from 'vitest';

import { desktopIpcChannels } from '../../src/desktop/shared/contracts.js';
import { desktopShareIpcChannels } from '../../src/desktop/shared/shareContracts.js';
import type { TokenWatchDesktopApi } from '../../src/desktop/shared/api.js';
import { containsPrivacySentinel } from '../helpers.js';

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn()
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electronMock.exposeInMainWorld },
  ipcRenderer: { invoke: electronMock.invoke }
}));

const loadPreloadApi = async (): Promise<TokenWatchDesktopApi> => {
  vi.resetModules();
  await import('../../src/desktop/preload.js');
  const exposed = electronMock.exposeInMainWorld.mock.calls.at(-1);
  expect(exposed?.[0]).toBe('tokenwatch');
  return exposed?.[1] as TokenWatchDesktopApi;
};

beforeEach(() => {
  electronMock.exposeInMainWorld.mockReset();
  electronMock.invoke.mockReset();
});

describe('desktop preload API', () => {
  it('exposes only typed allowlisted methods and no generic IPC helpers', async () => {
    const api = await loadPreloadApi();

    expect(Object.keys(api)).toEqual(['dashboard', 'app', 'share']);
    expect(Object.keys(api.dashboard)).toEqual(['getSnapshot', 'refresh']);
    expect(Object.keys(api.app)).toEqual(['getStatus', 'getVersion']);
    expect(Object.keys(api.share)).toEqual(['exportReport']);
    expect('send' in api).toBe(false);
    expect('invoke' in api).toBe(false);
    expect('on' in api).toBe(false);
    expect('removeListener' in api).toBe(false);
    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.isFrozen(api.dashboard)).toBe(true);
    expect(Object.isFrozen(api.app)).toBe(true);
    expect(Object.isFrozen(api.share)).toBe(true);
  });

  it('invokes the allowlisted channels and forwards typed filters and share options only', async () => {
    const api = await loadPreloadApi();
    electronMock.invoke.mockResolvedValueOnce({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    electronMock.invoke.mockResolvedValueOnce({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    electronMock.invoke.mockResolvedValueOnce({
      app: 'ready',
      database: { status: 'setup-needed' },
      privacy: { sanitized: true }
    });
    electronMock.invoke.mockResolvedValueOnce('0.1.0');
    electronMock.invoke.mockResolvedValueOnce({
      format: 'json',
      fileName: 'usage-share.json',
      bytesWritten: 42,
      status: 'written'
    });

    await api.dashboard.getSnapshot({ from: '2026-05-01', to: '2026-05-01' });
    await api.dashboard.refresh({ from: '2026-05-02' });
    await api.app.getStatus();
    await api.app.getVersion();
    await api.share.exportReport({
      format: 'json',
      filters: { from: '2026-05-01' },
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });

    expect(electronMock.invoke.mock.calls).toEqual([
      [desktopIpcChannels.dashboardGetSnapshot, { from: '2026-05-01', to: '2026-05-01' }],
      [desktopIpcChannels.dashboardRefresh, { from: '2026-05-02' }],
      [desktopIpcChannels.appGetStatus],
      [desktopIpcChannels.appGetVersion],
      [
        desktopShareIpcChannels.shareExportReport,
        {
          format: 'json',
          filters: { from: '2026-05-01' },
          report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
        }
      ]
    ]);
  });

  it('maps raw invoke failures to sanitized renderer-facing errors', async () => {
    const api = await loadPreloadApi();
    electronMock.invoke.mockRejectedValueOnce(
      new Error('/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK select * from usage_events')
    );

    try {
      await api.dashboard.refresh();
      expect.unreachable('refresh should reject with a sanitized preload error');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'desktop_ipc_failed',
        message: 'error: desktop_ipc_failed'
      });
      expect(containsPrivacySentinel(error)).toBe(false);
      expect(JSON.stringify(error)).not.toMatch(/\/tmp|usage_events|select \*/);
    }
  });
});
