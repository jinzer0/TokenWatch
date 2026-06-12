import { existsSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveDbPath } from '../../src/app/paths.js';
import { openDatabase, type TokenWatchDb } from '../../src/db/client.js';
import { UsageEventsRepository } from '../../src/db/repositories/usageEvents.js';
import { createServices } from '../../src/services/container.js';
import {
  createDesktopDbLifecycle,
  type DesktopDashboardSnapshot
} from '../../src/desktop/main/dbLifecycle.js';
import { createTempDb, createTestEvent } from '../helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('desktop main database lifecycle', () => {
  it('resolves the CLI/TUI database path and reads the dashboard through a read-only handle', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(createTestEvent({ id: 'desktop-readonly-event' }));
    db.close();
    db = undefined;

    const lifecycle = createDesktopDbLifecycle({
      env: { TOKENWATCH_DB_PATH: temp.dbPath }
    });

    const snapshot = lifecycle.readDashboard();

    expect(resolveDbPath({ TOKENWATCH_DB_PATH: temp.dbPath })).toBe(temp.dbPath);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.dashboard?.totals.events).toBe(1);
    expect(snapshot.dashboard?.privacy).toEqual({ sanitized: true });

    lifecycle.close();
  });

  it('smokes a native temp database and removes its temp directory after closing handles', () => {
    const temp = createTempDb();
    db = openDatabase(temp.dbPath);
    new UsageEventsRepository(db).insert(createTestEvent({ id: 'desktop-native-smoke-event' }));
    db.close();
    db = undefined;

    const lifecycle = createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } });
    const snapshot = lifecycle.readDashboard();
    lifecycle.close();

    expect(snapshot).toMatchObject({
      status: 'ready',
      dashboard: { totals: { events: 1 }, privacy: { sanitized: true } },
      privacy: { sanitized: true }
    });
    expect(existsSync(temp.dir)).toBe(true);
    temp.cleanup();
    expect(existsSync(temp.dir)).toBe(false);
  });

  it('returns a sanitized setup-needed response when the database file is missing', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;

    const lifecycle = createDesktopDbLifecycle({
      env: { TOKENWATCH_DB_PATH: temp.dbPath }
    });

    const snapshot = lifecycle.readDashboard();

    expect(snapshot).toEqual({
      status: 'setup-needed',
      dashboard: null,
      privacy: { sanitized: true }
    });
    expect(JSON.stringify(snapshot)).not.toContain(temp.dbPath);
    expect(JSON.stringify(snapshot)).not.toContain(temp.dir);
  });

  it('does not disclose raw paths when a present database cannot be opened', () => {
    const snapshot = createDesktopDbLifecycle({
      env: { TOKENWATCH_DB_PATH: '/tmp/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK/tokenwatch.db' },
      existsSync: () => true,
      openReadonlyDatabase: () => {
        throw new Error('open failed');
      }
    }).readDashboard();

    expect(snapshot).toEqual({
      status: 'database-unavailable',
      dashboard: null,
      privacy: { sanitized: true }
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK|\/tmp\//);
  });

  it('closes the main-owned database handle during explicit lifecycle cleanup', () => {
    const close = vi.fn();
    const fakeDb = { open: true, close } as unknown as TokenWatchDb;
    const fakeDashboard = { kind: 'desktop-dashboard' } as NonNullable<
      DesktopDashboardSnapshot['dashboard']
    >;

    const lifecycle = createDesktopDbLifecycle({
      env: { TOKENWATCH_DB_PATH: 'tokenwatch.db' },
      existsSync: () => true,
      openReadonlyDatabase: () => fakeDb,
      createServices: (() => ({
        ...createServices(fakeDb),
        desktopDashboard: {
          buildDashboard: () => fakeDashboard
        }
      })) as typeof createServices
    });

    expect(lifecycle.readDashboard()).toMatchObject({ status: 'ready' });
    lifecycle.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
