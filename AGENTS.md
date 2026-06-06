# TokenWatch Agent Guidance

## Purpose

TokenWatch is a Commander CLI and Ink TUI for AI coding-agent token usage metadata. It stores normalized usage events in SQLite and must not store prompts, responses, API keys, OAuth tokens, raw paths, raw records, credentials, or arbitrary metadata dumps.

Use this root file for common rules only. For local rules, read the nearest child guide before changing files in that area:

- `src/parsers/AGENTS.md`
- `src/services/AGENTS.md`
- `src/db/AGENTS.md`
- `src/tui/AGENTS.md`
- `tests/AGENTS.md`

## Environment

- Use Node.js 20.11 or newer.
- Use Corepack pnpm. The project pins `pnpm@10.23.0`, so run commands as `corepack pnpm ...`.
- `better-sqlite3` is native. The machine must support native builds for it.
- After changing Node versions, reinstall or rebuild dependencies before trusting checks. Verify that `better-sqlite3` can load before calling the setup good.

## Commands

Use the narrowest check that proves your change, then widen for cross-cutting work.

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`
- `corepack pnpm format:check`
- `corepack pnpm build`

For local smoke checks, isolate the database so real user data and the default DB are not touched:

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-agent.db corepack pnpm test
```

## Architecture

- CLI entrypoints expose commands that read usage metadata, write normalized SQLite rows, and render summaries or TUI views.
- Parsers sanitize source artifacts before data crosses into services or persistence.
- Services own application behavior and should keep parser, database, and UI boundaries clear.
- `dist/` is generated from source by `corepack pnpm build`.
- `docs/tokscale/` is reference-only material from another project. Do not copy its guidance or treat it as TokenWatch implementation guidance.

## Rules

- Keep root guidance common-only. Put parser, service, database, TUI, and test-specific rules in the child `AGENTS.md` files.
- Do not edit generated, vendor, orchestration, or reference paths: `dist/`, `node_modules/`, `.sisyphus/`, or `docs/tokscale/`. Evidence files under `.sisyphus/evidence/` are allowed when a task asks for them.
- Do not hand-edit `dist/`; regenerate it with `corepack pnpm build`.
- Preserve TokenWatch privacy guarantees. Never add code, fixtures, docs, logs, exports, or UI output that exposes prompts, responses, credentials, raw paths, raw records, or arbitrary raw metadata.
- Avoid machine-local paths and assumptions. Document recommended tools and versions, not one developer's installation layout.
- Change only the files needed for the task. Do not update dependencies, lockfiles, app code, tests, generated output, or config unless the task explicitly asks.

## Verification

- Read this file and any relevant child `AGENTS.md` before editing.
- For documentation-only AGENTS changes, run content checks plus `corepack pnpm format:check` when Markdown formatting is in scope.
- For source changes, run the closest related test, then `corepack pnpm typecheck`. Add `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm format:check`, and `corepack pnpm build` for broad or cross-cutting changes.
- When behavior touches the CLI, TUI, import, export, scan, doctor, or database paths, perform a real smoke check with `TOKENWATCH_DB_PATH=/tmp/...`.
- Treat Node version changes and native dependency rebuilds as untrusted until checks and a smoke test pass.
