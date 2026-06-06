import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { ConfigRepository } from '../src/db/repositories/config.js';
import { BudgetThresholdsRepository } from '../src/db/repositories/budgetThresholds.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { SCHEMA_VERSION } from '../src/db/schema.js';
import { ExporterService } from '../src/services/exporter.js';
import { ImporterService } from '../src/services/importer.js';
import { containsPrivacySentinel, createTempDb, createTestEvent } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('repositories and import/export', () => {
  it('initializes migrations and handles duplicate/conflict inserts without overwrite', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const config = new ConfigRepository(db);
    const repo = new UsageEventsRepository(db);
    const event = createTestEvent();

    expect(config.get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(repo.insertMany([event])).toEqual({ inserted: 1, duplicates: 0, conflicts: 0 });
    expect(repo.insertMany([event])).toEqual({ inserted: 0, duplicates: 1, conflicts: 0 });

    const conflicting = {
      ...event,
      outputTokens: event.outputTokens + 1,
      totalTokens: event.totalTokens + 1
    };
    expect(repo.insert(conflicting)).toBe('conflict');
    expect(repo.getById(event.id)?.outputTokens).toBe(event.outputTokens);
  });

  it('validates config and imports TokenWatch exports idempotently', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const config = new ConfigRepository(db);
    const repo = new UsageEventsRepository(db);
    const exporter = new ExporterService();
    const importer = new ImporterService(repo);
    const event = createTestEvent({
      sourceName: 'gpu-a100-01',
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });
    const exportPath = join(temp.dir, 'usage.json');

    expect(() => config.set('source_name', 'bad value with spaces')).toThrow();
    expect(() => config.set('source_name', 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK')).toThrow();
    config.set('source_name', ' gpu-a100-01 ');
    expect(config.get('source_name')).toBe('gpu-a100-01');

    db.prepare(
      'INSERT INTO app_config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('source_name', ' lab-a100 ');
    expect(config.list().source_name).toBe('lab-a100');
    expect(config.get('source_name')).toBe('lab-a100');

    writeFileSync(
      exportPath,
      `${JSON.stringify(exporter.createExport([event]), null, 2)}\n`,
      'utf8'
    );
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 1,
      duplicates: 0,
      conflicts: 0,
      rejected: 0
    });
    expect(repo.getById(event.id)).toMatchObject({
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 0,
      duplicates: 1,
      conflicts: 0,
      rejected: 0
    });

    const conflicting = {
      ...event,
      outputTokens: event.outputTokens + 10,
      totalTokens: event.totalTokens + 10
    };
    writeFileSync(
      exportPath,
      `${JSON.stringify(exporter.createExport([conflicting]), null, 2)}\n`,
      'utf8'
    );
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 0,
      duplicates: 0,
      conflicts: 1,
      rejected: 0
    });

    const unsafeMetadata = {
      ...event,
      id: 'unsafe-metadata-event',
      metadata: { parser: 'test', note: 'unsafe' }
    };
    const safeSibling = createTestEvent({
      id: 'safe-sibling-event',
      timestamp: '2026-05-30T02:00:00.000Z',
      rawIdHash: 'safe-sibling'
    });
    writeFileSync(
      exportPath,
      `${JSON.stringify({ ...exporter.createExport([]), eventCount: 2, events: [unsafeMetadata, safeSibling] }, null, 2)}\n`,
      'utf8'
    );
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 1,
      duplicates: 0,
      conflicts: 0,
      rejected: 1
    });
    expect(repo.getById(safeSibling.id)).not.toBeNull();
    const legacyEvent = { ...createTestEvent({ id: 'legacy-export-event', rawIdHash: null }) };
    delete (legacyEvent as Partial<typeof legacyEvent>).pricingSource;
    delete (legacyEvent as Partial<typeof legacyEvent>).pricingConfidence;
    delete (legacyEvent as Partial<typeof legacyEvent>).normalizedProvider;
    delete (legacyEvent as Partial<typeof legacyEvent>).normalizedModel;
    writeFileSync(
      exportPath,
      `${JSON.stringify({ ...exporter.createExport([]), eventCount: 1, events: [legacyEvent] }, null, 2)}\n`,
      'utf8'
    );
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 1,
      duplicates: 0,
      conflicts: 0,
      rejected: 0
    });
    expect(repo.getById('legacy-export-event')).toMatchObject({
      pricingSource: null,
      pricingConfidence: null,
      normalizedProvider: null,
      normalizedModel: null
    });

    const exported = exporter.createExport(repo.listAll());
    expect(exported.events.find((item) => item.id === event.id)).toMatchObject({
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });
    expect(containsPrivacySentinel(exported)).toBe(false);
  });

  it('creates fresh usage_events columns and upgrades v4 rows with safe defaults', () => {
    const fresh = createTempDb();
    cleanup = fresh.cleanup;
    db = openDatabase(fresh.dbPath);

    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(usageColumnNames(db)).toEqual(expect.arrayContaining(v5UsageColumns));
    db.close();
    db = undefined;
    cleanup();
    cleanup = undefined;

    const upgraded = createTempDb();
    cleanup = upgraded.cleanup;
    const legacy = new Database(upgraded.dbPath);
    const event = createTestEvent({ id: 'v4-preserved-event' });
    legacy.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '4');
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
        pricing_source TEXT,
        pricing_confidence TEXT,
        normalized_provider TEXT,
        normalized_model TEXT,
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
          pricing_source, pricing_confidence, normalized_provider, normalized_model,
          metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        event.pricingSource,
        event.pricingConfidence,
        event.normalizedProvider,
        event.normalizedModel,
        JSON.stringify(event.metadata),
        '2026-05-30T00:00:00.000Z'
      );
    legacy.close();

    db = openDatabase(upgraded.dbPath);
    const migrated = new UsageEventsRepository(db).getById(event.id) as Record<
      string,
      unknown
    > | null;
    const migratedRow = db
      .prepare('SELECT * FROM usage_events WHERE id = ?')
      .get(event.id) as Record<string, unknown>;

    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(usageColumnNames(db)).toEqual(expect.arrayContaining(v5UsageColumns));
    expect(migrated).toMatchObject(v5DefaultEventFields);
    expect(migratedRow).toMatchObject({ pricing_version: '2026-05-mvp-static' });
    expect(containsPrivacySentinel(migrated)).toBe(false);
  });

  it('persists, lists, exports, and reimports sanitized v5 usage metadata', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const repo = new UsageEventsRepository(db);
    const exporter = new ExporterService();
    const importPath = join(temp.dir, 'v5-usage.json');
    const event = createTestEvent({
      id: 'v5-extended-event',
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'anthropic',
      normalizedModel: 'claude-sonnet-4.5'
    });
    const v5Event = {
      ...event,
      cacheWriteTokens: 13,
      durationMs: 2400,
      messageCount: 7,
      workspaceHash: 'workspace-hash-001',
      workspaceLabel: 'workspace-alpha',
      turnStart: true
    };

    expect(repo.insertMany([v5Event])).toEqual({ inserted: 1, duplicates: 0, conflicts: 0 });
    expect(repo.getById(event.id) as Record<string, unknown>).toMatchObject({
      cacheWriteTokens: 13,
      durationMs: 2400,
      messageCount: 7,
      workspaceHash: 'workspace-hash-001',
      workspaceLabel: 'workspace-alpha',
      turnStart: true,
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'anthropic',
      normalizedModel: 'claude-sonnet-4.5'
    });
    expect(repo.listAll()[0] as Record<string, unknown>).toMatchObject({
      cacheWriteTokens: 13,
      workspaceHash: 'workspace-hash-001'
    });

    const exported = exporter.createExport(repo.listAll());
    expect(exported.events[0] as Record<string, unknown>).toMatchObject({
      cacheWriteTokens: 13,
      durationMs: 2400,
      messageCount: 7,
      workspaceHash: 'workspace-hash-001',
      workspaceLabel: 'workspace-alpha',
      turnStart: true
    });
    expect(containsPrivacySentinel(exported)).toBe(false);

    writeFileSync(importPath, `${JSON.stringify(exported, null, 2)}\n`, 'utf8');
    db.close();
    db = openDatabase(temp.dbPath);
    const reimportRepo = new UsageEventsRepository(db);
    const importer = new ImporterService(reimportRepo);
    expect(importer.importFile(importPath)).toEqual({
      inserted: 0,
      duplicates: 1,
      conflicts: 0,
      rejected: 0
    });
  });

  it('imports old exports without v5 fields idempotently and defaults extended metadata', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const repo = new UsageEventsRepository(db);
    const exporter = new ExporterService();
    const importer = new ImporterService(repo);
    const exportPath = join(temp.dir, 'legacy-v4-usage.json');
    const legacyEvent = { ...createTestEvent({ id: 'legacy-v4-event-001' }) } as Record<
      string,
      unknown
    >;
    for (const field of v5EventFields) {
      delete legacyEvent[field];
    }

    writeFileSync(
      exportPath,
      `${JSON.stringify({ ...exporter.createExport([]), eventCount: 1, events: [legacyEvent] }, null, 2)}\n`,
      'utf8'
    );

    expect(importer.importFile(exportPath)).toEqual({
      inserted: 1,
      duplicates: 0,
      conflicts: 0,
      rejected: 0
    });
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 0,
      duplicates: 1,
      conflicts: 0,
      rejected: 0
    });
    expect(repo.getById('legacy-v4-event-001') as Record<string, unknown>).toMatchObject(
      v5DefaultEventFields
    );
  });

  it('rejects raw workspace, session, and path metadata shapes from imports', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const repo = new UsageEventsRepository(db);
    const exporter = new ExporterService();
    const importer = new ImporterService(repo);
    const exportPath = join(temp.dir, 'unsafe-v5-usage.json');
    const safeEvent = createTestEvent({ id: 'safe-v5-import-event' });
    const unsafeEvents = [
      {
        ...createTestEvent({ id: 'raw-workspace-label-event' }),
        workspaceLabel: 'RAW_WORKSPACE_SENTINEL_DO_NOT_LEAK'
      },
      {
        ...createTestEvent({ id: 'raw-session-import-event' }),
        rawSessionId: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'
      },
      {
        ...createTestEvent({ id: 'raw-path-import-event' }),
        workspacePath: '/private/RAW_PATH_SENTINEL_DO_NOT_LEAK/project'
      }
    ];

    writeFileSync(
      exportPath,
      `${JSON.stringify(
        { ...exporter.createExport([]), eventCount: 4, events: [...unsafeEvents, safeEvent] },
        null,
        2
      )}\n`,
      'utf8'
    );

    expect(importer.importFile(exportPath)).toEqual({
      inserted: 1,
      duplicates: 0,
      conflicts: 0,
      rejected: 3
    });
    expect(repo.getById(safeEvent.id)).not.toBeNull();
    expect(repo.getById('raw-workspace-label-event')).toBeNull();
    expect(repo.getById('raw-session-import-event')).toBeNull();
    expect(repo.getById('raw-path-import-event')).toBeNull();
    expect(containsPrivacySentinel(exporter.createExport(repo.listAll()))).toBe(false);
  });

  it('creates scan_runs v2 and upgrades v1 rows without raw error or path text', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    const legacy = new Database(temp.dbPath);
    legacy.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '1');
      CREATE TABLE scan_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        source_name TEXT NOT NULL,
        parser_name TEXT,
        path TEXT,
        status TEXT NOT NULL,
        discovered_files INTEGER NOT NULL DEFAULT 0,
        parsed_events INTEGER NOT NULL DEFAULT 0,
        inserted_events INTEGER NOT NULL DEFAULT 0,
        duplicate_events INTEGER NOT NULL DEFAULT 0,
        conflict_events INTEGER NOT NULL DEFAULT 0,
        skipped_records INTEGER NOT NULL DEFAULT 0,
        error_message TEXT
      );
    `);
    legacy
      .prepare(
        `INSERT INTO scan_runs (
          id, started_at, source_name, parser_name, path, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'legacy-run',
        '2020-01-01T00:00:00.000Z',
        'PROMPT_SENTINEL_DO_NOT_LEAK',
        'PROMPT_SENTINEL_DO_NOT_LEAK',
        '/private/RAW_PATH_SENTINEL_DO_NOT_LEAK/events.json',
        'running',
        'SQLite Error: /private/RAW_PATH_SENTINEL_DO_NOT_LEAK'
      );
    legacy.close();

    db = openDatabase(temp.dbPath);
    const columns = db.prepare('PRAGMA table_info(scan_runs)').all() as { name: string }[];
    const row = db.prepare('SELECT * FROM scan_runs WHERE id = ?').get('legacy-run') as Record<
      string,
      unknown
    >;
    const serialized = JSON.stringify(row);

    expect(columns.map((column) => column.name)).not.toContain('error_message');
    expect(row.status).toBe('interrupted');
    expect(row.path_kind).toBe('custom');
    expect(row.source_name).toBe('local');
    expect(row.parser_name).toBeNull();
    expect(row.error_code).toBe('stale_running_interrupted');
    expect(serialized).not.toContain('/private');
    expect(containsPrivacySentinel(row)).toBe(false);
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
  });

  it('upgrades legacy scan_runs even when schemaVersion is missing', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    const legacy = new Database(temp.dbPath);
    legacy.exec(`
      CREATE TABLE scan_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        source_name TEXT NOT NULL,
        parser_name TEXT,
        path TEXT,
        status TEXT NOT NULL,
        discovered_files INTEGER NOT NULL DEFAULT 0,
        parsed_events INTEGER NOT NULL DEFAULT 0,
        inserted_events INTEGER NOT NULL DEFAULT 0,
        duplicate_events INTEGER NOT NULL DEFAULT 0,
        conflict_events INTEGER NOT NULL DEFAULT 0,
        skipped_records INTEGER NOT NULL DEFAULT 0,
        error_message TEXT
      );
      INSERT INTO scan_runs(id, started_at, source_name, parser_name, path, status)
      VALUES ('missing-version-run', '2026-01-01T00:00:00.000Z', 'lab-a100', 'opencode', NULL, 'completed');
    `);
    legacy.close();

    db = openDatabase(temp.dbPath);
    const row = db.prepare('SELECT * FROM scan_runs WHERE id = ?').get('missing-version-run') as
      | Record<string, unknown>
      | undefined;

    expect(row?.warning_codes_json).toBe('[]');
    expect(row?.path_kind).toBe('default');
    expect(row?.parser_name).toBe('opencode');
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
  });

  it('rejects future schema versions before migration', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    const future = new Database(temp.dbPath);
    future.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '999');
    `);
    future.close();

    expect(() => openDatabase(temp.dbPath)).toThrow('migration_failed');
  });

  it('rejects malformed schema versions before migration', () => {
    for (const version of ['not-a-number', '', '   ', '1e0', '0x2']) {
      const temp = createTempDb();
      cleanup = temp.cleanup;
      const invalid = new Database(temp.dbPath);
      invalid.exec('CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
      invalid
        .prepare('INSERT INTO app_config(key, value) VALUES (?, ?)')
        .run('schemaVersion', version);
      invalid.close();

      expect(() => openDatabase(temp.dbPath)).toThrow('migration_failed');
      cleanup();
      cleanup = undefined;
    }
  });

  it('creates pricing lookup cache tables for fresh and upgraded v5 databases', () => {
    const fresh = createTempDb();
    cleanup = fresh.cleanup;
    db = openDatabase(fresh.dbPath);
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['pricing_lookup_cache', 'cursor_pricing_overrides'])
    );
    db.close();
    db = undefined;
    cleanup();
    cleanup = undefined;

    const upgraded = createTempDb();
    cleanup = upgraded.cleanup;
    const legacy = new Database(upgraded.dbPath);
    legacy.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '5');
      CREATE TABLE pricing_models (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_price_per_million REAL NOT NULL,
        output_price_per_million REAL NOT NULL,
        cached_input_price_per_million REAL,
        effective_from TEXT,
        metadata_json TEXT
      );
    `);
    legacy.close();

    db = openDatabase(upgraded.dbPath);
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['pricing_lookup_cache', 'cursor_pricing_overrides'])
    );
  });

  it('exports, imports, and rejects unsafe pricing lookup cache entries', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const usageRepo = new UsageEventsRepository(db);
    const pricingRepo = new PricingModelsRepository(db);
    const exporter = new ExporterService();
    const exportPath = join(temp.dir, 'pricing-cache.json');
    const event = createTestEvent({ id: 'cache-export-event' });
    usageRepo.insert(event);
    const positive = pricingRepo.setLookupCache({
      cacheKey: 'lookup:openai:gpt-5.5',
      provider: 'openai',
      model: 'gpt-5.5',
      matchedSource: 'litellm',
      matchedKey: 'litellm:openai:gpt-5.5',
      confidence: 'exact',
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      cachedInputPricePerMillion: 1,
      fetchedAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:01.000Z'
    });
    const negative = pricingRepo.setLookupCache({
      cacheKey: 'lookup:unknown:no-match',
      provider: 'unknown-provider',
      model: 'no-match',
      matchedSource: 'unknown',
      confidence: 'none',
      fetchedAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:02.000Z',
      noMatch: true
    });
    const providerPrefix = pricingRepo.setLookupCache({
      cacheKey: 'lookup:openrouter:x-ai-grok-4',
      provider: 'openrouter',
      model: 'x-ai/grok-4',
      matchedSource: 'openrouter',
      matchedKey: 'openrouter:xai:grok-4',
      confidence: 'provider-prefix',
      inputPricePerMillion: 2,
      outputPricePerMillion: 12,
      fetchedAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:03.000Z'
    });
    const cursorOverride = pricingRepo.setLookupCache({
      cacheKey: 'lookup:cursor:composer-2',
      provider: 'cursor',
      model: 'composer-2',
      matchedSource: 'cursor',
      matchedKey: 'cursor:composer-2',
      confidence: 'cursor-override',
      inputPricePerMillion: 0.5,
      outputPricePerMillion: 2.5,
      cachedInputPricePerMillion: 0.2,
      fetchedAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:04.000Z'
    });

    const exported = exporter.createExport(usageRepo.listAll(), pricingRepo.listLookupCache());
    expect(exported.pricingLookupCache).toEqual(
      [positive, negative, providerPrefix, cursorOverride].sort((a, b) =>
        a.cacheKey.localeCompare(b.cacheKey)
      )
    );
    expect(containsPrivacySentinel(exported)).toBe(false);
    writeFileSync(
      exportPath,
      `${JSON.stringify(exported, null, 2)}
`,
      'utf8'
    );

    db.close();
    db = openDatabase(temp.dbPath);
    const importedUsage = new UsageEventsRepository(db);
    const importedPricing = new PricingModelsRepository(db);
    const importer = new ImporterService(importedUsage, importedPricing);
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 0,
      duplicates: 1,
      conflicts: 0,
      rejected: 0
    });
    expect(importedPricing.getLookupCache('lookup:openai:gpt-5.5')).toEqual(positive);
    expect(importedPricing.getLookupCache('lookup:unknown:no-match')).toEqual(negative);
    expect(importedPricing.getLookupCache('lookup:openrouter:x-ai-grok-4')).toEqual(providerPrefix);
    expect(importedPricing.getLookupCache('lookup:cursor:composer-2')).toEqual(cursorOverride);

    const unsafeExport = {
      ...exporter.createExport([], []),
      pricingLookupCache: [
        {
          ...positive,
          cacheKey: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'
        },
        {
          ...positive,
          cacheKey: 'lookup:safe:extra',
          rawRecord: { path: '/tmp/RAW_PATH_SENTINEL_DO_NOT_LEAK' }
        }
      ]
    };
    writeFileSync(
      exportPath,
      `${JSON.stringify(unsafeExport, null, 2)}
`,
      'utf8'
    );
    expect(importer.importFile(exportPath)).toEqual({
      inserted: 0,
      duplicates: 0,
      conflicts: 0,
      rejected: 2
    });
    expect(() => importedPricing.getLookupCache('raw_session_sentinel_do_not_leak')).toThrow(
      'validation_failed'
    );
    expect(importedPricing.getLookupCache('lookup:safe:extra')).toBeNull();
  });

  it('creates budget thresholds for fresh and upgraded databases', () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const freshThresholds = new BudgetThresholdsRepository(db);

    expect(freshThresholds.set({ scopeKind: 'monthly_total', thresholdUsd: 12 })).toMatchObject({
      scopeKind: 'monthly_total',
      sourceName: null,
      thresholdUsd: 12
    });
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
    db.close();
    db = undefined;
    cleanup();
    cleanup = undefined;

    const upgraded = createTempDb();
    cleanup = upgraded.cleanup;
    const legacy = new Database(upgraded.dbPath);
    legacy.exec(`
      CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_config(key, value) VALUES ('schemaVersion', '3');
    `);
    legacy.close();

    db = openDatabase(upgraded.dbPath);
    const upgradedThresholds = new BudgetThresholdsRepository(db);
    expect(
      upgradedThresholds.set({ scopeKind: 'sourceName', sourceName: 'lab-a100', thresholdUsd: 3 })
    ).toMatchObject({ scopeKind: 'sourceName', sourceName: 'lab-a100', thresholdUsd: 3 });
    expect(new ConfigRepository(db).get('schemaVersion')).toBe(String(SCHEMA_VERSION));
  });
});

const v5EventFields = [
  'cacheWriteTokens',
  'durationMs',
  'messageCount',
  'workspaceHash',
  'workspaceLabel',
  'turnStart'
] as const;

const v5UsageColumns = [
  'cache_write_tokens',
  'duration_ms',
  'message_count',
  'workspace_hash',
  'workspace_label',
  'turn_start',
  'pricing_version',
  'pricing_source',
  'pricing_confidence',
  'normalized_provider',
  'normalized_model'
];

const v5DefaultEventFields = {
  cacheWriteTokens: 0,
  durationMs: null,
  messageCount: null,
  workspaceHash: null,
  workspaceLabel: null,
  turnStart: false
};

function tableNames(database: TokenWatchDb): string[] {
  const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}

function usageColumnNames(database: TokenWatchDb): string[] {
  const columns = database.prepare('PRAGMA table_info(usage_events)').all() as { name: string }[];
  return columns.map((column) => column.name);
}
