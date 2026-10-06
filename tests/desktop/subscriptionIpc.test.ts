import { describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { registerDesktopIpcHandlers } from '../../src/desktop/main/ipc.js';
import { desktopSubscriptionIpcChannels } from '../../src/desktop/shared/subscriptionContracts.js';
import { subscriptionSnapshot } from './helpers/rendererFixtures.js';
import { containsPrivacySentinel } from '../helpers.js';

function setup() {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const frame = { url: 'file:///app/renderer/index.html' };
  const sender = { mainFrame: frame };
  const getSnapshot = vi.fn(() => subscriptionSnapshot());
  const refresh = vi.fn(async () => subscriptionSnapshot());
  const cleanup = registerDesktopIpcHandlers({
    dbLifecycle: {
      readDashboard: vi.fn(() => {
        throw new Error('Usage database must not open');
      })
    } as never,
    subscriptions: { getSnapshot, refresh },
    getAllowedWebContents: () => sender,
    ipcMainTarget: {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      }
    }
  });
  return {
    handlers,
    sender,
    frame,
    getSnapshot,
    refresh,
    cleanup,
    event: { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent
  };
}

describe('subscription IPC', () => {
  it('reads cached metadata without usage DB and refreshes only the specific service', async () => {
    const state = setup();
    await expect(
      state.handlers.get(desktopSubscriptionIpcChannels.getSnapshot)!(state.event)
    ).resolves.toEqual(subscriptionSnapshot());
    expect(state.refresh).not.toHaveBeenCalled();
    await expect(
      state.handlers.get(desktopSubscriptionIpcChannels.refresh)!(state.event)
    ).resolves.toEqual(subscriptionSnapshot());
    expect(state.refresh).toHaveBeenCalledExactlyOnceWith();
    state.cleanup();
    expect(state.handlers.size).toBe(0);
  });

  it.each(Object.values(desktopSubscriptionIpcChannels))(
    'rejects unauthorized frames and unexpected arguments for %s',
    async (channel) => {
      const state = setup();
      const invoke = state.handlers.get(channel)!;
      for (const event of [
        { sender: {}, senderFrame: state.frame },
        { sender: state.sender, senderFrame: null },
        { sender: state.sender, senderFrame: { url: state.frame.url } },
        { sender: { mainFrame: null }, senderFrame: null }
      ])
        await expect(invoke(event as unknown as IpcMainInvokeEvent)).rejects.toMatchObject({
          code: 'desktop_ipc_failed'
        });
      await expect(
        invoke(state.event, { path: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' })
      ).rejects.toMatchObject({ code: 'validation_failed' });
      expect(state.refresh).not.toHaveBeenCalled();
      expect(state.getSnapshot).not.toHaveBeenCalled();
    }
  );

  it('rejects unsanitized service results without exposing source validation errors', async () => {
    const state = setup();
    state.getSnapshot.mockReturnValue({
      ...subscriptionSnapshot(),
      account: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK'
    } as never);
    try {
      await state.handlers.get(desktopSubscriptionIpcChannels.getSnapshot)!(state.event);
      expect.unreachable('invalid metadata must reject');
    } catch (error) {
      expect(error).toMatchObject({ code: 'validation_failed', stack: undefined });
      expect(containsPrivacySentinel(error)).toBe(false);
    }
  });
});
