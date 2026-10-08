import Database from 'better-sqlite3';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  subscriptionProviderSchema,
  subscriptionReadResultSchema,
  type SubscriptionProvider,
  type SubscriptionReadResult
} from '../desktop/shared/subscriptionContracts.js';

const APPLICATION_ID = 0x5457534d;
const VERSION = 1;
const ERROR_MESSAGE = 'Subscription metadata storage unavailable';
const definitions = [
  `CREATE TABLE subscription_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    availability TEXT NOT NULL,
    failure TEXT NOT NULL,
    received_at TEXT NOT NULL,
    window_count INTEGER NOT NULL CHECK (window_count BETWEEN 0 AND 32)
  )`,
  `CREATE TABLE subscription_windows (
    observation_id INTEGER NOT NULL REFERENCES subscription_observations(id),
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 31),
    pool TEXT NOT NULL,
    window_seconds INTEGER,
    used_percent REAL,
    used_amount REAL,
    limit_amount REAL,
    unit TEXT,
    cycle_start_at TEXT,
    reset_at TEXT,
    source_observed_at TEXT,
    freshness TEXT NOT NULL,
    PRIMARY KEY (observation_id, ordinal)
  )`,
  'CREATE INDEX subscription_latest ON subscription_observations(provider, id DESC)',
  "CREATE INDEX subscription_latest_success ON subscription_observations(provider, id DESC) WHERE availability = 'available' AND failure = 'none'"
];

type ObservationRow = {
  id: number;
  provider: string;
  availability: string;
  failure: string;
  received_at: string;
  window_count: number;
};
type WindowRow = {
  ordinal: number;
  pool: string;
  window_seconds: number | null;
  used_percent: number | null;
  used_amount: number | null;
  limit_amount: number | null;
  unit: string | null;
  cycle_start_at: string | null;
  reset_at: string | null;
  source_observed_at: string | null;
  freshness: string;
};

/** Every observation ID is an independent, unverified continuity epoch. */
export class SubscriptionMetadataRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    let db: Database.Database | undefined;
    try {
      if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
      db = new Database(path);
      db.pragma('busy_timeout = 5000');
      db.pragma('foreign_keys = ON');
      const connection = db;
      connection
        .transaction(() => {
          const version = connection.pragma('user_version', { simple: true });
          const application = connection.pragma('application_id', { simple: true });
          const objects = connection
            .prepare('SELECT sql FROM sqlite_master ORDER BY name')
            .all() as {
            sql: string | null;
          }[];
          if (version === 0 && application === 0 && objects.length === 0) {
            for (const definition of definitions) connection.exec(definition);
            connection.pragma(`application_id = ${APPLICATION_ID}`);
            connection.pragma(`user_version = ${VERSION}`);
          } else {
            const expected = [...definitions, 'CREATE TABLE sqlite_sequence(name,seq)', null];
            if (
              version !== VERSION ||
              application !== APPLICATION_ID ||
              objects.length !== expected.length ||
              expected.some((sql) => objects.filter((object) => object.sql === sql).length !== 1)
            )
              throw new Error(ERROR_MESSAGE);
          }
        })
        .immediate();
      if (path !== ':memory:') chmodSync(path, 0o600);
      this.db = db;
    } catch {
      try {
        db?.close();
      } catch {
        /* Initialization must not leak native errors. */
      }
      throw new Error(ERROR_MESSAGE);
    }
  }

  append(result: SubscriptionReadResult): void {
    try {
      const parsed = subscriptionReadResultSchema.parse(result);
      this.db.transaction(() => {
        const inserted = this.db
          .prepare(
            `
          INSERT INTO subscription_observations
          (provider, availability, failure, received_at, window_count) VALUES (?, ?, ?, ?, ?)
        `
          )
          .run(
            parsed.provider,
            parsed.availability,
            parsed.failure,
            parsed.receivedAt,
            parsed.windows.length
          );
        const insertWindow = this.db.prepare(`
          INSERT INTO subscription_windows
          (observation_id, ordinal, pool, window_seconds, used_percent, used_amount,
           limit_amount, unit, cycle_start_at, reset_at, source_observed_at, freshness)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        parsed.windows.forEach((window, ordinal) => {
          insertWindow.run(
            inserted.lastInsertRowid,
            ordinal,
            window.pool,
            window.windowSeconds,
            window.usedPercent,
            window.usedAmount,
            window.limitAmount,
            window.unit,
            window.cycleStartAt,
            window.resetAt,
            window.sourceObservedAt,
            window.freshness
          );
        });
      })();
    } catch {
      throw new Error(ERROR_MESSAGE);
    }
  }

  latest(provider: SubscriptionProvider): SubscriptionReadResult | null {
    return this.read(provider, false);
  }

  latestSuccess(provider: SubscriptionProvider): SubscriptionReadResult | null {
    return this.read(provider, true);
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      throw new Error(ERROR_MESSAGE);
    }
  }

  private read(provider: SubscriptionProvider, success: boolean): SubscriptionReadResult | null {
    try {
      subscriptionProviderSchema.parse(provider);
      return this.db.transaction(() => {
        const observation = this.db
          .prepare(
            `
          SELECT id, provider, availability, failure, received_at, window_count
          FROM subscription_observations WHERE provider = ?
          ${
            success
              ? `AND availability = 'available' AND failure = 'none'
          AND id > COALESCE((SELECT MAX(blocked.id) FROM subscription_observations AS blocked
            WHERE blocked.provider = subscription_observations.provider
              AND blocked.availability IN ('usage-blocked', 'usage-unverified')), 0)`
              : ''
          }
          ORDER BY id DESC LIMIT 1
        `
          )
          .get(provider) as ObservationRow | undefined;
        if (!observation) return null;
        if (
          !Number.isSafeInteger(observation.id) ||
          observation.id < 1 ||
          !Number.isInteger(observation.window_count) ||
          observation.window_count < 0 ||
          observation.window_count > 32
        )
          throw new Error(ERROR_MESSAGE);
        const count = this.db
          .prepare('SELECT count(*) AS count FROM subscription_windows WHERE observation_id = ?')
          .get(observation.id) as { count: number };
        if (count.count !== observation.window_count) throw new Error(ERROR_MESSAGE);
        const rows = this.db
          .prepare(
            `
          SELECT ordinal, pool, window_seconds, used_percent, used_amount, limit_amount,
                 unit, cycle_start_at, reset_at, source_observed_at, freshness
          FROM subscription_windows WHERE observation_id = ? ORDER BY ordinal LIMIT 32
        `
          )
          .all(observation.id) as WindowRow[];
        const windows = rows.map((row, ordinal) => {
          if (row.ordinal !== ordinal) throw new Error(ERROR_MESSAGE);
          return {
            provider: observation.provider,
            pool: row.pool,
            windowSeconds: row.window_seconds,
            usedPercent: row.used_percent,
            remainingPercent: row.used_percent === null ? null : 100 - row.used_percent,
            usedAmount: row.used_amount,
            limitAmount: row.limit_amount,
            unit: row.unit,
            cycleStartAt: row.cycle_start_at,
            resetAt: row.reset_at,
            sourceObservedAt: row.source_observed_at,
            receivedAt: observation.received_at,
            availability: observation.availability,
            freshness: row.freshness
          };
        });
        return subscriptionReadResultSchema.parse({
          provider: observation.provider,
          availability: observation.availability,
          failure: observation.failure,
          receivedAt: observation.received_at,
          windows
        });
      })();
    } catch {
      throw new Error(ERROR_MESSAGE);
    }
  }
}
