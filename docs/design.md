# TokenWatch MVP Design

## Scope

TokenWatch is a local-only Node.js, TypeScript, SQLite, Commander, and Ink app. The MVP ingests privacy-safe usage metadata from local coding-agent artifacts, stores canonical events in SQLite, and presents aggregate summaries through CLI and TUI surfaces.

`docs/tokscale` is reference-only and is not reused as implementation.

## Data Model

The canonical event is `UsageEvent`. Required fields include timestamp, source, sourceName, agent, provider, model, input/output/cached/reasoning/total tokens, nullable estimated cost, hashed session/raw identifiers, rawSource enum-like provenance, and allowlisted metadata.

Event IDs are deterministic hashes of sanitized canonical fields. Raw paths, raw payloads, prompt/response text, credentials, and volatile export metadata are excluded from fingerprints.

## Storage

SQLite is initialized through idempotent migrations. Core tables are:

- `usage_events`
- `scan_runs`
- `pricing_models`
- `app_config`

The DB uses WAL, a busy timeout, and repository-only writes. Duplicate IDs with identical payloads are counted as duplicates; identical IDs with different payloads are conflicts and do not overwrite existing rows.

## Parser Boundary

Parsers discover bounded candidate files, parse supported JSON, JSONL, and OpenCode SQLite shapes, and return sanitized event drafts plus bounded skip warnings. They do not write to DB, calculate pricing, emit raw payloads, or create global event fingerprints.

The scanner resolves sourceName, calculates pricing, finalizes event IDs, persists events, and records scan run lifecycle counts.

## Privacy Model

Sensitive values must not appear outside parser internals. Blocked surfaces include DB rows, exports, CLI output, doctor output, scan run warnings, and TUI rendering. Metadata is allowlisted and schema-validated.

Tests use synthetic fixtures with fake prompt, response, API key, OAuth token, auth/config, and raw path sentinels to assert absence from output surfaces.

## CLI and TUI

The CLI is the operational surface for scan, summary, import/export, config, seed, reset, doctor, budget status, watch, heatmap, and TUI launch. The TUI is intentionally thin: it reuses shared aggregation data and renders Overview, Budget Status, Activity Heatmap, source/sourceName/model/agent/day/hour groups, recent scan runs, unknown pricing, and help.

Local report expansion adds `tokenwatch graph`, `tokenwatch wrapped`, `tokenwatch budget status`, `tokenwatch watch`, `tokenwatch heatmap`, `tokenwatch audit`, `tokenwatch doctor --sources`, `tokenwatch usage --provider <openai|anthropic> --json`, and `tokenwatch headless codex --input <file|->` to the documented CLI surface.

`graph` returns a validated local JSON report with `series`, `totals`, nullable cost values, `unknownCostEvents`, and `privacy`. `wrapped` returns a yearly local JSON report with top-level `topModels`, `topAgents`, `topSources`, `topSourceNames`, `monthly`, `sessionMetrics`, `highlights`, `unknownCostEvents`, and `privacy`. PNG output is rendered from those validated report objects and does not carry raw records or metadata chunks from source artifacts.

`budget status` returns canonical `ok`, `warning`, `exceeded`, or `unknown` rows from the shared budget status service. `watch` is polling-based and reuses the same tick calculation for continuous mode and `--once`; each tick reads the rolling UTC `(now - intervalMs, now]` window. `heatmap` returns UTC year/day buckets for exactly `tokens`, `events`, or `cost`, and supports text, JSON, and SVG output only. Heatmap PNG output is not supported.

`doctor --sources` reports source support status and sanitized warnings only. `usage --provider <openai|anthropic> --json` is an Env-only Live probe that reads provider credentials from environment variables at invocation time, never persists them, and reports `unknown` when providers omit quota or rate-limit data. It is best-effort and not billing-grade. `headless codex --input <file|->` ingests explicit sanitized JSON only; it does not execute Codex and does not automatically capture stdout, stderr, transcripts, raw records, or raw paths.

## Audit Architecture

`tokenwatch audit` is a read-only local service flow. The CLI loads existing repositories, reads normalized rows from `usage_events`, reads sanitized scan lifecycle rows from `scan_runs`, reads parser contract metadata from the registry, builds the report through `AuditService`, and renders either text or JSON. It does not scan files, mutate source artifacts, write usage events, or change configuration.

The report boundary is strict Zod validation. `auditReportSchema` accepts only `version: 1`, aggregate coverage fields, deterministic source contract rows, sanitized scan counters, warning codes, filters, range, and `privacy: { sanitized: true }`. Report validation also runs the shared safe-report JSON checks, so prompts, responses, credentials, raw paths, raw session IDs, raw records, SQL payloads, stack traces, and arbitrary metadata dumps must not cross the service boundary.

Audit windows are fixed rolling UTC windows. The default is `7d`; `30d` is the only longer option. Both use `(from,to]` inclusion. Repeated `--source` and `--source-name` values are OR filters inside the same dimension and AND filters across dimensions. Output ordering is deterministic: registry order for source contracts, sorted sourceName filters, and sorted distribution rows.

Audit uses existing tables and contracts only. Pricing coverage comes from nullable cost, pricing source, and confidence fields already stored on `usage_events`. Session coverage is an aggregate count of events with or without `sessionIdHash`; it does not return hashes. Scan health comes from aggregate `scan_runs` counters and sanitized warning codes. Scan health window is anchored to scan `startedAt`; `finishedAt` is validated but does not select scope. Accounting mode is registry provenance metadata for how token counts are obtained, not event-level accounting state.

No migration is added for audit. The feature does not persist redundant event-level accounting mode, parser evidence, or audit snapshots. Recomputing from `usage_events`, `scan_runs`, and the parser registry keeps the audit output aligned with the current local database and current source contract metadata.

## Limitations

The MVP does not provide billing-grade cost or quota guarantees, invoice reconciliation, audit-based billing verification, cloud sync, daemon mode, filesystem watch mode, web dashboards, OAuth/API usage pulls, share URLs, badges, account/profile features, leaderboards, heatmap PNG export, or exhaustive historical parser compatibility. Unknown schemas are skipped with sanitized warnings rather than treated as fatal errors. Unknown prices stay `unknown` or `null`; they are not reported as free usage.
