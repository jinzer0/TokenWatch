# Purpose

Local guidance for TokenWatch tests. Tests verify normalized usage metadata, SQLite behavior, CLI-adjacent services, import/export compatibility, aggregation, and Ink TUI rendering without touching real user data.

# Key files

- `helpers.ts`: Shared Vitest helpers, `createTempDb`, test usage events, and privacy sentinel checks.
- `scannerParsers.test.ts`: Scanner/parser fixtures, dedupe, denied paths, sourceName attribution, and privacy non-leakage.
- `repositoriesExportImport.test.ts`: SQLite repositories, migrations, config validation, and TokenWatch import/export compatibility.
- `aggregatorTui.test.tsx`: Aggregation behavior and TUI rendering through `ink-testing-library`.
- `fixtures/`: Synthetic-only parser inputs. They may contain fake prompts, fake secrets, raw-path markers, and other sentinel values on purpose.

# Local rules

- Use Vitest conventions already present in this directory: `describe`, `it`, `expect`, and `afterEach` cleanup where resources are opened.
- Use `createTempDb` for SQLite tests. Close open databases before cleanup, then call the temp cleanup function so no test uses the default user DB.
- Keep fixtures synthetic. Do not add real user logs, real prompts, real responses, real credentials, real OAuth tokens, production exports, or machine-local paths.
- Do not remove fake secret, prompt, response, auth, credential, raw path, or token sentinel values just because they look sensitive. They prove private data stays out of DB rows, exports, doctor output, scan summaries, and TUI output.
- Keep privacy assertions when changing parser, scanner, repository, importer, exporter, aggregation, or TUI behavior. Use `containsPrivacySentinel` for output surfaces that must stay sanitized.
- Preserve import/export compatibility checks. Imports should stay idempotent, duplicates should remain duplicates, and conflicts must not overwrite existing rows.
- Test TUI behavior with `ink-testing-library`; render the `App`, drive stdin when needed, and assert against frames or captured callbacks.

# Tests/verification

- Run all tests with `corepack pnpm test` when test behavior crosses parser, service, DB, import/export, or TUI boundaries.
- Run targeted Vitest checks while iterating, for example `corepack pnpm test -- tests/scannerParsers.test.ts`, `corepack pnpm test -- tests/repositoriesExportImport.test.ts`, or `corepack pnpm test -- tests/aggregatorTui.test.tsx`.
- For documentation-only changes in this directory, run `corepack pnpm format:check` when Markdown formatting is in scope.
- For DB or CLI smoke checks, set `TOKENWATCH_DB_PATH` to a temp path so real user data and the default DB are never touched.

# Pitfalls

- Privacy sentinels are intentional. Removing them weakens the tests even though the values look like leaks.
- Fixture files must stay sanitized examples, not captures from real agent sessions.
- A test that passes by reading or writing `~/.tokenwatch/tokenwatch.db` is wrong. Use temp paths only.
- TUI tests should assert rendered behavior, not implementation details from inside React components.
