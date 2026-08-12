import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenWatchDb } from '../src/db/client.js';
import { createTempDb } from './helpers.js';

type DatabaseModule = typeof import('../src/db/client.js');
type ContainerModule = typeof import('../src/services/container.js');

afterEach(() => {
  vi.doUnmock('../src/db/client.js');
  vi.restoreAllMocks();
  vi.resetModules();
  process.exitCode = undefined;
});

describe('audit CLI database lifecycle', () => {
  it('closes each audit database before the next in-process invocation', async () => {
    // Given: audit command database opens are captured against one temporary database path.
    const temporary = createTempDb();
    const databaseModule = await vi.importActual<DatabaseModule>('../src/db/client.js');
    const openedDatabases: TokenWatchDb[] = [];
    vi.doMock('../src/db/client.js', () => ({
      ...databaseModule,
      openDatabase: () => {
        const database = databaseModule.openDatabase(temporary.dbPath);
        openedDatabases.push(database);
        return database;
      }
    }));

    try {
      const { main } = await import('../src/cli.js');

      // When: audit is invoked repeatedly through its public CLI entrypoint.
      await main(['node', 'tokenwatch', 'audit', '--json']);
      await main(['node', 'tokenwatch', 'audit', '--json']);

      // Then: each command releases its handle and the database can be reopened.
      expect(openedDatabases.map((database) => database.open)).toEqual([false, false]);
      const reopenedDatabase = databaseModule.openDatabase(temporary.dbPath);
      expect(reopenedDatabase.open).toBe(true);
      reopenedDatabase.close();
    } finally {
      for (const database of openedDatabases) {
        if (database.open) database.close();
      }
      temporary.cleanup();
    }
  });

  it('closes the audit database when report construction fails', async () => {
    // Given: the audit service fails after the command obtains a database connection.
    const temporary = createTempDb();
    const databaseModule = await vi.importActual<DatabaseModule>('../src/db/client.js');
    const openedDatabases: TokenWatchDb[] = [];
    vi.doMock('../src/db/client.js', () => ({
      ...databaseModule,
      openDatabase: () => {
        const database = databaseModule.openDatabase(temporary.dbPath);
        openedDatabases.push(database);
        return database;
      }
    }));
    const containerModule = await vi.importActual<ContainerModule>('../src/services/container.js');
    vi.doMock('../src/services/container.js', () => ({
      ...containerModule,
      createServices: (database: TokenWatchDb) => ({
        ...containerModule.createServices(database),
        audit: {
          build: () => {
            throw new Error('forced_audit_build_failure');
          }
        }
      })
    }));

    try {
      const { main } = await import('../src/cli.js');

      // When: report construction throws through the command boundary.
      await main(['node', 'tokenwatch', 'audit', '--json']);

      // Then: the failure is sanitized and its connection has still been released.
      expect(process.exitCode).toBe(1);
      expect(openedDatabases.map((database) => database.open)).toEqual([false]);
    } finally {
      for (const database of openedDatabases) {
        if (database.open) database.close();
      }
      temporary.cleanup();
    }
  });
});
