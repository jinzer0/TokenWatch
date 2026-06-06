import type { TokenWatchDb } from './client.js';
import { SCHEMA_VERSION, schemaSql } from './schema.js';
import {
  normalizeWarningCodes,
  validateSourceName,
  type PathKind,
  type ScanErrorCode
} from '../privacy.js';

export function runMigrations(db: TokenWatchDb): void {
  const migrate = db.transaction(() => {
    const version = readSchemaVersion(db);
    if (version > SCHEMA_VERSION) {
      throw new Error('migration_failed');
    }
    if (version === 0) {
      if (scanRunsNeedsV2Migration(db)) migrateScanRunsV2(db);
      db.exec(schemaSql);
      migrateUsageEventsV3(db);
      migrateUsageEventsV5(db);
    } else {
      if (version < 2) migrateScanRunsV2(db);
      db.exec(schemaSql);
      if (version < 3) migrateUsageEventsV3(db);
      if (version < 5) migrateUsageEventsV5(db);
      if (version < 7) migratePricingLookupCacheV7(db);
    }
    db.prepare(
      'INSERT INTO app_config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('schemaVersion', String(SCHEMA_VERSION));
  });
  migrate();
}

function migratePricingLookupCacheV7(db: TokenWatchDb): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pricing_lookup_cache'")
    .get() as { sql: string } | undefined;
  if (!table || table.sql.includes('provider-prefix')) return;

  db.exec('ALTER TABLE pricing_lookup_cache RENAME TO pricing_lookup_cache_v6');
  db.exec(schemaSql);
  db.exec(`
    INSERT INTO pricing_lookup_cache (
      cache_key, provider, model, matched_source, matched_key, confidence,
      input_price_per_million, output_price_per_million, cached_input_price_per_million,
      fetched_at, updated_at, no_match
    )
    SELECT
      cache_key, provider, model, matched_source, matched_key, confidence,
      input_price_per_million, output_price_per_million, cached_input_price_per_million,
      fetched_at, updated_at, no_match
    FROM pricing_lookup_cache_v6
  `);
  db.exec('DROP TABLE pricing_lookup_cache_v6');
  db.exec(schemaSql);
}

function readSchemaVersion(db: TokenWatchDb): number {
  const hasConfig = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_config'")
    .get() as { name: string } | undefined;
  if (!hasConfig) return 0;
  const current = db.prepare('SELECT value FROM app_config WHERE key = ?').get('schemaVersion') as
    | { value: string }
    | undefined;
  if (!current) return 0;
  if (!/^(0|[1-9]\d*)$/.test(current.value)) {
    throw new Error('migration_failed');
  }
  const version = Number(current.value);
  if (!Number.isSafeInteger(version)) {
    throw new Error('migration_failed');
  }
  return version;
}

function migrateUsageEventsV3(db: TokenWatchDb): void {
  const columns = db.prepare('PRAGMA table_info(usage_events)').all() as { name: string }[];
  if (columns.length === 0) return;
  const columnNames = new Set(columns.map((column) => column.name));
  for (const [name, definition] of [
    ['pricing_source', 'TEXT'],
    ['pricing_confidence', 'TEXT'],
    ['normalized_provider', 'TEXT'],
    ['normalized_model', 'TEXT']
  ] as const) {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE usage_events ADD COLUMN ${name} ${definition}`);
    }
  }
}

function migrateUsageEventsV5(db: TokenWatchDb): void {
  const columns = db.prepare('PRAGMA table_info(usage_events)').all() as { name: string }[];
  if (columns.length === 0) return;
  const columnNames = new Set(columns.map((column) => column.name));
  for (const [name, definition] of [
    ['cache_write_tokens', 'INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0)'],
    ['duration_ms', 'INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0)'],
    ['message_count', 'INTEGER CHECK (message_count IS NULL OR message_count >= 0)'],
    ['workspace_hash', 'TEXT'],
    ['workspace_label', 'TEXT'],
    ['turn_start', 'INTEGER NOT NULL DEFAULT 0 CHECK (turn_start IN (0, 1))']
  ] as const) {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE usage_events ADD COLUMN ${name} ${definition}`);
    }
  }
}

