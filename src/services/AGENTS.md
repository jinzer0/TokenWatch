# Purpose

Services are TokenWatch's application orchestration layer. Keep scanner, importer, exporter, aggregator, doctor, and config behavior here so CLI commands and TUI components stay thin and database, parser, and UI boundaries remain clear.

# Key files

- `scanner.ts` coordinates parser discovery, parser selection, scan-run accounting, `sourceName` resolution, pricing, inserts, and scan-run updates.
- `importer.ts` and `exporter.ts` own TokenWatch import/export compatibility and must preserve sanitized usage-event shapes.
- `aggregator.ts` builds summaries and TUI data, including grouping by `sourceName` and tracking unknown pricing.
- `configService.ts` owns source-name validation and config defaults used by service callers.
- `doctor.ts` checks local setup without exposing private data.
- `container.ts` wires repositories and services together. Do not move business logic into the container.

# Local rules

- Keep services as coordinators. Parsers sanitize source artifacts before services see them, repositories persist data, and CLI/TUI code only calls service APIs.
- Preserve `sourceName` behavior. Resolve configured and scan override names through `ConfigService`, pass the resolved value into parsers, and keep summaries grouped by that attribution label.
- Preserve parser selection semantics. A requested source should call that parser only; an unspecified source should scan all registered parsers.
- Keep scan-run accounting accurate for discovered, parsed, inserted, duplicate, conflict, skipped, warning, completed, and failed counts.
- Keep scan event inserts and completed scan-run updates in one transaction. Failed scan runs may record the failure after the parser or insert path throws.
- Never store raw input paths. Scan runs should keep redacted paths, such as `[redacted]`, and services must not pass raw records, prompts, responses, credentials, or arbitrary metadata into persistence or exports.
- Preserve unknown pricing. If pricing isn't known, keep `estimatedCostUsd = null`; render and export consumers should treat that as `unknown`, not zero.
- Maintain import/export compatibility with the current export schema and validated usage events. Imports must remain idempotent and must not overwrite conflicts.
- Keep doctor and config checks privacy-safe. They may report setup status and sanitized paths, but not secrets or raw local artifacts.
- For smoke checks, set `TOKENWATCH_DB_PATH=/tmp/...` and never touch a user's default `~/.tokenwatch/tokenwatch.db`.

# Tests/verification

- For scanner or source-name changes, run the closest scanner coverage plus `corepack pnpm typecheck`.
- For import/export, aggregation, TUI data, unknown pricing, or privacy output changes, run `corepack pnpm test -- tests/repositoriesExportImport.test.ts tests/aggregatorTui.test.tsx`.
- For broad service changes, run `corepack pnpm test`, `corepack pnpm typecheck`, and any relevant smoke command with `TOKENWATCH_DB_PATH=/tmp/tokenwatch-agent.db`.
- If a change touches CLI, TUI, import, export, scan, doctor, or database paths, perform a real smoke check against a temp DB.

# Pitfalls

- Don't move service behavior into CLI commands or TUI components.
- Don't weaken parser boundary sanitization or add metadata passthroughs that could leak prompts, responses, credentials, raw paths, or raw records.
- Don't treat unknown model pricing as free usage. Preserve `null` and the displayed `unknown` state.
- Don't split scan inserts from completed scan-run updates unless you also preserve their transactional relationship.
- Don't run smoke checks against the default user DB.
