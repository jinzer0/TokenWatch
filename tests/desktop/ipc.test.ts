import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.0' },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

import { openDatabase, type TokenWatchDb } from '../../src/db/client.js';
import { UsageEventsRepository } from '../../src/db/repositories/usageEvents.js';
import {
  createDesktopDbLifecycle,
  type DesktopDbLifecycle
} from '../../src/desktop/main/dbLifecycle.js';
import { registerDesktopIpcHandlers } from '../../src/desktop/main/ipc.js';
import { desktopIpcChannels, type DesktopIpcChannel } from '../../src/desktop/shared/contracts.js';
import { TokenWatchDesktopIpcError } from '../../src/desktop/shared/ipcErrors.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from '../helpers.js';

type RegisteredHandler = (_event: unknown, ...args: unknown[]) => unknown;
type RegisteredHandlers = Map<DesktopIpcChannel, RegisteredHandler>;

const createIpcTarget = () => {
  const handlers: RegisteredHandlers = new Map();
  return {
    handlers,
    target: {
      handle: (channel: DesktopIpcChannel, listener: RegisteredHandler): void => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel: DesktopIpcChannel): void => {
        handlers.delete(channel);
      }
    }
  };
};

const invoke = async (
  handlers: RegisteredHandlers,
  channel: DesktopIpcChannel,
  ...args: unknown[]
) => {
  const handler = handlers.get(channel);
  expect(handler).toBeDefined();
  return await Promise.resolve(handler?.({}, ...args));
};

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('desktop IPC handlers', () => {
  it('registers only the allowlisted request-response channels', () => {
    const { handlers, target } = createIpcTarget();
    const unregister = registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ existsSync: () => false }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0'
    });

    expect([...handlers.keys()].sort()).toEqual(
      [
        desktopIpcChannels.appGetStatus,
        desktopIpcChannels.appGetVersion,
        desktopIpcChannels.dashboardGetSnapshot,
        desktopIpcChannels.dashboardRefresh
      ].sort()
    );

    unregister();

    expect(handlers.size).toBe(0);
  });

  it('returns a sanitized dashboard snapshot from a temp database', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(createTestEvent({ id: 'desktop-ipc-event' }));
    db.close();
    db = undefined;

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0'
    });

    const snapshot = await invoke(handlers, desktopIpcChannels.dashboardGetSnapshot);

    expect(snapshot).toMatchObject({
      status: 'ready',
      privacy: { sanitized: true },
      dashboard: { totals: { events: 1 }, privacy: { sanitized: true } }
    });
    expect(containsPrivacySentinel(snapshot)).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain(temp.dbPath);
    expect(JSON.stringify(snapshot)).not.toContain(temp.dir);
  });

  it('returns setup-needed status without raw missing database paths', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0'
    });

    await expect(invoke(handlers, desktopIpcChannels.dashboardRefresh)).resolves.toEqual({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    await expect(invoke(handlers, desktopIpcChannels.appGetStatus)).resolves.toEqual({
      app: 'ready',
      database: { status: 'setup-needed' },
      privacy: { sanitized: true }
    });

    const status = await invoke(handlers, desktopIpcChannels.appGetStatus);
    expect(JSON.stringify(status)).not.toContain(temp.dbPath);
    expect(JSON.stringify(status)).not.toContain(temp.dir);
  });

  it('rejects unexpected renderer payload arguments with a stable sanitized error', async () => {
    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ existsSync: () => false }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0'
    });

    try {
      await invoke(handlers, desktopIpcChannels.dashboardGetSnapshot, {
        path: '/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK'
      });
      expect.unreachable('unexpected renderer payload should be rejected');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'validation_failed',
        message: 'error: validation_failed'
      });
      expect(containsPrivacySentinel(error)).toBe(false);
      expect(JSON.stringify(error)).not.toMatch(/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK|\/tmp/);
    }
  });

  it('sanitizes thrown errors without leaking raw paths or sentinel text', async () => {
    const { handlers, target } = createIpcTarget();
    const dbLifecycle = {
      readDashboard: () => {
        throw new Error('/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK select * from usage_events');
      }
    } as DesktopDbLifecycle;

    registerDesktopIpcHandlers({ dbLifecycle, ipcMainTarget: target, getVersion: () => '0.1.0' });

    await expect(invoke(handlers, desktopIpcChannels.dashboardRefresh)).rejects.toBeInstanceOf(
      TokenWatchDesktopIpcError
    );

    try {
      await invoke(handlers, desktopIpcChannels.dashboardRefresh);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'desktop_ipc_failed',
        message: 'error: desktop_ipc_failed'
      });
      expect(containsPrivacySentinel(error)).toBe(false);
      expect(JSON.stringify(error)).not.toContain('/tmp/');
      expect(JSON.stringify(error)).not.toContain('select *');
    }
  });

  it('returns only the sanitized version string for app:getVersion', async () => {
    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ existsSync: () => false }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0'
    });

    await expect(invoke(handlers, desktopIpcChannels.appGetVersion)).resolves.toBe('0.1.0');
  });
});
