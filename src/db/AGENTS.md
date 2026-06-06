# Purpose

This directory owns TokenWatch's SQLite persistence layer. Keep database code focused on opening the DB, running migrations, defining schema, and mapping normalized app models to rows.

# Key files

1. `client.ts` opens SQLite, sets pragmas, and runs migrations before repositories use the connection.
2. `schema.ts` defines tables, indexes, and `SCHEMA_VERSION`.
3. `migrations.ts` creates compatible schema state and stores `schemaVersion` in `app_config`.
4. `repositories/usageEvents.ts` stores normalized usage events and preserves duplicate, conflict, and transaction behavior.
5. `repositories/scanRuns.ts` records scan summaries without exposing raw input paths.
6. `repositories/config.ts` owns validated app config keys such as `source_name` and `schemaVersion`.

# Local rules

1. Keep repositories at the persistence boundary. They may translate between rows and typed models, but parsing, pricing, scan orchestration, import policy, export policy, and UI formatting belong outside `src/db`.
2. Treat `schemaVersion` and migrations as compatibility contracts. Any schema change must preserve existing local databases, reject unsupported future versions, and include tests that open a fresh DB and an upgraded DB shape when applicable.
3. Preserve insert idempotency. Reimporting the same event must return `duplicate`; inserting the same ID with a different canonical payload must return `conflict` and must not overwrite the stored row.
4. Keep bulk event persistence transaction safe. Scan persistence and import paths should write related event batches inside a transaction so partial inserts don't leave misleading counts.
5. Store only normalized metadata that the model allows. Don't store raw prompts, responses, raw paths, credentials, raw records, API keys, OAuth tokens, or arbitrary metadata dumps in DB rows, fixtures, logs, exports, or scan summaries.
6. Keep path storage redacted where scan runs cross into persistence. Store user supplied scan paths as redacted values, not machine local raw paths.
7. Don't hand edit `dist/db`; build output is generated from source.

# Tests/verification

1. For repository, migration, import, or export behavior, run `corepack pnpm test -- tests/repositoriesExportImport.test.ts`.
2. For broad DB changes, run `corepack pnpm test` and `corepack pnpm typecheck`.
3. Use a temp DB for smoke checks, for example `TOKENWATCH_DB_PATH=/tmp/tokenwatch-agent.db corepack pnpm test`, so the default user DB is never touched.
4. Check privacy expectations when DB changes affect rows, exports, scan runs, doctor output, or TUI rendering.

# Pitfalls

1. Don't weaken duplicate or conflict semantics to make imports look successful. A conflict is evidence that the same ID maps to different content and must remain visible.
2. Don't split bulk insert logic out of transaction coverage unless the caller already owns the transaction.
3. Don't add schema columns for raw source artifacts, prompts, responses, credentials, raw paths, raw records, or arbitrary metadata dumps.
4. Don't treat `metadata_json` as a catch all. It should remain bounded, sanitized metadata from the typed `UsageEvent` model.
5. Don't suggest schema changes in documentation only tasks.
