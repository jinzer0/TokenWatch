import Database from 'better-sqlite3';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDbPath, resolveSubscriptionMetadataPath } from '../src/app/paths.js';
import { SubscriptionMetadataRepository } from '../src/db/subscriptionMetadata.js';
import { openDatabase, openReadonlyDatabase } from '../src/db/client.js';
import type { SubscriptionReadResult } from '../src/desktop/shared/subscriptionContracts.js';
import { containsPrivacySentinel, createTempDb, privacySentinels } from './helpers.js';

const receivedAt = '2026-09-01T00:00:00.000Z';
const message = 'Subscription metadata storage unavailable';
function success(usedPercent: number | null = 0): SubscriptionReadResult {
  return {
    provider: 'codex',
    availability: 'available',
    failure: 'none',
    receivedAt,
    windows: [
      {
        provider: 'codex',
        pool: 'codex',
        windowSeconds: 18000,
        usedPercent,
        remainingPercent: usedPercent === null ? null : 100 - usedPercent,
        usedAmount: null,
        limitAmount: null,
        unit: null,
        cycleStartAt: null,
        resetAt: null,
        sourceObservedAt: null,
        receivedAt,
        availability: 'available',
        freshness: 'time-unverified'
      }
    ]
  };
}
function failure(): SubscriptionReadResult {
  return {
    provider: 'codex',
    availability: 'error',
    failure: 'client-failed',
    receivedAt: '2026-09-02T00:00:00.000Z',
    windows: []
  };
}

