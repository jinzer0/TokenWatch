import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

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
import { assertExportFilePrivacy } from '../privacyOutput.js';

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

  it('exports trend reports from all events instead of dashboard-filtered events', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const now = Date.now();
    const currentTimestamp = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const previousTimestamp = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const filterFrom = dateOnly(new Date(now - 3 * 24 * 60 * 60 * 1000));
    const filterTo = dateOnly(new Date(now));
    const repository = new UsageEventsRepository(db);
    repository.insert(
      createTestEvent({
        id: 'desktop-trend-current-event',
        timestamp: currentTimestamp,
        inputTokens: 120,
        outputTokens: 80,
        cachedTokens: 0,
        reasoningTokens: 0,
        totalTokens: 200
      })
    );
    repository.insert(
      createTestEvent({
        id: 'desktop-trend-previous-event',
        timestamp: previousTimestamp,
        inputTokens: 60,
        outputTokens: 40,
        cachedTokens: 0,
        reasoningTokens: 0,
        totalTokens: 100
      })
    );
    db.close();
    db = undefined;

    const lifecycle = createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } });
    const outputPath = `${temp.dir}/desktop-trend-share.json`;

    const result = await lifecycle.writeShareReport(
      {
        format: 'json',
        filters: { from: filterFrom, to: filterTo, fromTimestamp: null, toTimestamp: null },
        report: { kind: 'trend', window: '7d' }
      },
      outputPath
    );

    const payload = JSON.parse(await readFile(outputPath, 'utf8')) as {
      readonly kind: string;
      readonly totals: {
        readonly current: { readonly tokens: number };
        readonly previous: { readonly tokens: number };
      };
      readonly trendScope: string;
    };
    expect(result).toMatchObject({ format: 'json', fileName: 'desktop-trend-share.json' });
    expect(payload.kind).toBe('trend');
    expect(payload.trendScope).toBe('all-events-rolling');
    expect(payload.totals.current.tokens).toBe(200);
    expect(payload.totals.previous.tokens).toBe(100);
    lifecycle.close();
  });

  it('passes current budget evaluations into desktop trend share exports', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    services.usageEvents.insert(
      createTestEvent({
        id: 'desktop-trend-budget-event',
        timestamp: new Date().toISOString(),
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        reasoningTokens: 0,
        totalTokens: 150,
        estimatedCostUsd: 0.4
      })
    );
    services.budget.setThreshold({ scopeKind: 'monthly_total', thresholdUsd: 0.2 });
    db.close();
    db = undefined;
    const lifecycle = createDesktopDbLifecycle({ env: { TOKENWATCH_DB_PATH: temp.dbPath } });
    const outputPath = `${temp.dir}/desktop-trend-budget-share.json`;

    const result = await lifecycle.writeShareReport(
      {
        format: 'json',
        report: { kind: 'trend', window: '7d' }
      },
      outputPath
    );

    const contents = await readFile(outputPath, 'utf8');
    const payload: unknown = JSON.parse(contents);
    expect(result).toMatchObject({ format: 'json', fileName: 'desktop-trend-budget-share.json' });
    expect(payload).toMatchObject({
      kind: 'trend',
      budgetPressure: {
        status: 'over',
        ratio: 2,
        knownSpendUsd: 0.4,
        thresholdUsd: 0.2
      }
    });
    expect(contents).not.toContain('$0.00');
    assertExportFilePrivacy(contents);
    lifecycle.close();
  });
});

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
