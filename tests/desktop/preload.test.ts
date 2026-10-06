import { beforeEach, describe, expect, it, vi } from 'vitest';

import { desktopIpcChannels } from '../../src/desktop/shared/contracts.js';
import { desktopShareIpcChannels } from '../../src/desktop/shared/shareContracts.js';
import { desktopAppearanceIpcChannels } from '../../src/desktop/shared/appearanceContracts.js';
import { desktopSubscriptionIpcChannels } from '../../src/desktop/shared/subscriptionContracts.js';
import { subscriptionSnapshot } from './helpers/rendererFixtures.js';
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

    expect(Object.keys(api).sort()).toEqual([
      'app',
      'appearance',
      'dashboard',
      'share',
      'subscription'
    ]);
    expect(Object.keys(api.subscription)).toEqual(['getSnapshot', 'refresh']);
    expect(Object.isFrozen(api.subscription)).toBe(true);
    expect(Object.keys(api.appearance)).toEqual(['getSettings', 'setTheme']);
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
    expect(Object.isFrozen(api.appearance)).toBe(true);
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

  it('uses only appearance channels with validated metadata responses', async () => {
    const api = await loadPreloadApi();
    electronMock.invoke.mockResolvedValueOnce({ theme: 'graphite', status: 'default' });
    electronMock.invoke.mockResolvedValueOnce({ theme: 'paper', status: 'saved' });
    await expect(api.appearance.getSettings()).resolves.toEqual({
      theme: 'graphite',
      status: 'default'
    });
    await expect(api.appearance.setTheme('paper')).resolves.toEqual({
      theme: 'paper',
      status: 'saved'
    });
    expect(electronMock.invoke.mock.calls).toEqual([
      [desktopAppearanceIpcChannels.getSettings],
      [desktopAppearanceIpcChannels.setTheme, 'paper']
    ]);
    electronMock.invoke.mockResolvedValueOnce({
      theme: 'paper',
      status: 'saved',
      path: '/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK'
    });
    await expect(api.appearance.getSettings()).rejects.toMatchObject({ code: 'validation_failed' });
    electronMock.invoke.mockRejectedValueOnce(
      new Error('/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK')
    );
    try {
      await api.appearance.setTheme('slate');
      expect.unreachable('invoke failure must reject');
    } catch (error) {
      expect(containsPrivacySentinel(error)).toBe(false);
      expect(error).toMatchObject({ code: 'desktop_ipc_failed', stack: undefined });
    }
  });

  it('validates subscription responses and sanitizes unexpected metadata', async () => {
    const api = await loadPreloadApi();
    electronMock.invoke.mockResolvedValueOnce(subscriptionSnapshot());
    electronMock.invoke.mockResolvedValueOnce(subscriptionSnapshot());
    await expect(api.subscription.getSnapshot()).resolves.toEqual(subscriptionSnapshot());
    await expect(api.subscription.refresh()).resolves.toEqual(subscriptionSnapshot());
    expect(electronMock.invoke.mock.calls).toEqual([
      [desktopSubscriptionIpcChannels.getSnapshot],
      [desktopSubscriptionIpcChannels.refresh]
    ]);
    electronMock.invoke.mockResolvedValueOnce({
      ...subscriptionSnapshot(),
      prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK'
    });
    try {
      await api.subscription.getSnapshot();
      expect.unreachable('unsafe response must reject');
    } catch (error) {
      expect(error).toMatchObject({ code: 'validation_failed', stack: undefined });
      expect(containsPrivacySentinel(error)).toBe(false);
    }
  });
});
