import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_IDLE_GAP_MS } from '../src/app/constants.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { ConfigRepository } from '../src/db/repositories/config.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { SCHEMA_VERSION } from '../src/db/schema.js';
import { createTempDb, createTestEvent } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('database migrations', () => {
  it('creates a fresh schema with nullable pricing metadata and config defaults', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);

    const usageColumns = columnNames(db, 'usage_events');
    const config = new ConfigRepository(db);

    expect(config.get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(config.get('session_idle_gap_ms')).toBe(String(DEFAULT_SESSION_IDLE_GAP_MS));
    expect(config.list().session_idle_gap_ms).toBe(String(DEFAULT_SESSION_IDLE_GAP_MS));
    expect(rowCount(db, 'app_config', 'session_idle_gap_ms')).toBe(0);
    expect(usageColumns).toEqual(
      expect.arrayContaining([
        'pricing_version',
        'pricing_source',
        'pricing_confidence',
        'normalized_provider',
        'normalized_model'
      ])
    );
  });

  it('upgrades v2 usage_events without breaking existing rows', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    const legacy = new Database(temp.dbPath);
    const event = createTestEvent();
    legacy.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '2');
      CREATE TABLE usage_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        source_name TEXT NOT NULL,
        agent TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
        output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
        cached_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0),
        reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
        total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
        estimated_cost_usd REAL,
        session_id_hash TEXT,
        raw_id_hash TEXT,
        raw_source TEXT NOT NULL,
        pricing_version TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        `INSERT INTO usage_events (
          id, timestamp, source, source_name, agent, provider, model,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens, total_tokens,
          estimated_cost_usd, session_id_hash, raw_id_hash, raw_source, pricing_version,
          metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.id,
        event.timestamp,
        event.source,
        event.sourceName,
        event.agent,
        event.provider,
        event.model,
        event.inputTokens,
        event.outputTokens,
        event.cachedTokens,
        event.reasoningTokens,
        event.totalTokens,
        event.estimatedCostUsd,
        event.sessionIdHash,
        event.rawIdHash,
        event.rawSource,
        '2026-05-mvp-static',
        JSON.stringify(event.metadata),
        '2026-05-30T00:00:00.000Z'
      );
    legacy.close();

    db = openDatabase(temp.dbPath);
    const repo = new UsageEventsRepository(db);
    const migrated = repo.getById(event.id);

    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(columnNames(db, 'usage_events')).toEqual(
      expect.arrayContaining([
        'pricing_source',
        'pricing_confidence',
        'normalized_provider',
        'normalized_model'
      ])
    );
    expect(migrated?.pricingSource).toBeNull();
    expect(migrated?.pricingConfidence).toBeNull();
    expect(migrated?.normalizedProvider).toBeNull();
    expect(migrated?.normalizedModel).toBeNull();
    expect(repo.insert(event)).toBe('duplicate');
  });

  it('normalizes and validates session idle gap config values', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const config = new ConfigRepository(db);

    config.set('session_idle_gap_ms', ' 240000 ');

    expect(config.get('session_idle_gap_ms')).toBe('240000');
    expect(() => config.set('session_idle_gap_ms', '0')).toThrow('invalid_session_idle_gap_ms');
    expect(() => config.set('session_idle_gap_ms', '1e3')).toThrow('invalid_session_idle_gap_ms');
  });
});

function columnNames(db: TokenWatchDb, table: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.map((column) => column.name);
}

function rowCount(db: TokenWatchDb, table: string, key: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE key = ?`).get(key) as { count: number }
  ).count;
}
