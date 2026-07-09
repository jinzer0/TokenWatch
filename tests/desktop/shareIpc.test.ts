import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.0' },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

import { openDatabase, type TokenWatchDb } from '../../src/db/client.js';
import { UsageEventsRepository } from '../../src/db/repositories/usageEvents.js';
import { createDesktopDbLifecycle } from '../../src/desktop/main/dbLifecycle.js';
import { registerDesktopIpcHandlers } from '../../src/desktop/main/ipc.js';
import type { DesktopIpcChannel } from '../../src/desktop/shared/contracts.js';
import {
  desktopShareIpcChannels,
  type DesktopShareIpcChannel
} from '../../src/desktop/shared/shareContracts.js';
import { createTempDb, createTestEvent } from '../helpers.js';
import { assertExportFilePrivacy, assertIpcPayloadPrivacy } from '../privacyOutput.js';

type TestIpcChannel = DesktopIpcChannel | DesktopShareIpcChannel;
type RegisteredHandler = (_event: unknown, ...args: unknown[]) => unknown;
type RegisteredHandlers = Map<TestIpcChannel, RegisteredHandler>;

const allowedWebContents = { id: 1 };
const unauthorizedWebContents = { id: 2 };
const authorizedEvent = {
  sender: allowedWebContents,
  senderFrame: { url: 'file:///Applications/TokenWatch.app/Contents/Resources/renderer/index.html' }
};
const unauthorizedEvent = {
  sender: unauthorizedWebContents,
  senderFrame: { url: 'file:///Applications/TokenWatch.app/Contents/Resources/renderer/index.html' }
};

const createIpcTarget = () => {
  const handlers: RegisteredHandlers = new Map();
  return {
    handlers,
    target: {
      handle: (channel: TestIpcChannel, listener: RegisteredHandler): void => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel: TestIpcChannel): void => {
        handlers.delete(channel);
      }
    }
  };
};

const invoke = async (handlers: RegisteredHandlers, ...args: unknown[]) =>
  invokeWithEvent(handlers, authorizedEvent, ...args);

const invokeWithEvent = async (
  handlers: RegisteredHandlers,
  event: unknown,
  ...args: unknown[]
) => {
  const handler = handlers.get(desktopShareIpcChannels.shareExportReport);
  expect(handler).toBeDefined();
  return await Promise.resolve(handler?.(event, ...args));
};

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('desktop safe-share IPC handler', () => {
  it('writes JSON safe-share exports with a basename-only result payload', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(createTestEvent({ id: 'desktop-share-json-event' }));
    db.close();
    db = undefined;
    const outputPath = join(temp.dir, 'desktop-share.json');

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => outputPath
    });

    const result = await invoke(handlers, {
      format: 'json',
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });

    expect(result).toEqual({
      format: 'json',
      fileName: 'desktop-share.json',
      bytesWritten: expect.any(Number),
      status: 'written'
    });
    expect(JSON.stringify(result)).not.toContain(temp.dir);
    expect(JSON.stringify(result)).not.toContain(outputPath);
    assertIpcPayloadPrivacy(result);
    const contents = await readFile(outputPath, 'utf8');
    expect(contents).toContain('"kind": "graph"');
    assertExportFilePrivacy(contents);
  });

  it('accepts active filter input and writes a filtered safe-share export', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(
      createTestEvent({ id: 'desktop-share-filtered-event', timestamp: '2026-06-03T12:00:00.000Z' })
    );
    db.close();
    db = undefined;
    const outputPath = join(temp.dir, 'desktop-share-filtered.json');

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => outputPath
    });

    const result = await invoke(handlers, {
      format: 'json',
      filters: { from: '2026-06-01', to: '2026-06-07' },
      report: { kind: 'graph', bucket: 'day', metric: 'tokens' }
    });

    expect(result).toEqual({
      format: 'json',
      fileName: 'desktop-share-filtered.json',
      bytesWritten: expect.any(Number),
      status: 'written'
    });
    expect(JSON.stringify(result)).not.toContain(temp.dir);
    expect(JSON.stringify(result)).not.toContain(outputPath);
    assertIpcPayloadPrivacy(result);
    const contents = await readFile(outputPath, 'utf8');
    expect(contents).toContain('"from": "2026-06-01T00:00:00.000Z"');
    expect(contents).toContain('"to": "2026-06-07T23:59:59.999Z"');
    assertExportFilePrivacy(contents);
  });

  it('writes Markdown and PNG safe-share formats through the same IPC contract', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(createTestEvent({ id: 'desktop-share-formats-event' }));
    db.close();
    db = undefined;
    const outputDir = join(temp.dir, 'exports');
    await mkdir(outputDir);
    const outputPaths = [join(outputDir, 'desktop-share.md'), join(outputDir, 'desktop-share.png')];

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => outputPaths.shift() ?? null
    });

    await expect(
      invoke(handlers, { format: 'markdown', report: { kind: 'wrapped', year: 2026 } })
    ).resolves.toMatchObject({
      format: 'markdown',
      fileName: 'desktop-share.md',
      status: 'written'
    });
    await expect(
      invoke(handlers, {
        format: 'png',
        report: { kind: 'graph', bucket: 'day', metric: 'events' }
      })
    ).resolves.toMatchObject({ format: 'png', fileName: 'desktop-share.png', status: 'written' });
  });

  it('returns a sanitized cancelled safe-share result when the save dialog is cancelled', async () => {
    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ existsSync: () => false }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => null
    });

    await expect(invoke(handlers, { format: 'json', report: { kind: 'graph' } })).resolves.toEqual({
      format: 'json',
      fileName: null,
      bytesWritten: 0,
      status: 'cancelled'
    });
  });

  it('rejects invalid safe-share payloads and output paths with sanitized errors', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(
      createTestEvent({ id: 'desktop-share-invalid-path-event' })
    );
    db.close();
    db = undefined;

    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => ''
    });

    await expect(
      invoke(handlers, {
        format: 'html',
        report: { kind: 'graph' },
        outputPath: '/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK'
      })
    ).rejects.toMatchObject({ code: 'validation_failed', message: 'error: validation_failed' });

    await expect(
      invoke(handlers, { format: 'json', report: { kind: 'graph' } })
    ).rejects.toMatchObject({ code: 'validation_failed', message: 'error: validation_failed' });
  });

  it('rejects safe-share requests from unauthorized senders and origins', async () => {
    const { handlers, target } = createIpcTarget();
    registerDesktopIpcHandlers({
      dbLifecycle: createDesktopDbLifecycle({ existsSync: () => false }),
      ipcMainTarget: target,
      getVersion: () => '0.1.0',
      getAllowedWebContents: () => allowedWebContents,
      chooseShareOutputPath: async () => null
    });

    await expect(
      invokeWithEvent(handlers, unauthorizedEvent, { format: 'json', report: { kind: 'graph' } })
    ).rejects.toMatchObject({ code: 'desktop_ipc_failed', message: 'error: desktop_ipc_failed' });

    await expect(
      invokeWithEvent(
        handlers,
        { sender: allowedWebContents, senderFrame: { url: 'https://evil.example/' } },
        { format: 'json', report: { kind: 'graph' } }
      )
    ).rejects.toMatchObject({ code: 'desktop_ipc_failed', message: 'error: desktop_ipc_failed' });
  });
});