type V1ScanRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  source_name: string;
  parser_name: string | null;
  path: string | null;
  status: string;
  discovered_files: number;
  parsed_events: number;
  inserted_events: number;
  duplicate_events: number;
  conflict_events: number;
  skipped_records: number;
  error_message: string | null;
};

function migrateScanRunsV2(db: TokenWatchDb): void {
  const columns = db.prepare('PRAGMA table_info(scan_runs)').all() as { name: string }[];
  if (columns.length === 0 || columns.some((column) => column.name === 'warning_codes_json'))
    return;
  const rows = db.prepare('SELECT * FROM scan_runs').all() as V1ScanRunRow[];
  db.exec('ALTER TABLE scan_runs RENAME TO scan_runs_v1');
  db.exec(`
    CREATE TABLE scan_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      source_name TEXT NOT NULL,
      parser_name TEXT,
      path_kind TEXT NOT NULL DEFAULT 'unknown',
      status TEXT NOT NULL,
      discovered_files INTEGER NOT NULL DEFAULT 0,
      parsed_events INTEGER NOT NULL DEFAULT 0,
      inserted_events INTEGER NOT NULL DEFAULT 0,
      duplicate_events INTEGER NOT NULL DEFAULT 0,
      conflict_events INTEGER NOT NULL DEFAULT 0,
      skipped_records INTEGER NOT NULL DEFAULT 0,
      rejected_records INTEGER NOT NULL DEFAULT 0,
      error_records INTEGER NOT NULL DEFAULT 0,
      warning_codes_json TEXT NOT NULL DEFAULT '[]',
      error_code TEXT
    );
  `);
  const insert = db.prepare(`INSERT INTO scan_runs (
    id, started_at, finished_at, source_name, parser_name, path_kind, status,
    discovered_files, parsed_events, inserted_events, duplicate_events, conflict_events,
    skipped_records, rejected_records, error_records, warning_codes_json, error_code
  ) VALUES (
    @id, @started_at, @finished_at, @source_name, @parser_name, @path_kind, @status,
    @discovered_files, @parsed_events, @inserted_events, @duplicate_events, @conflict_events,
    @skipped_records, @rejected_records, @error_records, @warning_codes_json, @error_code
  )`);
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const row of rows) {
    const legacyFailure = row.error_message ? classifyLegacyError(row.error_message) : null;
    const staleRunning = row.status === 'running' && Date.parse(row.started_at) < cutoff;
    const status = staleRunning ? 'interrupted' : safeStatus(row.status);
    const errorCode = staleRunning ? 'stale_running_interrupted' : legacyFailure;
    insert.run({
      id: row.id,
      started_at: row.started_at,
      finished_at: row.finished_at,
      source_name: safeSourceName(row.source_name),
      parser_name: safeParserName(row.parser_name),
      path_kind: pathKind(row.path),
      status,
      discovered_files: row.discovered_files,
      parsed_events: row.parsed_events,
      inserted_events: row.inserted_events,
      duplicate_events: row.duplicate_events,
      conflict_events: row.conflict_events,
      skipped_records: row.skipped_records,
      rejected_records: 0,
      error_records: errorCode ? 1 : 0,
      warning_codes_json: JSON.stringify(normalizeWarningCodes([])),
      error_code: errorCode
    });
  }
  db.exec('DROP TABLE scan_runs_v1');
}

function scanRunsNeedsV2Migration(db: TokenWatchDb): boolean {
  const columns = db.prepare('PRAGMA table_info(scan_runs)').all() as { name: string }[];
  return columns.length > 0 && !columns.some((column) => column.name === 'warning_codes_json');
}

function safeSourceName(value: string): string {
  try {
    return validateSourceName(value);
  } catch {
    return 'local';
  }
}

function pathKind(value: string | null): PathKind {
  return value ? 'custom' : 'default';
}

function safeParserName(value: string | null): 'codex' | 'opencode' | null {
  if (value === 'codex' || value === 'opencode') return value;
  return null;
}

function safeStatus(value: string): 'running' | 'completed' | 'failed' | 'interrupted' {
  if (
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'interrupted'
  ) {
    return value;
  }
  return 'failed';
}

function classifyLegacyError(value: string): ScanErrorCode {
  if (/source/i.test(value)) return 'invalid_source_name';
  if (/canonical|privacy/i.test(value)) return 'invalid_canonical_field';
  return 'unknown_error';
}