describe('independent subscription metadata repository', () => {
  const cleanups: (() => void)[] = [];
  const resources: { close(): void }[] = [];
  afterEach(() => {
    for (const resource of resources.splice(0).reverse()) resource.close();
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
  function fixture() {
    const temp = createTempDb();
    cleanups.push(temp.cleanup);
    return { ...temp, metadataPath: join(temp.dir, 'subscription-metadata.db') };
  }
  function repository(path: string) {
    const repo = new SubscriptionMetadataRepository(path);
    resources.push(repo);
    return repo;
  }
  function raw(path: string) {
    const db = new Database(path);
    resources.push(db);
    return db;
  }

  it('isolates observations for different database filenames in the same directory', () => {
    const { dir } = fixture();
    const a = resolveSubscriptionMetadataPath({ TOKENWATCH_DB_PATH: join(dir, 'a.db') });
    const b = resolveSubscriptionMetadataPath({ TOKENWATCH_DB_PATH: join(dir, 'b.db') });
    expect(a).toBe(join(dir, 'a.db.subscription-metadata.db'));
    expect(b).toBe(join(dir, 'b.db.subscription-metadata.db'));
    const first = repository(a);
    const second = repository(b);
    first.append(success(25));
    expect(second.latest('codex')).toBeNull();
    second.append(success(75));
    expect(first.latest('codex')).toEqual(success(25));
    expect(second.latest('codex')).toEqual(success(75));
    first.close();
    second.close();
    expect(repository(a).latest('codex')).toEqual(success(25));
    expect(repository(b).latest('codex')).toEqual(success(75));
  });

  it.each([
    ['relative.db', resolve('relative.db')],
    ['~/profile.db', join(homedir(), 'profile.db')]
  ])('associates metadata with the expanded full database path for %s', (override, expected) => {
    const env = { TOKENWATCH_DB_PATH: override };
    expect(resolveDbPath(env)).toBe(expected);
    expect(resolveSubscriptionMetadataPath(env)).toBe(`${expected}.subscription-metadata.db`);
  });

  it('keeps memory overrides ephemeral and isolated without resolving them to disk', () => {
    const env = { TOKENWATCH_DB_PATH: ':memory:' };
    expect(resolveDbPath(env)).toBe(':memory:');
    expect(resolveSubscriptionMetadataPath(env)).toBe(':memory:');
    const first = repository(resolveSubscriptionMetadataPath(env));
    const second = repository(resolveSubscriptionMetadataPath(env));
    first.append(success(25));
    expect(second.latest('codex')).toBeNull();
    first.close();
    expect(repository(resolveSubscriptionMetadataPath(env)).latest('codex')).toBeNull();
  });

  it('creates an identified versioned store, restricts permissions, and preserves null and zero on reopen', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    expect(repo.latest('codex')).toBeNull();
    expect(repo.latestSuccess('codex')).toBeNull();
    repo.append(success(null));
    expect(repo.latest('codex')).toEqual(success(null));
    repo.append(success(0));
    repo.close();
    resources.splice(resources.indexOf(repo), 1);
    const reopened = repository(metadataPath);
    expect(reopened.latest('codex')).toEqual(success(0));
    expect(reopened.latest('claude')).toBeNull();
    expect(statSync(metadataPath).mode & 0o777).toBe(0o600);
    const db = raw(metadataPath);
    expect(db.pragma('application_id', { simple: true })).toBe(0x5457534d);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.prepare('SELECT count(*) AS count FROM subscription_observations').get()).toEqual({
      count: 2
    });
  });

  it('stores failed attempts separately from the last success and orders by observation ID, not timestamp', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    repo.append(success(12));
    repo.append(failure());
    expect(repo.latest('codex')).toEqual(failure());
    expect(repo.latestSuccess('codex')).toEqual(success(12));
    // Older source time is preserved rather than replaced or bucketed.
    repo.append(success(100));
    expect(repo.latest('codex')).toEqual(success(100));
    const db = raw(metadataPath);
    expect(
      db.prepare('SELECT id, received_at FROM subscription_observations ORDER BY id').all()
    ).toEqual([
      { id: 1, received_at: receivedAt },
      { id: 2, received_at: failure().receivedAt },
      { id: 3, received_at: receivedAt }
    ]);
  });

  it('round trips only explicit amount, unit, cycle and source time evidence', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    const result = success(25);
    Object.assign(result.windows[0]!, {
      usedAmount: 0,
      limitAmount: 100,
      unit: 'credits',
      cycleStartAt: '2026-08-31T00:00:00.000Z',
      resetAt: '2026-09-03T00:00:00.000Z',
      sourceObservedAt: '2026-08-31T23:59:00.000Z',
      freshness: 'fresh'
    });
    repo.append(result);
    expect(repo.latest('codex')).toEqual(result);
  });

  it('rejects extra private fields and inconsistent windows without partial writes or private errors', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    repo.append(success());
    const invalid = [
      { ...success(), accountId: privacySentinels[0] },
      { ...success(), windows: [{ ...success().windows[0], token: privacySentinels[1] }] },
      { ...success(), windows: [{ ...success().windows[0], remainingPercent: 40 }] },
      { ...success(), windows: [{ ...success().windows[0], provider: 'claude' }] },
      { ...success(), windows: Array.from({ length: 33 }, () => success().windows[0]) },
      { ...success(), receivedAt: privacySentinels[2] }
    ];
    for (const input of invalid) {
      expect(() => repo.append(input as SubscriptionReadResult)).toThrow(message);
    }
    const db = raw(metadataPath);
    expect(db.prepare('SELECT count(*) AS count FROM subscription_observations').get()).toEqual({
      count: 1
    });
    expect(db.prepare('SELECT count(*) AS count FROM subscription_windows').get()).toEqual({
      count: 1
    });
    expect(
      containsPrivacySentinel(db.prepare('SELECT * FROM subscription_observations').all())
    ).toBe(false);
    expect(containsPrivacySentinel(db.prepare('SELECT * FROM subscription_windows').all())).toBe(
      false
    );
    const columns = db.prepare('PRAGMA table_info(subscription_windows)').all() as {
      name: string;
    }[];
    expect(columns.map((column) => column.name).join(',')).not.toMatch(
      /json|account|token|path|session|remaining/
    );
  });

  it('rolls back the header and all windows when a later window insert fails', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    const db = raw(metadataPath);
    db.exec(`CREATE TRIGGER reject_second_window BEFORE INSERT ON subscription_windows
      WHEN NEW.ordinal = 1 BEGIN SELECT RAISE(ABORT, 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK'); END`);
    const result = success();
    result.windows.push({ ...result.windows[0]!, windowSeconds: 604800 });
    expect(() => repo.append(result)).toThrow(message);
    expect(db.prepare('SELECT count(*) AS count FROM subscription_observations').get()).toEqual({
      count: 0
    });
    expect(db.prepare('SELECT count(*) AS count FROM subscription_windows').get()).toEqual({
      count: 0
    });
    db.exec('DROP TRIGGER reject_second_window');
    repo.append(success());
    expect(repo.latest('codex')).toEqual(success());
  });

  it.each(['future', 'older-invalid', 'foreign-id', 'extra-table', 'altered-table'] as const)(
    'rejects %s schema state without overwriting the file',
    (state) => {
      const { metadataPath } = fixture();
      const repo = repository(metadataPath);
      repo.append(success());
      repo.close();
      resources.splice(resources.indexOf(repo), 1);
      const db = raw(metadataPath);
      if (state === 'future') db.pragma('user_version = 2');
      if (state === 'older-invalid') db.pragma('user_version = 0');
      if (state === 'foreign-id') db.pragma('application_id = 123');
      if (state === 'extra-table') db.exec('CREATE TABLE foreign_records(value TEXT)');
      if (state === 'altered-table')
        db.exec('ALTER TABLE subscription_observations ADD COLUMN private_dump TEXT');
      db.close();
      resources.splice(resources.indexOf(db), 1);
      const before = readFileSync(metadataPath);
      expect(() => repository(metadataPath)).toThrow(message);
      expect(readFileSync(metadataPath)).toEqual(before);
      expect(
        raw(metadataPath).prepare('SELECT count(*) AS count FROM subscription_observations').get()
      ).toEqual({ count: 1 });
    }
  );

  it('rejects an unidentified foreign database and preserves its rows and bytes', () => {
    const { metadataPath } = fixture();
    const db = raw(metadataPath);
    db.exec(
      "CREATE TABLE foreign_records(value TEXT); INSERT INTO foreign_records VALUES ('synthetic')"
    );
    db.close();
    resources.splice(resources.indexOf(db), 1);
    const before = readFileSync(metadataPath);
    expect(() => repository(metadataPath)).toThrow(message);
    expect(readFileSync(metadataPath)).toEqual(before);
    expect(raw(metadataPath).prepare('SELECT * FROM foreign_records').all()).toEqual([
      { value: 'synthetic' }
    ]);
  });

  it('retains provider failures without inventing any successful history', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    repo.append(failure());
    expect(repo.latest('codex')).toEqual(failure());
    expect(repo.latestSuccess('codex')).toBeNull();
    const unsupported: SubscriptionReadResult = {
      provider: 'cursor',
      availability: 'unsupported',
      failure: 'unsupported',
      receivedAt,
      windows: []
    };
    repo.append(unsupported);
    expect(repo.latest('cursor')).toEqual(unsupported);
    expect(repo.latestSuccess('cursor')).toBeNull();
  });

  it('rejects oversized malicious rows without truncating them into a plausible result', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    repo.append(success());
    const db = raw(metadataPath);
    db.pragma('ignore_check_constraints = ON');
    db.exec(`INSERT INTO subscription_windows
      SELECT observation_id, 32, pool, 604800, used_percent, used_amount, limit_amount,
             unit, cycle_start_at, reset_at, source_observed_at, freshness
      FROM subscription_windows WHERE ordinal = 0`);
    expect(() => repo.latest('codex')).toThrow(message);
    db.exec('UPDATE subscription_observations SET window_count = 33');
    expect(() => repo.latest('codex')).toThrow(message);
  });

  it.each([
    'private-timestamp',
    'invalid-percent',
    'missing-window',
    'wrong-count',
    'invalid-ordinal'
  ] as const)(
    'safely rejects corrupt %s rows instead of returning unchecked metadata',
    (corruption) => {
      const { metadataPath } = fixture();
      const repo = repository(metadataPath);
      repo.append(success());
      const db = raw(metadataPath);
      if (corruption === 'private-timestamp') {
        db.prepare('UPDATE subscription_windows SET source_observed_at = ?').run(
          privacySentinels[0]
        );
      }
      if (corruption === 'invalid-percent')
        db.exec('UPDATE subscription_windows SET used_percent = 101');
      if (corruption === 'missing-window') db.exec('DELETE FROM subscription_windows');
      if (corruption === 'wrong-count')
        db.exec('UPDATE subscription_observations SET window_count = 32');
      if (corruption === 'invalid-ordinal') db.exec('UPDATE subscription_windows SET ordinal = 1');
      expect(() => repo.latest('codex')).toThrow(message);
      expect(() => repo.latestSuccess('codex')).toThrow(message);
    }
  );

  it('accepts the bounded maximum and never fabricates missing window buckets', () => {
    const { metadataPath } = fixture();
    const repo = repository(metadataPath);
    const result = success(null);
    result.windows = Array.from({ length: 32 }, (_, index) => ({
      ...result.windows[0]!,
      windowSeconds: index + 1
    }));
    repo.append(result);
    expect(repo.latest('codex')).toEqual(result);
    expect(repo.latest('cursor')).toBeNull();
  });

  it('never modifies the read-only usage DB and rejects it as a metadata destination', () => {
    const { dbPath, metadataPath } = fixture();
    const usage = openDatabase(dbPath);
    usage.close();
    const before = readFileSync(dbPath);
    const usageReader = openReadonlyDatabase(dbPath);
    resources.push(usageReader);
    const schema = usageReader.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all();
    const repo = repository(metadataPath);
    repo.append(success());
    repo.append(failure());
    expect(() => repository(dbPath)).toThrow(message);
    expect(usageReader.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all()).toEqual(
      schema
    );
    expect(readFileSync(dbPath)).toEqual(before);
  });

  it('uses generic errors for native open failures and invalid providers', () => {
    const { dir, metadataPath } = fixture();
    expect(() => repository(dir)).toThrow(message);
    const repo = repository(metadataPath);
    expect(() => repo.latest(privacySentinels[0] as 'codex')).toThrow(message);
    expect(() => repo.latestSuccess(privacySentinels[0] as 'codex')).toThrow(message);
    repo.close();
    resources.splice(resources.indexOf(repo), 1);
    expect(() => repo.append(success())).toThrow(message);
    expect(() => repo.latest('codex')).toThrow(message);
  });
});
